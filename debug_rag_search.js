
import { loadAllDocuments } from './src/rag/loader.js';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { OllamaEmbeddings } from '@langchain/community/embeddings/ollama';
import { MemoryVectorStore } from 'langchain/vectorstores/memory';
import config from './src/config.js';

console.log("=== RAG SEARCH DIAGNOSTIC ===");
console.log("Config Embed Model:", config.ollama.embedModel);
console.log("Config Base URL:", config.ollama.baseUrl);

async function runDiagnosis() {
    try {
        console.log("1. Loading Documents...");
        const docs = await loadAllDocuments();
        console.log(`   Found ${docs.length} docs.`);

        if (docs.length === 0) {
            console.error("   NO DOCUMENTS FOUND.");
            return;
        }

        console.log("2. Splitting...");
        const splitter = new RecursiveCharacterTextSplitter({
            chunkSize: 1000,
            chunkOverlap: 200,
        });
        const chunks = await splitter.splitDocuments(docs);
        console.log(`   Created ${chunks.length} chunks.`);

        console.log("3. Initialize Embeddings (This might take time)...");
        const embeddings = new OllamaEmbeddings({
            model: config.ollama.embedModel,
            baseUrl: config.ollama.baseUrl,
        });

        console.log("4. Creating Vector Store (Embedding)...");
        // Create store in memory to test simple retrieval
        const vectorStore = await MemoryVectorStore.fromDocuments(chunks, embeddings);

        console.log("5. Performing Similarity Search...");

        const queries = [
            "cara pengajuan magang",
            "alur magang",
            "syarat magang"
        ];

        for (const q of queries) {
            console.log(`\n--- QUERY: "${q}" ---`);
            const results = await vectorStore.similaritySearchWithScore(q, 5); // Get top 5 with scores

            results.forEach((r, i) => {
                const [doc, score] = r; // similaritySearchWithScore returns specific format? 
                // Wait, memory store might return differently than the wrapper in retriever.js
                // Checking langchain docs: memoryStore.similaritySearchWithScore returns [Document, score][]

                console.log(`   [${i + 1}] Score: ${score?.toFixed(4)}`);
                console.log(`       Content: ${doc.pageContent.substring(0, 100).replace(/\n/g, ' ')}...`);
            });
        }

    } catch (e) {
        console.error("DIAGNOSTIC FAILED:", e);
    }
}

runDiagnosis();
