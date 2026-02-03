import makeWASocket, {
    DisconnectReason,
    useMultiFileAuthState,
    fetchLatestBaileysVersion
} from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import pino from 'pino';
import config from '../config.js';
import logger from '../utils/logger.js';
import { handleIncomingMessage } from './handlers.js';

let sock = null;
let reconnectAttempts = 0;
const MAX_RECONNECTS = 5;

/**
 * Initialize WhatsApp connection using Baileys
 */
export async function initializeClient() {
    logger.info('Initializing WhatsApp with Baileys...');

    // Get latest version
    const { version } = await fetchLatestBaileysVersion();
    logger.info(`Using WA version: ${version.join('.')}`);

    // Auth state for session persistence
    const { state, saveCreds } = await useMultiFileAuthState(config.whatsapp.sessionPath);

    // Create socket connection (no printQRInTerminal - deprecated)
    sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ['PPID Bot', 'Chrome', '120.0.0'],
        connectTimeoutMs: 60000,
    });

    // Handle connection updates
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        // MANUAL QR CODE HANDLING
        if (qr) {
            logger.info('\n📱 SCAN QR CODE DI BAWAH INI DENGAN WHATSAPP:\n');
            qrcode.generate(qr, { small: true });
            logger.info('\n⏳ Menunggu scan... (timeout 60 detik)\n');
        }

        if (connection === 'connecting') {
            logger.info('🔄 Connecting to WhatsApp...');
        }

        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

            if (statusCode === DisconnectReason.loggedOut) {
                logger.error('❌ Logged out. Delete data/wwebjs_auth folder and restart.');
                process.exit(1);
            } else if (shouldReconnect && reconnectAttempts < MAX_RECONNECTS) {
                reconnectAttempts++;
                logger.warn(`⚠️ Disconnected. Reconnecting (${reconnectAttempts}/${MAX_RECONNECTS})...`);
                setTimeout(() => initializeClient(), 5000);
            } else if (reconnectAttempts >= MAX_RECONNECTS) {
                logger.error('❌ Max reconnect attempts reached.');
                logger.error('💡 SOLUSI: Gunakan HOTSPOT HP, bukan WiFi kantor!');
                logger.error('   WiFi kantor mungkin memblokir koneksi WhatsApp.');
                process.exit(1);
            }
        } else if (connection === 'open') {
            reconnectAttempts = 0;
            logger.info('✅ WhatsApp connected!');
            const user = sock.user;
            logger.info(`📱 Connected as: ${user?.name || user?.id?.split(':')[0] || 'Unknown'}`);
            logger.info('✅ Bot is now active and listening for messages!\n');
        }
    });

    // Save credentials on update
    sock.ev.on('creds.update', saveCreds);

    // Handle incoming messages
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;

        for (const msg of messages) {
            if (msg.key.fromMe) continue;
            if (!msg.message) continue;
            await handleIncomingMessage(sock, msg);
        }
    });

    return sock;
}

export function getClient() {
    return sock;
}

export default { initializeClient, getClient };
