
import { loadAllDocuments } from './src/rag/loader.js';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import config from './src/config.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Mock config if needed or ensure loading
process.env.GROQ_API_KEY = "dummy"; // Bypass checks if any

console.log("=== DIAGNOSTIC START ===");

async function runDiagnosis() {
    try {
        console.log("1. Checking Documents Folder...");
        const docs = await loadAllDocuments();
        console.log(`   Found ${docs.length} raw documents.`);

        docs.forEach(d => {
            console.log(`   - File: ${d.metadata?.source} (Size: ${d.pageContent.length} chars)`);
            console.log(`     Preview: ${d.pageContent.substring(0, 50)}...`);
        });

        if (docs.length === 0) {
            console.error("   CRITICAL: No documents found! Check path.");
            return;
        }

        console.log("\n2. Testing Splitter...");
        const splitter = new RecursiveCharacterTextSplitter({
            chunkSize: 1000,
            chunkOverlap: 200,
        });
        const chunks = await splitter.splitDocuments(docs);
        console.log(`   Split into ${chunks.length} chunks.`);

        // Check if "magang" exists in any chunk
        const magangChunks = chunks.filter(c => c.pageContent.toLowerCase().includes('magang'));
        console.log(`   Chunks containing 'magang': ${magangChunks.length}`);

        if (magangChunks.length > 0) {
            console.log("   Example chunk with 'magang':");
            console.log(magangChunks[0].pageContent.substring(0, 200));
        } else {
            console.error("   CRITICAL: Term 'magang' NOT FOUND in any document chunk!");
        }

        console.log("\n=== DIAGNOSTIC END ===");

    } catch (e) {
        console.error("Diagnostic Failed:", e);
    }
}

runDiagnosis();
