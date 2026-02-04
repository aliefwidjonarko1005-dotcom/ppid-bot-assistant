/**
 * Conversation Manager
 * Handles session tracking, auto-close after inactivity, and satisfaction surveys
 */

import logger from '../utils/logger.js';
import { summarizeConversation } from '../ai/groq.js';
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Conversation sessions: chatId -> { lastActivity, surveyPending, messageCount, buffer: [] }
const sessions = new Map();

// Survey results: Array of { chatId, rating, timestamp }
const surveyResults = [];

// Configuration
const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const CHECK_INTERVAL = 5 * 60 * 1000; // Check every 5 minutes

// Reference to WhatsApp socket (set by bot-runner)
let waSocket = null;

/**
 * Set WhatsApp socket reference
 */
export function setSocket(sock) {
    waSocket = sock;
}

/**
 * Add message to session buffer for recap context
 */
export function addMessageToBuffer(chatId, role, text) {
    const session = sessions.get(chatId);
    if (!session) return;

    if (!session.buffer) session.buffer = [];
    session.buffer.push({ role, text, timestamp: Date.now() });

    // Keep buffer manageable (last 30 messages)
    if (session.buffer.length > 30) session.buffer.shift();
}

/**
 * Start or update a conversation session
 */
export function updateSession(chatId, customerName = null) {
    const existing = sessions.get(chatId);

    sessions.set(chatId, {
        lastActivity: Date.now(),
        surveyPending: existing?.surveyPending || false,
        surveyAsked: existing?.surveyAsked || false,
        messageCount: (existing?.messageCount || 0) + 1,
        customerName: customerName || existing?.customerName || null,
        needsFollowUp: false,
        buffer: existing?.buffer || [] // Persist buffer
    });
}

/**
 * Check if session is new or expired (30 mins inactivity)
 */
export function isSessionExpired(chatId) {
    const session = sessions.get(chatId);
    if (!session) return true; // Brand new
    return (Date.now() - session.lastActivity) > INACTIVITY_TIMEOUT;
}

/**
 * Get session info
 */
export function getSession(chatId) {
    return sessions.get(chatId);
}

/**
 * Mark that we should ask follow-up
 */
export function markNeedsFollowUp(chatId) {
    const session = sessions.get(chatId);
    if (session) {
        session.needsFollowUp = true;
    }
}

/**
 * Check if follow-up was asked
 */
export function wasFollowUpAsked(chatId) {
    return sessions.get(chatId)?.needsFollowUp || false;
}

/**
 * Clear follow-up flag
 */
export function clearFollowUp(chatId) {
    const session = sessions.get(chatId);
    if (session) {
        session.needsFollowUp = false;
    }
}

/**
 * Check if waiting for feedback (Low Score follow-up)
 */
export function isWaitingForFeedback(chatId) {
    return sessions.get(chatId)?.feedbackPending || false;
}

/**
 * Record evaluation feedback
 */
const dataDir = process.env.DATA_PATH || join(__dirname, '../../data');
const EVAL_FILE = join(dataDir, 'evaluations.json');

export async function recordFeedback(chatId, feedback) {
    const session = sessions.get(chatId);
    if (!session) return;

    const evaluation = {
        id: Date.now().toString(),
        chatId,
        customerName: session.customerName,
        rating: session.lastRating,
        feedback,
        timestamp: Date.now(),
        status: 'pending' // pending | trained | ignored
    };

    try {
        let evaluations = [];
        try {
            const data = await fs.readFile(EVAL_FILE, 'utf-8');
            evaluations = JSON.parse(data);
        } catch { } // New file

        evaluations.push(evaluation);
        await fs.mkdir(dirname(EVAL_FILE), { recursive: true });
        await fs.writeFile(EVAL_FILE, JSON.stringify(evaluations, null, 2));

        // Clear pending State
        session.feedbackPending = false;

        logger.info(`Feedback recorded from ${chatId}: ${feedback}`);

        // Generate Recap with final rating
        generateRecap(chatId, session.lastRating);

    } catch (e) {
        logger.error('Failed to save feedback:', e);
    }
}

