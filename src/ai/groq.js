
import dotenv from 'dotenv';
import logger from '../utils/logger.js';
dotenv.config();

// Memory untuk nama customer
const customerNames = new Map();

export function getCustomerName(chatId) {
    return customerNames.get(chatId) || null;
}

// Dynamic configuration
let dynamicApiKey = null;

export function setApiKey(key) {
    if (!key) return;
    dynamicApiKey = key;
    logger.info('Groq API Key updated dynamically');
}

/**
 * Check availability
 */
export async function isGroqAvailable() {
    return !!(process.env.GROQ_API_KEY || dynamicApiKey);
}
export const isOllamaAvailable = isGroqAvailable;

/**
 * Generate Response using Groq API (Raw Fetch)
 * Model: llama-3.3-70b-versatile (FAST & SMART)
 * Added: humorLevel (0-100) for personality adjustment
 */
export async function generateResponse(query, context = '', chatId = 'test', humorLevel = 0) {
    const apiKey = process.env.GROQ_API_KEY || dynamicApiKey;
    if (!apiKey) {
        logger.error('GROQ API Key missing!');
        return "Maaf, konfigurasi AI (Groq) belum lengkap. Mohon set API Key.";
    }

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

    // System Prompt Human-Like + Strict Formatting
    // System Prompt: Enhanced for Expert, Friendly, and Educative Persona
    const systemPrompt = `PERAN ANDA:
    Anda adalah "PPID Assistant", seorang Senior Customer Service & Konsultan Publik untuk BRIDA Provinsi Jawa Tengah.
    Anda dikenal sangat ahli, ramah, sabar, dan memiliki kemampuan menjelaskan hal teknis agar mudah dipahami masyarakat awam.

    [GAYA BICARA & KEPRIBADIAN]
    1.  **Sangat Ramah & Hangat**: Sapa pengguna dengan sopan. Gunakan kata-kata yang membuat nyaman (misal: "Baik Kak", "Tentu saja", "Senang bisa membantu").
    2.  **Ahli & Edukatif**: Jangan hanya menjawab "ya/tidak". Jelaskan ALASANNYA. Berikan konteks tambahan yang bermanfaat.
    3.  **Proaktif**: Jika jawaban membutuhkan langkah lanjut, pandu mereka step-by-step.
    4.  **Fleksibel**:
        ${humorInstruction}

    [PANDUAN FORMAT (WHATSAPP FRIENDLY)]
    - Gunakan *Tebal* untuk poin penting atau judul.
    - Gunakan _Miring_ untuk penekanan ringan.
    - Gunakan daftar (bullet points) agar mudah dibaca di HP.
    - Hindari paragraf panjang. Pecah menjadi blok-blok pendek.

    [SUMBER PENGETAHUAN UTAMA]
    Gunakan informasi berikut sebagai referensi utama menjawab pertanyaan:
    ${context || '(Gunakan pengetahuan umum layanan publik & pemerintahan)'}

    [INSTRUKSI KHUSUS]
    - Jika informasi tidak tersedia di konteks: Jawab dengan pengetahuan umum layanan publik yang logis, lalu arahkan ke kontak resmi (brida@jatengprov.go.id).
    - JANGAN PERNAH mengarang data fakual (nomor SK, tanggal, dll) yang tidak ada di konteks.
    - **PENGIRIMAN FILE**: Jika pengguna ingin mengirim berkas/proposal (magang, kerja sama, surat), informasikan bahwa mereka bisa mengirimnya **LANGSUNG ke nomor WhatsApp ini** (dalam format PDF/Gambar). Saya (Bot) bisa menerima file tersebut.
    - Selalu tawarkan bantuan lebih lanjut di akhir percakapan.

    Jawablah pertanyaan berikut dengan gaya ahli yang ramah:`;

    try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: query }
                ],
                model: "llama-3.3-70b-versatile",
                temperature: 0.7, // Agak kreatif biar natural
                max_tokens: 1024
            })
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(`Groq API Error: ${JSON.stringify(errData)}`);
        }

        const data = await response.json();
        return data.choices[0].message.content.trim();

    } catch (error) {
        logger.error('Groq Error:', error.message);
        return "Maaf, sistem sedang mengalami gangguan koneksi ke server AI. Silakan coba lagi nanti.";
    }
}

/**
 * Compatibility Helpers
 */
// Duplicate function removed

export function testOllama() {
    return isGroqAvailable();
}

export default {
    generateResponse,
    testOllama,
    isOllamaAvailable,
    getCustomerName
};
