/**
 * Bot Runner - Child process for Electron
 * Runs the WhatsApp bot and communicates via IPC
 */
import { initializeRetriever } from './rag/retriever.js';
// Switch to Gemini (Google AI) for intelligence
import { testOllama, generateResponse, isOllamaAvailable, setApiKey, getCustomerName } from './ai/groq.js';
// Placeholder for getCustomerName if missing in groq.js or just use simple stub?
// Viewing groq.js earlier, it did NOT have getCustomerName exported. 
// I need to check if bot-runner uses getCustomerName. 
// It was imported line 7.
// I should probably add getCustomerName to groq.js OR remove usage if not critical. 
// Let's assume I need to ADD it to Groq.js first.
// Wait, I should do that first. But for now, let's look at bot-runner usage of getCustomerName.
import { queryRAG, isVectorStoreReady } from './rag/retriever.js';
import { addLearningData } from './rag/vectorStore.js';
import { applyHumanDelay, rateLimiter } from './utils/rateLimiter.js';
import {
    setSocket,
    updateSession,
    getSession,
    isSurveyResponse,
    recordSurvey,
    getSurveyStats,
    isWaitingForSurvey,
    sendSurvey,
    initConversationManager,
    isWaitingForFeedback,
    recordFeedback,
    isSessionExpired,
    addMessageToBuffer /* NEW */
} from './utils/conversationManager.js';
import config from './config.js';
import logger from './utils/logger.js';
import QRCode from 'qrcode';
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Track chats for takeover
const pendingTakeovers = new Map();

// Global socket reference
let globalSock = null;

// Flag to prevent auto-reconnect after logout
let isLoggingOut = false;

// Current Settings
let currentSettings = config.personality || { humorLevel: 0, temperature: 0.6 };

/**
 * Load settings from file
 */
async function loadSettings() {
    try {
        const settingsDir = process.env.DATA_PATH || join(__dirname, '..', 'data');
        const settingsPath = join(settingsDir, 'settings.json');

        logger.info(`Loading settings from: ${settingsPath}`);
        const data = await fs.readFile(settingsPath, 'utf-8');
        const loaded = JSON.parse(data);
        currentSettings = { ...currentSettings, ...loaded };

        // Update Groq Config
        if (loaded.groqApiKey) {
            setApiKey(loaded.groqApiKey);
        }

        logger.info('Settings loaded');
    } catch (e) {
        // Ignore error (file might not exist yet)
    }
}

/**
 * Send message to parent process
 */
function sendToParent(type, data = {}) {
    if (process.send) {
        process.send({ type, ...data });
    }
}

/**
 * Get message text from Baileys message
 */
function getMessageText(msg) {
    return msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        msg.message?.imageMessage?.caption ||
        msg.message?.documentMessage?.caption ||
        (msg.message?.imageMessage ? '[Dikirim Gambar]' : '') ||
        (msg.message?.documentMessage ? '[Dikirim Dokumen]' : '') || '';
}

/**
 * Check if response indicates need for follow-up
 */
function needsFollowUp(response) {
    const followUpTriggers = [
        'formulir', 'form', 'silakan mengisi', 'dapat mengunjungi',
        'informasi lebih lanjut', 'prosesnya', 'langkah'
    ];
    const lower = response.toLowerCase();
    return followUpTriggers.some(t => lower.includes(t));
}

/**
 * Check if user says "no more questions"
 */
function isConversationEnding(text) {
    const endings = [
        'tidak ada', 'tidak', 'sudah cukup', 'cukup', 'itu saja',
        'terima kasih', 'makasih', 'thanks', 'ok', 'oke', 'siap',
        'sudah', 'selesai', 'clear'
    ];
    const lower = text.toLowerCase().trim();
    return endings.some(e => lower === e || lower.startsWith(e + ' ') || lower.endsWith(' ' + e));
}

/**
 * Check if user is requesting human customer service
 */
function isRequestingHuman(text) {
    const triggers = [
        'bicara dengan manusia', 'hubungi cs', 'customer service',
        'bicara dengan admin', 'mau komplain', 'butuh bantuan manusia',
        'operator', 'hubungi petugas', 'sambungkan ke cs', 'minta cs',
        'ingin bicara dengan orang', 'mau bicara dengan orang',
        'berbicara dengan petugas', 'terhubung dengan cs', 'mau ngobrol sama orang'
    ];
    const lower = text.toLowerCase();
    return triggers.some(t => lower.includes(t));
}

/**
 * Process incoming message
 */
