// Using native fetch for Groq API (avoiding LangChain version conflicts)
import { Ollama } from '@langchain/community/llms/ollama';
import config from '../config.js';
import logger from '../utils/logger.js';

let aiInstance = null;
let useGroq = false;

// Memory untuk nama customer
const customerNames = new Map();

/**
 * Initialize AI - prefer Groq if API key available
 */
export function getAIInstance() {
    if (!aiInstance) {
        const groqKey = process.env.GROQ_API_KEY;

        if (groqKey) {
            // Use Groq via direct API (avoiding LangChain version conflicts)
            useGroq = true;
            aiInstance = {
                apiKey: groqKey,
                model: 'llama-3.3-70b-versatile'
            };
            logger.info('✓ Using Groq API (Llama 3.3 70B)');
        } else {
            // Fallback to local Ollama
            useGroq = false;
            aiInstance = new Ollama({
                baseUrl: config.ollama.baseUrl,
                model: config.ollama.model,
                temperature: 0.7,
                numCtx: 2048,
                numPredict: 200,
            });
            logger.info('✓ Using local Ollama');
        }
    }
    return aiInstance;
}

/**
 * Check if AI is available
 */
export async function isOllamaAvailable() {
    const groqKey = process.env.GROQ_API_KEY;
    if (groqKey) return true; // Groq is cloud, assume available

    try {
        const response = await fetch(`${config.ollama.baseUrl}/api/tags`, {
            method: 'GET',
            signal: AbortSignal.timeout(3000),
        });
        return response.ok;
    } catch (error) {
        return false;
    }
}

/**
 * Check if message is greeting
 */
function isGreeting(text) {
    const greetings = ['halo', 'hai', 'hi', 'hello', 'selamat pagi', 'selamat siang',
        'selamat sore', 'selamat malam', 'assalamualaikum', 'permisi', 'p', 'hallo'];
    const lower = text.toLowerCase().trim();
    return greetings.some(g => lower === g || lower.startsWith(g + ' ') || lower.startsWith(g + ','));
}

/**
 * Extract name from introduction
 */
function extractName(text) {
    const notNames = [
        'mau', 'ingin', 'akan', 'bisa', 'boleh', 'harus', 'perlu', 'sedang',
        'tanya', 'nanya', 'bertanya', 'tahu', 'tau', 'cari', 'mencari',
        'dari', 'yang', 'untuk', 'dengan', 'ini', 'itu', 'ada', 'tidak',
        'minta', 'mohon', 'tolong', 'bantu', 'lihat', 'cek', 'kasih',
        'adalah', 'sudah', 'belum', 'juga', 'saja', 'aja', 'dong', 'ya'
    ];

    // Patterns for name introduction - including "aku [nama]"
    const patterns = [
        /nama saya (\w+)/i,
        /panggil saya (\w+)/i,
        /saya bernama (\w+)/i,
        /perkenalkan,? saya (\w+)/i,
        /^aku (\w+)$/i,           // "aku jonar" only
        /^saya (\w+)$/i,          // "saya jonar" only
        /^ini (\w+)$/i,           // "ini jonar" only
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
            const potentialName = match[1].toLowerCase();
            if (notNames.includes(potentialName)) return null;
            return match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
        }
    }
    return null;
}

// Get/set customer name
export function getCustomerName(chatId) {
    return customerNames.get(chatId);
}

export function setCustomerName(chatId, name) {
    customerNames.set(chatId, name);
    logger.info(`Saved name: ${name}`);
}

/**
 * Time greeting
 */
function getTimeGreeting() {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 11) return 'pagi';
    if (hour >= 11 && hour < 15) return 'siang';
    if (hour >= 15 && hour < 18) return 'sore';
    return 'malam';
}

/**
 * Generate response - GPT-quality with Groq
 */
