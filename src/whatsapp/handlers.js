import config from '../config.js';
import logger from '../utils/logger.js';
import { applyHumanDelay, rateLimiter } from '../utils/rateLimiter.js';
import { queryRAG, isVectorStoreReady } from '../rag/retriever.js';
import { generateResponse, isOllamaAvailable } from '../ai/ollama.js';
import {
    addMessageToBuffer,
    isWaitingForFeedback,
    isWaitingForSurvey,
    isSurveyResponse,
    recordSurvey,
    recordFeedback
} from '../utils/conversationManager.js';

/**
 * Extract text content from message
 */
function getMessageText(msg) {
    return msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        '';
}

/**
 * Check if message is media
 */
function isMediaMessage(msg) {
    const m = msg.message;
    return !!(m?.imageMessage || m?.videoMessage || m?.audioMessage ||
        m?.documentMessage || m?.stickerMessage);
}

/**
 * Process text message with RAG
 */
async function processTextMessage(query) {
    if (!query.trim()) return null;

    try {
        // Check Ollama
        logger.info('Checking Ollama...');
        if (!(await isOllamaAvailable())) {
            logger.warn('Ollama not available');
            return config.messages.technicalError;
        }

        // Check vector store
        const vsReady = await isVectorStoreReady();
        if (!vsReady) {
            logger.warn('No vector store, using direct LLM');
            return await generateResponse(query, '');
        }

        // RAG query
        logger.info('Querying RAG...');
        const context = await queryRAG(query);

        // Generate response
        logger.info('Generating response...');
        const response = await generateResponse(query, context);
        logger.info('Response generated!');
        return response;

    } catch (error) {
        logger.error('Process error:', error.message);
        return config.messages.technicalError;
    }
}

/**
 * Check if user is asking for Human CS
 */
/**
 * Check if user is asking for Human CS
 */
function checkHumanHandover(text, chatId, senderName) {
    const keywords = /\b(admin|cs|manusia|orang|bantuan|help|tolong)\b/i;
    if (keywords.test(text)) {
        if (process.send) {
            // [FIX] Send as 'alert' to trigger UI Stats Update + Notification
            process.send({
                type: 'alert',
                chatId: chatId,
                reason: `Permintaan CS dari ${senderName || 'User'}: "${text.slice(0, 50)}"`
            });
            logger.info(`[NOTIF] Sent alert request for ${chatId}`);
        }
    }
}

/**
 * Handle incoming message
 */
export async function handleIncomingMessage(sock, msg) {
    const chatId = msg.key.remoteJid;

    // Skip group messages
    if (chatId.endsWith('@g.us')) {
        return;
    }

    // Skip status
    if (chatId === 'status@broadcast') {
        return;
    }

    const text = getMessageText(msg);
    logger.info(`📩 Message from ${chatId.slice(0, 10)}...: "${text.slice(0, 50)}"`);

    // [FIX] Buffer User Message
    addMessageToBuffer(chatId, 'user', text);

    // [FEATURE] Check Notifications
    checkHumanHandover(text, chatId, msg.pushName);

    // [LOGIC] Check for Survey/Feedback Response
    if (isWaitingForFeedback(chatId)) {
        await recordFeedback(chatId, text);
        await sock.sendMessage(chatId, { text: "Terima kasih atas masukan Anda! Kami akan terus berbenah. 🙏" });
        return;
    }

    if (isWaitingForSurvey(chatId)) {
        if (isSurveyResponse(text)) {
            const needsFeedback = recordSurvey(chatId, text);

            // [FIX] Broadcast new stats to UI
            if (process.send) {
                const { getSurveyStats } = await import('../utils/conversationManager.js');
                process.send({
                    type: 'survey-update',
                    data: getSurveyStats()
                });
            }

            if (needsFeedback) {
                await sock.sendMessage(chatId, { text: "Mohon maaf atas ketidaknyamanan ini. Apa yang bisa kami perbaiki? (Ketik masukan Anda)" });
            } else {
                await sock.sendMessage(chatId, { text: "Terima kasih atas penilaian Anda! Senang bisa membantu. 😊" });
            }
            return;
        }
    }

    // Rate limiting
    if (!rateLimiter.canProcess(chatId)) {
        logger.debug('Rate limited');
        return;
    }
    rateLimiter.recordRequest(chatId);

    let response;

    try {
        // Handle media
        if (isMediaMessage(msg)) {
            response = config.messages.mediaNotSupported;
        } else if (text) {
            response = await processTextMessage(text);
        }

        if (!response) return;

        // [FIX] Buffer Assistant Response
        addMessageToBuffer(chatId, 'assistant', response);

        // Human delay
        await applyHumanDelay();

        // Send typing indicator
        await sock.sendPresenceUpdate('composing', chatId);

        // Typing delay
        const delay = Math.min(response.length * 15, 2000);
        await new Promise(r => setTimeout(r, delay));

        // Send response
        await sock.sendMessage(chatId, { text: response });
        logger.info(`✅ Reply sent!`);

    } catch (error) {
        logger.error('Handler error:', error.message);
        try {
            await sock.sendMessage(chatId, { text: config.messages.technicalError });
        } catch (e) {
            logger.error('Failed to send error message');
        }
    }
}

export default { handleIncomingMessage };
