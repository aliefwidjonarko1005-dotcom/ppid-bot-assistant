
import { ChatGroq } from "@langchain/groq";
import dotenv from 'dotenv';
dotenv.config();

console.log("=== GROQ DIAGNOSTIC ===");
const apiKey = process.env.GROQ_API_KEY;
console.log(`API Key present: ${!!apiKey}`);

async function testGroq() {
    try {
        console.log("Testing Groq (Llama-3-70b)...");
        const model = new ChatGroq({
            apiKey: apiKey,
            modelName: "llama3-70b-8192", // High intelligence model
        });

        const res = await model.invoke("Halo, tes kecerdasan. Jawab singkat.");
        console.log("SUCCESS! Response:", res.content);
        return true;
    } catch (e) {
        console.error("FAILED:", e.message);
        return false;
    }
}

testGroq();