export async function generateResponse(query, context, chatId = null) {
    const ai = getAIInstance();

    // Extract name if introducing
    const extractedName = extractName(query);
    if (extractedName && chatId) {
        setCustomerName(chatId, extractedName);
    }

    const customerName = chatId ? getCustomerName(chatId) : null;

    // Handle greetings
    if (isGreeting(query)) {
        const greeting = getTimeGreeting();
        return `Selamat ${greeting}. Saya asisten layanan PPID BRIDA Jawa Tengah. Ada yang bisa saya bantu?`;
    }

    // Handle name introduction
    if (extractedName && query.split(' ').length <= 3) {
        return `Halo ${extractedName}, senang berkenalan dengan Anda. Ada yang bisa saya bantu terkait layanan informasi publik?`;
    }

    // Build prompt - clean ChatGPT-like style with Few-Shot support
    // Build prompt - clean ChatGPT-like style with Few-Shot support
    const systemPrompt = `Anda adalah asisten cerdas layanan informasi publik PPID BRIDA Provinsi Jawa Tengah.

INSTRUKSI UTAMA:
1. Analisis pertanyaan user secara cerdas. Jika [SUMBER INFORMASI UTAMA] memiliki informasi yang RELEVAN (walau tidak persis), sambungkan informasi tersebut untuk menjawab user.
2. Jawablah dengan SANGAT LENGKAP, INFORMATIF, dan SOLUTIF. Jangan pelit informasi.
3. Gunakan bahasa yang natural, luwes, dan sopan seperti Customer Service profesional senior.
4. Jika user bertanya singkat (misal: "magang"), asumsikan mereka menanyakan prosedur/syarat/info umum tentang topik tersebut.

PENTING:
- JANGAN terburu-buru bilang "Maaf tidak ada informasi".
- Lakukan penalaran (reasoning): Jika user tanya "cara", dan data ada "prosedur", itu sama. Sambungkan titik-titik informasi.
- Jika detail sangat spesifik tidak ada, berikan jawaban umum yang membantu dari konteks yang tersedia.

SUMBER KEBENARAN:
Gunakan data di [SUMBER INFORMASI UTAMA] sebagai fondasi utama.`;

    // Debug: Log context presence
    if (context && context.trim()) {
        logger.info(`RAG Context found (${context.length} chars): ${context.slice(0, 100)}...`);
    } else {
        logger.info('No RAG Context found for this query');
    }

    let fullPrompt;
    if (context && context.trim()) {
        // Increase context limit to 3000 chars to avoid cutting off long answers
        fullPrompt = `${systemPrompt}\n\n[SUMBER INFORMASI UTAMA]:\n${context.slice(0, 3000)}\n\n[PERTANYAAN USER]: ${query}\n\n[JAWABAN ANDA]:`;
    } else {
        fullPrompt = `${systemPrompt}\n\n[PERTANYAAN USER]: ${query}\n\n[JAWABAN ANDA]:`;
    }

    try {
        logger.debug('Generating response...');
        let response;

        if (useGroq) {
            // Call Groq API directly using fetch (avoiding LangChain version conflicts)
            const userContent = context ? `Referensi: ${context.slice(0, 1000)}\n\nPertanyaan: ${query}` : query;

            const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${ai.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: ai.model,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userContent }
                    ],
                    temperature: 0.7,
                    max_tokens: 300
                })
            });

            if (!groqResponse.ok) {
                throw new Error(`Groq API error: ${groqResponse.status}`);
            }

            const data = await groqResponse.json();
            response = data.choices[0]?.message?.content || 'Maaf, tidak ada respons.';
        } else {
            // Ollama uses text format
            response = await ai.invoke(fullPrompt);
        }

        return response.trim();
    } catch (error) {
        logger.error('AI error:', error.message);
        throw error;
    }
}

/**
 * Test AI connection
 */
export async function testOllama() {
    logger.info('Testing AI connection...');
    const available = await isOllamaAvailable();
    if (!available) throw new Error('AI tidak tersedia');
    getAIInstance(); // Initialize
    return true;
}

/**
 * Direct test query for Training UI
 */
export async function testQuery(query, context = '') {
    return await generateResponse(query, context, null);
}

export default {
    getAIInstance,
    isOllamaAvailable,
    generateResponse,
    testOllama,
    testQuery,
    getCustomerName,
    setCustomerName
};
