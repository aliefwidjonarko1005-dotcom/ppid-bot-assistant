
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
dotenv.config();

console.log("=== GEMINI DIAGNOSTIC ===");
const apiKey = process.env.GEMINI_API_KEY;
console.log(`API Key present: ${!!apiKey}`);
if (apiKey) console.log(`API Key preview: ${apiKey.substring(0, 5)}...`);

async function testModel(modelName) {
    console.log(`\nTesting Model: ${modelName}...`);
    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: modelName });

        const result = await model.generateContent("Halo, tes koneksi 123.");
        const response = result.response;
        console.log(`SUCCESS! Response: ${response.text()}`);
        return true;
    } catch (error) {
        console.error(`FAILED (${modelName}):`);
        console.error(error.message);
        if (error.message.includes('API_KEY_INVALID')) console.error("-> CHECK YOUR API KEY!");
        if (error.message.includes('NOT_FOUND')) console.error("-> MODEL NAME MIGHT BE WRONG");
        return false;
    }
}

async function run() {
    // Test 1.5 Pro (used in app)
    // await testModel("gemini-1.5-pro");

    // Test 1.5 Flash 
    await testModel("gemini-1.5-flash");

    // Test 1.5 Flash Latest
    await testModel("gemini-1.5-flash-latest");

    // Test 1.0 Pro (Standard)
    await testModel("gemini-pro");
}

run();
