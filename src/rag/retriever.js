import config from '../config.js';
import logger from '../utils/logger.js';
import { getVectorStore, loadVectorStore, isInitialized } from './vectorStore.js';

/**
 * Initialize retriever by loading vector store
 */
export async function initializeRetriever() {
    if (!isInitialized()) {
        await loadVectorStore();
    }
    return isInitialized();
}

/**
 * Check if vector store is ready for queries
 */
export async function isVectorStoreReady() {
    if (isInitialized()) {
        return true;
    }

    // Try to load from disk
    const loaded = await loadVectorStore();
    return loaded !== null;
}

/**
 * Query the RAG system for relevant documents
 */
export async function queryRAG(query) {
    const vectorStore = getVectorStore();

    if (!vectorStore) {
        logger.warn('Vector store not available for query');
        return '';
    }

    try {
        // Perform similarity search with score
        // Score is usually cosine similarity (0-1), higher is better
        const topK = 6; // MAXIMIZE CONTEXT
        const resultsWithScore = await vectorStore.similaritySearchWithScore(query, topK);

        // BYPASS THRESHOLD: Trust the LLM to filter relevance
        // Just take the top K results directly
        const results = resultsWithScore.map(([doc, score]) => {
            logger.debug(`Result: ${score.toFixed(4)} - ${doc.pageContent.substring(0, 30)}...`);
            return doc;
        });

        if (!results || results.length === 0) {
            logger.debug('No relevant documents found above threshold');
            return '';
        }

        logger.debug(`Found ${results.length} relevant documents above threshold`);

        // Separate documents by type
        const infoDocs = results.filter(doc => doc.metadata?.type !== 'chat-history');
        const chatDocs = results.filter(doc => doc.metadata?.type === 'chat-history');

        let contextString = '';

        if (infoDocs.length > 0) {
            contextString += '--- [SUMBER INFORMASI UTAMA] ---\n';
            contextString += infoDocs.map((doc, index) => {
                const source = doc.metadata?.fileName || doc.metadata?.source || 'Unknown';
                return `[Dokumen ${index + 1}: ${source}]\n${doc.pageContent.trim()}`;
            }).join('\n\n');
        }

        if (chatDocs.length > 0) {
            if (contextString) contextString += '\n\n';
            contextString += '--- [CONTOH GAYA BAHASA / PERCAKAPAN LALU] ---\n';
            contextString += chatDocs.map((doc) => {
                return doc.pageContent.trim();
            }).join('\n\n---\n\n');
        }

        return contextString;

    } catch (error) {
        logger.error('RAG query failed:', error);
        return '';
    }
}

/**
 * Get retriever instance for advanced use
 */
export function getRetriever() {
    const vectorStore = getVectorStore();
    if (!vectorStore) {
        return null;
    }

    return vectorStore.asRetriever({
        k: config.rag.topK,
    });
}

export default { initializeRetriever, isVectorStoreReady, queryRAG, getRetriever };
