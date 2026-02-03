#!/usr/bin/env node

/**
 * Document Ingestion Script
 * 
 * This script loads PDF documents from the dokumen_ppid folder,
 * creates embeddings, and saves them to the vector store.
 * 
 * Usage: npm run ingest
 */

import { loadAndSplitDocuments } from '../src/rag/loader.js';
import { createVectorStore, saveVectorStore } from '../src/rag/vectorStore.js';
import { isOllamaAvailable } from '../src/ai/ollama.js';
import config from '../src/config.js';
import logger from '../src/utils/logger.js';

async function main() {
    console.log(`
╔═══════════════════════════════════════════════════════════════╗
║           📚 PPID Document Ingestion Tool                     ║
╚═══════════════════════════════════════════════════════════════╝
  `);

    try {
        // Step 1: Check Ollama availability
        logger.info('Step 1: Checking Ollama server...');
        const ollamaReady = await isOllamaAvailable();

        if (!ollamaReady) {
            logger.error('❌ Ollama server is not running!');
            logger.error('   Please start Ollama first: ollama serve');
            logger.error(`   Make sure embedding model is pulled: ollama pull ${config.ollama.embedModel}`);
            process.exit(1);
        }
        logger.info('✓ Ollama server is running');

        // Step 2: Load PDF documents
        logger.info('\nStep 2: Loading PDF documents...');
        logger.info(`   Source folder: ${config.rag.docsFolder}`);

        const chunks = await loadAndSplitDocuments();

        if (chunks.length === 0) {
            logger.warn('⚠️  No documents found to index!');
            logger.warn(`   Please add PDF files to: ${config.rag.docsFolder}`);
            process.exit(0);
        }

        logger.info(`✓ Loaded and split into ${chunks.length} chunks`);

        // Step 3: Create vector store
        logger.info('\nStep 3: Creating vector store (this may take a while)...');
        logger.info(`   Using embedding model: ${config.ollama.embedModel}`);

        const startTime = Date.now();
        await createVectorStore(chunks);
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);

        logger.info(`✓ Vector store created in ${duration}s`);

        // Step 4: Save vector store
        logger.info('\nStep 4: Saving vector store to disk...');
        logger.info(`   Save path: ${config.rag.vectorStorePath}`);

        const saved = await saveVectorStore();

        if (saved) {
            logger.info('✓ Vector store saved successfully');
        } else {
            logger.error('❌ Failed to save vector store');
            process.exit(1);
        }

        // Summary
        console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                    ✅ INGESTION COMPLETE!                     ║
╠═══════════════════════════════════════════════════════════════╣
║                                                               ║
║   Documents indexed: ${chunks.length.toString().padEnd(41)}║
║   Processing time:   ${(duration + 's').padEnd(41)}║
║   Vector store:      ${config.rag.vectorStorePath.slice(-40).padEnd(41)}║
║                                                               ║
║   You can now start the bot with: npm start                  ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
    `);

    } catch (error) {
        logger.error('Ingestion failed:', error);
        process.exit(1);
    }
}

main();
