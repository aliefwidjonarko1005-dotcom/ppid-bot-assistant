import config from '../config.js';
import logger from './logger.js';

/**
 * Generate random delay between min and max
 */
function getRandomDelay() {
    const { minDelay, maxDelay } = config.rateLimit;
    return Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Apply human-like delay before responding
 * This helps prevent WhatsApp from flagging the account as a bot
 */
export async function applyHumanDelay() {
    const delay = getRandomDelay();
    logger.debug(`Applying human delay: ${delay}ms`);
    await sleep(delay);
    return delay;
}

/**
 * Simple rate limiter to prevent too many requests
 */
class RateLimiter {
    constructor() {
        this.requests = new Map(); // userId -> last request time
        this.cooldownMs = 2000; // 2 seconds cooldown per user (Reduced for speed)
    }

    /**
     * Check if user is within rate limit
     */
    canProcess(userId) {
        const lastRequest = this.requests.get(userId);
        const now = Date.now();

        if (!lastRequest) {
            return true;
        }

        return (now - lastRequest) >= this.cooldownMs;
    }

    /**
     * Record a request from user
     */
    recordRequest(userId) {
        this.requests.set(userId, Date.now());
    }

    /**
     * Get remaining cooldown time in ms
     */
    getRemainingCooldown(userId) {
        const lastRequest = this.requests.get(userId);
        if (!lastRequest) return 0;

        const elapsed = Date.now() - lastRequest;
        return Math.max(0, this.cooldownMs - elapsed);
    }

    /**
     * Clear old entries (call periodically)
     */
    cleanup() {
        const now = Date.now();
        const maxAge = 30000; // 30 seconds

        for (const [userId, lastRequest] of this.requests) {
            if (now - lastRequest > maxAge) {
                this.requests.delete(userId);
            }
        }
    }
}

export const rateLimiter = new RateLimiter();

// Cleanup every 5 minutes
setInterval(() => {
    rateLimiter.cleanup();
}, 5 * 60 * 1000);

export default { applyHumanDelay, rateLimiter };
