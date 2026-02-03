import { promises as fs } from 'fs';
import { MemoryVectorStore } from 'langchain/vectorstores/memory';
import { OllamaEmbeddings } from '@langchain/community/embeddings/ollama';
import { Document } from '@langchain/core/documents';
import config from '../config.js';
import logger from '../utils/logger.js';

let vectorStore = null;
let embeddings = null;

/**
 * Get or create embeddings instance
 */
export function getEmbeddings() {
    if (!embeddings) {
        embeddings = new OllamaEmbeddings({
            baseUrl: config.ollama.baseUrl,
            model: config.ollama.embedModel,
            requestOptions: {
                timeout: 120000, // 2 minutes timeout
            }
        });
    }
    return embeddings;
}

/**
 * Create vector store from documents
 */
export async function createVectorStore(documents) {
    if (!documents || documents.length === 0) {
        logger.warn('No documents provided to create vector store');
        return null;
    }

    logger.info(`Creating vector store with ${documents.length} documents...`);

    const emb = getEmbeddings();

    try {
        vectorStore = await MemoryVectorStore.fromDocuments(documents, emb);
        logger.info('Vector store created successfully');
        return vectorStore;
    } catch (error) {
        logger.error('Failed to create vector store:', error);
        throw error;
    }
}

/**
 * Save vector store to disk (JSON format)
 */
export async function saveVectorStore() {
    if (!vectorStore) {
        logger.warn('No vector store to save');
        return false;
    }

    const savePath = config.rag.vectorStorePath;

    try {
        // Ensure directory exists
        await fs.mkdir(savePath, { recursive: true });

        // Get data from memory store
        const memoryVectors = vectorStore.memoryVectors;

        // Save as JSON
        const data = JSON.stringify(memoryVectors, null, 2);
        await fs.writeFile(`${savePath}/vectors.json`, data, 'utf-8');

        logger.info(`Vector store saved to: ${savePath}/vectors.json`);
        return true;
    } catch (error) {
        logger.error('Failed to save vector store:', error);
        return false;
    }
}

/**
 * Load vector store from disk
 */
export async function loadVectorStore() {
    const loadPath = `${config.rag.vectorStorePath}/vectors.json`;

    try {
        // Check if vector store exists
        await fs.access(loadPath);

        // Read JSON file
        const data = await fs.readFile(loadPath, 'utf-8');
        const memoryVectors = JSON.parse(data);

        // Create empty memory store with embeddings
        const emb = getEmbeddings();
        vectorStore = new MemoryVectorStore(emb);
        vectorStore.memoryVectors = memoryVectors;

        logger.info(`Vector store loaded from disk (${memoryVectors.length} vectors)`);
        return vectorStore;
    } catch (error) {
        if (error.code === 'ENOENT') {
            logger.info('No existing vector store found');
        } else {
            logger.error('Failed to load vector store:', error);
        }
        return null;
    }
}

/**
 * Get current vector store instance
 */
export function getVectorStore() {
    return vectorStore;
}

/**
 * Check if vector store is initialized
 */
export function isInitialized() {
    return vectorStore !== null;
}

/**
 * Add a new Q&A pair to the vector store (Active Learning)
 */
export async function addLearningData(question, answer) {
    if (!vectorStore) {
        await loadVectorStore();
    }

    if (!vectorStore) {
        logger.error('Cannot add learning data: Vector store failed to initialize');
        return false;
    }

    const doc = new Document({
        pageContent: `Pertanyaan: ${question}\nJawaban: ${answer}`, // Format as QA pair
        metadata: {
            source: 'admin-training',
            type: 'faq', // Treated as FACTUAL information
            timestamp: Date.now()
        }
    });

    try {
        await vectorStore.addDocuments([doc]);
        await saveVectorStore();
        logger.info('✓ Learned new interaction from admin reply');
        return true;
    } catch (error) {
        logger.error('Failed to save learning data:', error);
        return false;
    }
}

export default {
    getEmbeddings,
    createVectorStore,
    saveVectorStore,
    loadVectorStore,
    getVectorStore,
    isInitialized,
    addLearningData
};
