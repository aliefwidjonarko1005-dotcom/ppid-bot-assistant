import { initializeClient } from './whatsapp/client.js';
import { initializeRetriever } from './rag/retriever.js';
import { testOllama } from './ai/ollama.js';
import logger from './utils/logger.js';

/**
 * Banner
 */
function printBanner() {
    console.log(`
╔═══════════════════════════════════════════════════════════════╗
║     🤖 PPID WhatsApp Bot - Local AI Assistant                ║
║     Powered by: Ollama + LangChain + Baileys                 ║
╚═══════════════════════════════════════════════════════════════╝
`);
}

/**
 * Main
 */
async function main() {
    printBanner();
    logger.info('Starting PPID Bot...\n');

    try {
        // Step 1: Ollama
        logger.info('📡 Checking Ollama...');
        try {
            await testOllama();
        } catch (e) {
            logger.warn('⚠️ Ollama not ready');
        }

        // Step 2: RAG
        logger.info('📚 Loading documents...');
        const ragReady = await initializeRetriever();
        logger.info(ragReady ? '✓ RAG ready' : '⚠️ No documents. Run: npm run ingest');

        // Step 3: WhatsApp
        logger.info('\n📱 Starting WhatsApp...');
        await initializeClient();

    } catch (error) {
        logger.error('Fatal error:', error);
        process.exit(1);
    }
}

// Handle shutdown
process.on('SIGINT', () => {
    logger.info('\nShutting down...');
    process.exit(0);
});

main();
