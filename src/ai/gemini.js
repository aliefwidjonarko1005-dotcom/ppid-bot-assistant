
import { GoogleGenerativeAI } from '@google/generative-ai';
import logger from '../utils/logger.js';
import dotenv from 'dotenv';
dotenv.config();

let genAI = null;
let model = null;
let dynamicApiKey = null;

// Memory untuk nama customer (compat dengan ollama.js)
const customerNames = new Map();

export function setApiKey(key) {
    if (!key) return;
    dynamicApiKey = key;
    genAI = null; // Force re-init
    model = null;
    logger.info('Gemini API Key updated dynamically');
}

/**
 * Initialize Gemini
 */
export function getAIInstance() {
    if (!genAI) {
        // Try env first, then dynamic config
        const apiKey = process.env.GEMINI_API_KEY || dynamicApiKey;
        if (!apiKey) {
            logger.warn('Gemini API Key missing! Waiting for configuration...');
            return null;
        }
        genAI = new GoogleGenerativeAI(apiKey);
        // Switching to Flash model for better stability/speed on free tier
        model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        logger.info('✓ Gemini Flash initialized');
    }
    return model;
}

/**
 * Check if AI is available
 */
export async function isGeminiAvailable() {
    return !!process.env.GEMINI_API_KEY;
}

/**
 * Compatibility alias for code expecting isOllamaAvailable
 */
export const isOllamaAvailable = isGeminiAvailable;

/**
 * Generate Response
 */
export async function generateResponse(query, context = '', chatId = 'test', humorLevel = 0) {
    try {
        const ai = getAIInstance();
        if (!ai) throw new Error("Gemini API Key not configured");

        // HUMOR LOGIC - DYNAMIC PERSONA
        let humorInstruction = "";
        if (humorLevel > 0) {
            if (humorLevel <= 30) {
                humorInstruction = "- Nada Bicara: Ramah, sedikit santai, namun tetap profesional 100%.";
            } else if (humorLevel <= 70) {
                humorInstruction = "- Nada Bicara: Santai dan bersahabat (Casual). Boleh gunakan sapaan ringan. Jika user bercanda, respon dengan humor sopan.";
            } else {
                humorInstruction = "- Nada Bicara: SANGAT SANTAI & LUCU. Jadilah teman ngobrol yang asik. Jika user merayu atau bercanda (misal 'sayang aku ga?'), balas dengan gombalan lucu (misal 'Sayang banget dong!'). Tetap jawab pertanyaan teknis dengan benar tapi gaya bahasa gaul.";
            }
        } else {
            humorInstruction = "- Nada Bicara: Formal, baku, objektif, dan sangat profesional (Standar Pemerintahan).";
        }

        // System Prompt with stricter reasoning instructions
        const systemPrompt = `Anda adalah asisten cerdas layanan informasi publik PPID BRIDA Provinsi Jawa Tengah.
        
        [IDENTITAS & GAYA BICARA]
        - Nama Anda: "PPID Assistant"
        ${humorInstruction}
        - Empati: Tunjukkan kepedulian. Jangan kaku seperti robot.

INSTRUKSI UTAMA:
1. Tugas Anda adalah menjawab pertanyaan masyarakat berdasarkan [SUMBER INFORMASI UTAMA] di bawah.
2. Jawablah dengan SANGAT NATURAL, PROFESIONAL, dan MEMBANTU.
3. JANGAN kaku. Gunakan penalaran (reasoning) cerdas.
4. Jika informasi ada di konteks (walau keyword beda dikit), SAJIKAN JAWABANNYA. Jangan bilang tidak tahu.
5. Jika informasi sama sekali tidak ada, berikan info umum yang relevan dan tawarkan hubungi CS.

PANDUAN KONTEKS:
- [SUMBER INFORMASI UTAMA] adalah kebenaran mutlak.
- Jika ada [CONTOH PERCAKAPAN], ikuti gaya bahasa tersebut.

INFORMASI DINTARA:
- Website: brida.jatengprov.go.id
- Email: brida@jatengprov.go.id
- Alamat: Jl. Imam Bonjol No.185 Semarang
`;

        let prompt;
        if (context && context.trim()) {
            prompt = `${systemPrompt}\n\n[SUMBER INFORMASI UTAMA]:\n${context}\n\nUser: ${query}\nAssistant:`;
        } else {
            prompt = `${systemPrompt}\n\n[SUMBER INFORMASI UTAMA]: (Tidak ada konteks spesifik, gunakan pengetahuan umum layanan publik)\n\nUser: ${query}\nAssistant:`;
        }

        logger.debug(`Sending to Gemini (${query.length} chars)...`);

        const result = await ai.generateContent(prompt);
        const response = result.response;
        const text = response.text();

        return text.trim();

    } catch (error) {
        logger.error('Gemini Error:', error.message);
        return "Maaf, sistem AI sedang sibuk. Silakan coba sesaat lagi.";
    }
}

/**
 * Get Customer Name
 */
export function getCustomerName(chatId) {
    return customerNames.get(chatId) || 'Kak';
}

export function setCustomerName(chatId, name) {
    customerNames.set(chatId, name);
}

/**
 * Test Connection
 */
export async function testGemini() {
    logger.info('Testing Gemini connection...');
    const available = await isGeminiAvailable();
    if (!available) throw new Error('Gemini API Key missing');
    getAIInstance();
    return true;
}

/**
 * Alias for testOllama
 */
export const testOllama = testGemini;

/**
 * Direct test query
 */
export async function testQuery(query, context = '') {
    return await generateResponse(query, context, null);
}

export default {
    getAIInstance,
    isGeminiAvailable,
    isOllamaAvailable,
    generateResponse,
    testGemini,
    testOllama,
    testQuery,
    getCustomerName,
    setCustomerName,
    setApiKey
};
