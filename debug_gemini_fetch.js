
import dotenv from 'dotenv';
dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
console.log("Testing Raw Fetch to Gemini...");

async function testRaw(model) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    console.log(`Endpoint: ${url.replace(apiKey, 'HIDDEN')}`);

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: "Halo" }]
                }]
            })
        });

        console.log(`Status: ${response.status} ${response.statusText}`);
        const data = await response.json();

        if (response.ok) {
            console.log("SUCCESS!");
            console.log("Response:", data.candidates[0].content.parts[0].text);
        } else {
            console.log("FAILED RESPONSE:", JSON.stringify(data, null, 2));
        }

    } catch (e) {
        console.error("NETWORK ERROR:", e.message);
    }
}

async function run() {
    await testRaw("gemini-1.5-flash");
    await testRaw("gemini-pro");
}

run();
