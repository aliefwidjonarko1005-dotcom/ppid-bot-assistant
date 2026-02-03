
import dotenv from 'dotenv';
dotenv.config();

const apiKey = process.env.GROQ_API_KEY;
console.log("Testing Raw Fetch to Groq (Llama 3.3)...");

async function testGroqRaw() {
    const url = "https://api.groq.com/openai/v1/chat/completions";

    // Model baru yang valid per Jan 2026/Late 2025
    const modelName = "llama-3.3-70b-versatile";

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messages: [{ role: "user", content: "Halo, siapa kamu? Jawab singkat saja." }],
                model: modelName
            })
        });

        const data = await response.json();

        if (response.ok) {
            console.log("SUCCESS!");
            console.log("Response:", data.choices[0].message.content);
            return true;
        } else {
            console.log("FAILED RESPONSE:", JSON.stringify(data, null, 2));
            return false;
        }

    } catch (e) {
        console.error("NETWORK ERROR:", e.message);
        return false;
    }
}

testGroqRaw();