async function handleMessage(sock, msg) {
    const chatId = msg.key.remoteJid;

    // Skip groups and status
    if (chatId.endsWith('@g.us') || chatId === 'status@broadcast') {
        return;
    }

    const text = getMessageText(msg);
    if (!text.trim()) return;

    // Get contact name
    let contact = msg.pushName || 'Kak';
    contact = contact.replace(/[^\w\s]/gi, ''); // Clean name

    // Check for New/Expired Session -> Send Welcome
    if (isSessionExpired(chatId)) {
        await sock.sendMessage(chatId, {
            text: `Halo Kak *${contact}*! 👋\n\nSaya *PPID Assistant*, konsultan virtual cerdas dari BRIDA Provinsi Jawa Tengah.\n\nSaya siap membantu menjawab pertanyaan Anda seputar layanan publik, riset, dan inovasi daerah.\n\n_Ada yang bisa saya bantu?_`
        });

        // Add buffer delay for natural feel
        await new Promise(r => setTimeout(r, 1000));
    }

    // Update session (Mark active)
    updateSession(chatId, contact);

    // Buffer User Message
    addMessageToBuffer(chatId, 'user', text);

    // Notify parent of incoming message
    sendToParent('message-in', {
        chatId,
        name: contact,
        text: text.slice(0, 100)
    });

    // Check if already in takeover mode (admin handling)
    if (pendingTakeovers.has(chatId)) {
        logger.info(`Chat ${chatId} is in takeover mode, skipping auto-reply`);
        return;
    }

    // Check if user is requesting human CS
    if (isRequestingHuman(text)) {
        logger.info(`Handover request detected from ${chatId}`);

        // Notify admin
        sendToParent('handover-request', {
            chatId,
            name: contact,
            text: text,
            timestamp: new Date().toISOString()
        });

        // Send message to customer
        await sock.sendMessage(chatId, {
            text: `Baik Kak *${contact}*, saya akan menghubungkan Anda dengan petugas kami. 🙏\n\nMohon tunggu sebentar ya, petugas akan segera merespons.\n\n_Terima kasih atas kesabarannya._`
        });

        // Mark as pending takeover
        pendingTakeovers.set(chatId, true);
        return;
    }

    // Check if waiting for survey response
    if (isWaitingForSurvey(chatId)) {
        if (isSurveyResponse(text)) {
            const rating = parseInt(text.trim());
            const needsFeedback = recordSurvey(chatId, rating);

            if (needsFeedback) {
                await sock.sendMessage(chatId, {
                    text: `Mohon maaf jika pelayanan kami belum maksimal. 🙏\n\nBolehkah Anda memberi masukan singkat mengenai apa yang perlu kami perbaiki?`
                });
            } else {
                await sock.sendMessage(chatId, {
                    text: `Terima kasih atas penilaian Anda (${rating}/5). Semoga sehat selalu! 👋`
                });
            }

            // Send survey stats to parent
            sendToParent('survey-update', getSurveyStats());
            return;
        }
    }

    // Check if waiting for feedback (Low Score < 3 follow-up)
    if (isWaitingForFeedback(chatId)) {
        await recordFeedback(chatId, text);
        await sock.sendMessage(chatId, {
            text: `Terima kasih atas masukannya. Kami akan menjadikan ini bahan evaluasi untuk meningkatkan kecerdasan AI kami. 🙏`
        });
        return;
    }

    // Check if ending conversation (after follow-up question)
    // Check for conversation ending (Gratitude OR Follow-up response)
    const session = getSession(chatId);
    const isGratitude = ['terima kasih', 'makasih', 'thanks', 'matur nuwun', 'suwun'].some(t => text.toLowerCase().includes(t));

    if (isGratitude || (session?.askedFollowUp && isConversationEnding(text))) {
        logger.info(`Gratitude detected from ${chatId}, sending survey...`);

        // Send survey message DIRECTLY (bypass session check)
        const name = session?.customerName || contact || 'Kak';
        await sock.sendMessage(chatId, {
            text: `Terima kasih telah menghubungi PPID BRIDA Jawa Tengah, ${name} 🙏\n\nMohon nilai pelayanan kami (ketik angka 1-5):\n\n⭐ 1 = Sangat Kecewa\n⭐⭐ 2 = Kurang Puas\n⭐⭐⭐ 3 = Cukup\n⭐⭐⭐⭐ 4 = Puas\n⭐⭐⭐⭐⭐ 5 = Sangat Puas\n\n_Ketik angka saja (misal: 5)_`
        });

        // Mark session as waiting for survey
        if (session) {
            session.surveyPending = true;
            session.surveyAsked = true;
        }
        return;
    }

    // Rate limiting
    if (!rateLimiter.canProcess(chatId)) {
        return;
    }
    rateLimiter.recordRequest(chatId);

    try {
        // Check AI availability
        if (!(await isOllamaAvailable())) {
            sendToParent('error', { message: 'AI tidak tersedia' });
            return;
        }

        // Get RAG context
        let context = '';
        if (await isVectorStoreReady()) {
            context = await queryRAG(text);
        }

        // Check if context is empty (Low RAG confidence)
        if (!context) {
            sendToParent('message-in', {
                chatId,
                name: contact,
                text: text.slice(0, 100),
                needsReview: true // FLAG: Trigger Red Dot in UI
            });

            // Log to Knowledge Gaps file
            try {
                const gapsPath = join(__dirname, '..', 'data', 'knowledge_gaps.json');
                let gaps = [];
                try {
                    const data = await fs.readFile(gapsPath, 'utf-8');
                    gaps = JSON.parse(data);
                } catch { /* File doesn't exist yet */ }

                // Avoid duplicates
                if (!gaps.some(g => g.question === text)) {
                    gaps.push({
                        question: text,
                        chatId,
                        contact,
                        timestamp: new Date().toISOString()
                    });
                    await fs.mkdir(join(__dirname, '..', 'data'), { recursive: true });
                    await fs.writeFile(gapsPath, JSON.stringify(gaps, null, 2));
                    logger.info('Logged knowledge gap:', text.slice(0, 50));
                }
            } catch (err) {
                logger.error('Failed to log knowledge gap:', err.message);
            }
            // Don't return, AI will still generate "Sorry I don't know"
        }

        logger.info(`Context length: ${context.length}`);

        // Generate response
        let response = await generateResponse(text, context, chatId, currentSettings.humorLevel);

        // Track last question for learning
        const sess = getSession(chatId);
        if (sess) sess.lastQuestion = text;

        // Check if we should ask follow-up
        if (needsFollowUp(response) && !session?.askedFollowUp) {
            response += '\n\nApakah ada yang bisa saya bantu lagi?';

            // Mark that we asked follow-up
            const s = getSession(chatId);
            if (s) s.askedFollowUp = true;
        }

        // Apply delay
        await applyHumanDelay();

        // Typing indicator
        await sock.sendPresenceUpdate('composing', chatId);
        await new Promise(r => setTimeout(r, Math.min(response.length * 10, 500)));

        // Send response
        await sock.sendMessage(chatId, { text: response });

        // Buffer Bot Message
        addMessageToBuffer(chatId, 'assistant', response);

        // Notify parent
        sendToParent('message-out', {
            chatId,
            name: contact,
            text: response.slice(0, 100)
        });

    } catch (error) {
        logger.error('Error handling message:', error);
        sendToParent('error', { message: error.message });

        // Send fallback
        try {
            await sock.sendMessage(chatId, { text: config.messages.technicalError });
        } catch (e) { }
    }
}