/**
 * Check if message is a survey response (1-5)
 */
export function isSurveyResponse(text) {
    const trimmed = text.trim();
    // Allow single digit 1-5
    return /^[1-5]$/.test(trimmed);
}

/**
 * Record survey response
 */
export function recordSurvey(chatId, rating) {
    const session = sessions.get(chatId);

    // Convert to int
    const score = parseInt(rating);

    surveyResults.push({
        chatId,
        rating: score,
        timestamp: Date.now(),
        customerName: session?.customerName || null,
    });

    // Check for Low Score Logic (< 3)
    if (session && score < 3) {
        session.surveyPending = false;
        session.feedbackPending = true;
        session.lastRating = score;
        session.surveyAsked = false; // Reset so they aren't locked
        return true; // Returns true indicating we need to ask for feedback
    }

    // Clear session if good score
    if (session) {
        session.surveyPending = false;
        session.surveyAsked = false;
        session.feedbackPending = false;
    }

    logger.info(`Survey recorded: ${score}/5 from ${chatId}`);

    // Save to file for persistence
    saveSurveyResults();

    // Generate Recap for good scores
    if (session && score >= 3) {
        generateRecap(chatId, score);
    }

    return false; // No follow up needed (Good Score)
}

/**
 * Get survey statistics for dashboard
 */
export function getSurveyStats() {
    // 5-point scale distribution
    const distribution = Array(5).fill(0);
    let sum = 0;

    surveyResults.forEach(r => {
        sum += r.rating;
        // Safety check for legacy 1-10 data if any, map to 1-5 loosely or just clamp
        let idx = Math.min(Math.max(r.rating, 1), 5) - 1;
        distribution[idx]++;
    });

    const total = surveyResults.length;
    const average = total > 0 ? (sum / total).toFixed(1) : 0;

    return {
        total,
        average,
        distribution,
        recent: surveyResults.slice(-10).reverse(),
    };
}

/**
 * Close conversation with survey
 */
async function closeConversation(chatId, reason = 'inactivity') {
    const session = sessions.get(chatId);
    if (!session || session.surveyAsked) return;

    if (!waSocket) {
        logger.warn('Cannot close conversation: no socket');
        return;
    }

    try {
        const name = session.customerName || 'Bapak/Ibu';

        let message;
        if (reason === 'inactivity') {
            message = `Halo ${name}, sepertinya Anda sedang sibuk. Terima kasih telah menghubungi PPID BRIDA Jawa Tengah.\n\nMohon berikan penilaian Anda (1-5):\n\n1 = Sangat Kecewa\n5 = Sangat Puas`;
        } else {
            message = `Terima kasih telah menghubungi PPID BRIDA Jawa Tengah, ${name}.\n\nMohon nilai pelayanan kami (1-5):\n\n1 = Sangat Kecewa\n5 = Sangat Puas`;
        }

        await waSocket.sendMessage(chatId, { text: message });

        session.surveyPending = true;
        session.surveyAsked = true;

        logger.info(`Survey sent to ${chatId} (${reason})`);

    } catch (error) {
        logger.error('Failed to send survey:', error.message);
    }
}

/**
 * Send survey request (for manual close)
 */
export async function sendSurvey(chatId) {
    await closeConversation(chatId, 'completed');
}

/**
 * Check for inactive conversations (run periodically)
 */
function checkInactiveConversations() {
    const now = Date.now();

    sessions.forEach((session, chatId) => {
        const inactiveTime = now - session.lastActivity;

        // If inactive for 30+ minutes and survey not yet asked
        if (inactiveTime >= INACTIVITY_TIMEOUT && !session.surveyAsked) {
            closeConversation(chatId, 'inactivity');
        }

        // Clean up very old sessions (24 hours)
        if (inactiveTime >= 24 * 60 * 60 * 1000) {
            sessions.delete(chatId);
        }
    });
}

