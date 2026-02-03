import config from '../config.js';

const LOG_LEVELS = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};

const currentLevel = LOG_LEVELS[config.logLevel] || LOG_LEVELS.info;

/**
 * Format timestamp for logging
 */
function getTimestamp() {
    return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

/**
 * Format phone number for privacy
 */
function maskPhone(phone) {
    if (!phone) return 'unknown';
    const cleaned = phone.replace('@c.us', '').replace('@g.us', '');
    if (cleaned.length > 6) {
        return cleaned.slice(0, 4) + '****' + cleaned.slice(-2);
    }
    return '****';
}

/**
 * Logger utility with levels and formatting
 */
export const logger = {
    debug: (...args) => {
        if (currentLevel <= LOG_LEVELS.debug) {
            console.log(`[${getTimestamp()}] [DEBUG]`, ...args);
        }
    },

    info: (...args) => {
        if (currentLevel <= LOG_LEVELS.info) {
            console.log(`[${getTimestamp()}] [INFO]`, ...args);
        }
    },

    warn: (...args) => {
        if (currentLevel <= LOG_LEVELS.warn) {
            console.warn(`[${getTimestamp()}] [WARN]`, ...args);
        }
    },

    error: (...args) => {
        if (currentLevel <= LOG_LEVELS.error) {
            console.error(`[${getTimestamp()}] [ERROR]`, ...args);
        }
    },

    // Special logger for WhatsApp messages
    message: (from, type, preview) => {
        if (currentLevel <= LOG_LEVELS.info) {
            const masked = maskPhone(from);
            const shortPreview = preview?.slice(0, 50) || '';
            console.log(`[${getTimestamp()}] [MSG] ${masked} | ${type} | ${shortPreview}${preview?.length > 50 ? '...' : ''}`);
        }
    },
};

export default logger;