/**
 * Handle commands from parent process
 * Uses globalSock to ensure we always use the active connection
 */
process.on('message', async (msg) => {
    if (!globalSock) {
        // If socket isn't ready but we need to reply, sending error
        if (msg.type === 'manual-reply') {
            sendToParent('error', { message: 'Bot belum terhubung sepenuhnya' });
        }
        return;
    }

    const sock = globalSock;

    switch (msg.type) {
        case 'manual-reply':
            try {
                logger.info(`Sending manual reply to ${msg.chatId}`);

                // Prepare payload
                let payload = {};
                if (msg.media) {
                    const buffer = Buffer.from(msg.media.data, 'base64');
                    // Check type
                    if (msg.media.mimetype.startsWith('image/')) {
                        payload = {
                            image: buffer,
                            caption: msg.message
                        };
                    } else {
                        // Default to document for PDF/others
                        payload = {
                            document: buffer,
                            mimetype: msg.media.mimetype,
                            fileName: msg.media.filename,
                            caption: msg.message
                        };
                    }
                } else {
                    payload = { text: msg.message };
                }

                await sock.sendMessage(msg.chatId, payload);

                // Buffer Manual Reply
                addMessageToBuffer(msg.chatId, 'assistant', msg.message);

                sendToParent('message-out', {
                    chatId: msg.chatId,
                    name: 'Manual',
                    text: msg.message.slice(0, 100)
                });

                // ACTIVE LEARNING: Learn this Q&A pair
                const session = getSession(msg.chatId);
                if (session && session.lastQuestion) {
                    logger.info(`Learning from manual reply: Q="${session.lastQuestion}" A="${msg.message}"`);
                    await addLearningData(session.lastQuestion, msg.message);
                }

                pendingTakeovers.delete(msg.chatId);
            } catch (error) {
                logger.error('Manual reply failed:', error);
                sendToParent('error', { message: 'Gagal kirim balasan manual: ' + error.message });
            }
            break;

        case 'logout':
            try {
                logger.info('Logging out...');
                isLoggingOut = true; // Set flag to prevent auto-reconnect
                await sock.logout();
                // Delete session folder to require QR re-scan
                await fs.rm(config.whatsapp.sessionPath, { recursive: true, force: true });
                sendToParent('logged-out', {});
                process.exit(0);
            } catch (error) {
                isLoggingOut = false;
                sendToParent('error', { message: 'Gagal logout: ' + error.message });
            }
            break;

        case 'get-survey-stats':
            sendToParent('survey-stats', getSurveyStats());
            break;

        case 'test-prompt':
            try {
                logger.info(`Testing prompt: "${msg.text}"`);

                // Fetch RAG context for the test prompt
                let context = '';
                if (await isVectorStoreReady()) {
                    context = await queryRAG(msg.text);
                }

                const response = await generateResponse(msg.text, context, 'test-user', currentSettings.humorLevel);
                sendToParent('test-prompt-response', { text: response });
            } catch (error) {
                sendToParent('test-prompt-response', { text: "Error: " + error.message });
            }
            break;

        case 'train-ai':
            try {
                logger.info(`Training AI: Q="${msg.question}"`);
                const success = await addLearningData(msg.question, msg.answer);
                sendToParent('train-ai-response', { success: success });
            } catch (error) {
                logger.error('Training failed:', error);
                sendToParent('train-ai-response', { success: false, error: error.message });
            }
            break;

        case 'settings-update':
            logger.info('Settings updated:', JSON.stringify(msg.settings));
            currentSettings = { ...currentSettings, ...msg.settings };
            break;

        case 'release-handover':
            logger.info(`Releasing handover for ${msg.chatId}`);
            pendingTakeovers.delete(msg.chatId);
            break;
    }
});