/**
 * Save survey results to file
 */
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SURVEY_FILE = join(process.env.DATA_PATH || join(__dirname, '../../data'), 'survey_results.json');

async function saveSurveyResults() {
    try {
        await fs.mkdir(dirname(SURVEY_FILE), { recursive: true });
        await fs.writeFile(SURVEY_FILE, JSON.stringify(surveyResults, null, 2));
    } catch (error) {
        logger.error('Failed to save survey results:', error.message);
    }
}

/**
 * Load survey results from file
 */
async function loadSurveyResults() {
    try {
        const data = await fs.readFile(SURVEY_FILE, 'utf-8');
        const loaded = JSON.parse(data);
        surveyResults.push(...loaded);
        logger.info(`Loaded ${loaded.length} survey results`);
    } catch (error) {
        // File doesn't exist yet, that's OK
    }
}

/**
 * Check if waiting for survey
 */
export function isWaitingForSurvey(chatId) {
    return sessions.get(chatId)?.surveyPending || false;
}



/**
 * Initialize conversation manager
 */
// ==========================================
// RECAP SYSTEM
// ==========================================
const RECAP_FILE = join(process.env.DATA_PATH || join(__dirname, '../../data'), 'recaps.json');
let recaps = [];

// Load Recaps on Init
async function loadRecaps() {
    try {
        const data = await fs.readFile(RECAP_FILE, 'utf-8');
        recaps = JSON.parse(data);
        logger.info(`Loaded ${recaps.length} conversation recaps`);
    } catch (e) {
        // File might not exist
    }
}

// Generate Recap for a session
export async function generateRecap(chatId, finalRating = null) {
    const session = sessions.get(chatId);
    if (!session || !session.buffer || session.buffer.length < 2) return;

    // Avoid duplicate recaps for same session unless new messages
    // Simple check: if last recap was < 5 mins ago? 
    // Better: Just overwrite/update based on chatId for now, or append history. 
    // Design: New recap per conversation closure.

    try {
        const result = await summarizeConversation(session.buffer);

        const recap = {
            id: Date.now().toString(),
            chatId,
            customerName: session.customerName || "Customer",
            timestamp: Date.now(),
            summary: result.summary,
            category: result.category,
            rating: finalRating || session.lastRating || null,
            status: (finalRating && finalRating >= 4) ? "Sukses ditangani" : "Sedang Ditangani",
            evaluation: session.lastRating < 3 ? "Perlu Evaluasi (Low Score)" : "Normal"
        };

        // If rating is very low, mark as Alert
        if (session.lastRating && session.lastRating <= 2) {
            recap.status = "Alert, menunggu respon CS";
        }

        // Upsert or Push? Let's Push to keep history of conversations
        recaps.unshift(recap); // Newest first

        // Save
        await fs.writeFile(RECAP_FILE, JSON.stringify(recaps, null, 2));
        logger.info(`Recap generated for ${chatId}: ${result.category}`);

    } catch (e) {
        logger.error("Failed to generate recap:", e);
    }
}

export function getRecaps() {
    return recaps;
}

// Init Hook
export function initConversationManager() {
    // 1. Load Survey Results
    loadSurveyResults();

    // 2. Load Recaps
    loadRecaps();

    // 3. Start periodic check for inactive conversations
    setInterval(checkInactiveConversations, CHECK_INTERVAL);

    logger.info('Conversation manager initialized (with Recaps)');
}

export default {
    setSocket,
    updateSession,
    getSession,
    markNeedsFollowUp,
    wasFollowUpAsked,
    clearFollowUp,
    isSurveyResponse,
    recordSurvey,
    getSurveyStats,
    sendSurvey,
    initConversationManager,
    isWaitingForSurvey,
    isWaitingForFeedback,
    recordFeedback,

    // New
    addMessageToBuffer,
    generateRecap,
    getRecaps
};