/**
 * Main entry point
 */
async function main() {
    logger.info('Bot runner starting...');

    // Load settings
    await loadSettings();

    try {
        // Test AI
        logger.info('Checking AI...');
        await testOllama();

        // Initialize RAG
        logger.info('Loading documents...');
        await initializeRetriever();

        // Initialize conversation manager
        initConversationManager();

        // Initialize WhatsApp
        logger.info('Starting WhatsApp...');

        const { state, saveCreds } = await (await import('@whiskeysockets/baileys')).useMultiFileAuthState(config.whatsapp.sessionPath);
        const { default: makeWASocket, DisconnectReason, fetchLatestBaileysVersion } = await import('@whiskeysockets/baileys');
        const pino = (await import('pino')).default;

        const { version } = await fetchLatestBaileysVersion();

        const sock = makeWASocket({
            version,
            auth: state,
            logger: pino({ level: 'warn' }), // Enable warnings to debug crash
            browser: ['PPID Bot', 'Chrome', '120.0.0'],

            // RELAXED STABILITY SETTINGS
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 60000,
            keepAliveIntervalMs: 30000, // Less aggressive
            retryRequestDelayMs: 2000,
            // syncFullHistory: false, // Let Baileys decide default
            // markOnlineOnConnect: true, // Disable to prevent conflict
            generateHighQualityLinkPreview: true
        });

        // Set socket for conversation manager and global usage
        globalSock = sock;
        setSocket(sock);

        sock.ev.on('connection.update', async (update) => {
            // Debug: log ALL connection updates
            logger.info(`Connection update: ${JSON.stringify(update)}`);

            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                try {
                    logger.info('Generating QR code from raw string...');
                    const qrDataUrl = await QRCode.toDataURL(qr, {
                        width: 300,
                        margin: 2,
                        errorCorrectionLevel: 'M'
                    });
                    sendToParent('qr', { qr: qrDataUrl });
                    logger.info('QR sent to parent process');
                } catch (e) {
                    logger.error('QR generation failed:', e.message);
                    sendToParent('error', { message: 'QR generation failed: ' + e.message });
                }
            }

            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                if (statusCode === DisconnectReason.loggedOut || isLoggingOut) {
                    sendToParent('logged-out', {});
                    process.exit(0);
                } else {
                    // logger.warn('Reconnecting...'); // SILENCED
                    logger.info('Reconnecting (Silent)...');
                    setTimeout(() => main(), 5000);
                }
            } else if (connection === 'open') {
                sendToParent('connected', {
                    name: sock.user?.name || sock.user?.id?.split(':')[0] || 'Bot'
                });
            }
        });

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('messages.upsert', async ({ messages, type }) => {
            if (type !== 'notify') return;
            for (const msg of messages) {
                if (msg.key.fromMe) continue;
                if (!msg.message) continue;
                await handleMessage(sock, msg);
            }
        });

        // No need to setupParentHandlers here anymore

    } catch (error) {
        logger.error('Bot runner error:', error);
        sendToParent('error', { message: error.message });
        process.exit(1);
    }
}

main();
