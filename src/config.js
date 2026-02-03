import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = resolve(__dirname, '..');

export const config = {
  // Ollama Settings
  ollama: {
    baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
    model: process.env.OLLAMA_MODEL || 'ppid-assistant',
    embedModel: process.env.OLLAMA_EMBED_MODEL || 'nomic-embed-text',
  },

  // Rate Limiting - faster response
  rateLimit: {
    minDelay: parseInt(process.env.MIN_REPLY_DELAY) || 100,
    maxDelay: parseInt(process.env.MAX_REPLY_DELAY) || 500,
  },

  // RAG Settings - optimized
  rag: {
    docsFolder: resolve(ROOT_DIR, process.env.DOCS_FOLDER || './dokumen_ppid'),
    vectorStorePath: resolve(ROOT_DIR, process.env.VECTORSTORE_PATH || './data/vectorstore'),
    topK: 2, // No need for many chunks if they are huge
    chunkSize: 15000, // HUGE CHUNK to fit entire guide
    chunkOverlap: 500,
  },

  // Personality Settings
  personality: {
    humorLevel: 0, // 0-100
    temperature: 0.6
  },

  // WhatsApp Settings
  whatsapp: {
    sessionPath: resolve(ROOT_DIR, process.env.WA_SESSION_PATH || './data/wwebjs_auth'),
  },

  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',

  // Paths
  paths: {
    root: ROOT_DIR,
  },

  // Messages - friendly tone
  messages: {
    welcome: 'Hai Kak! 👋 Ada yang bisa saya bantu tentang layanan PPID?',

    mediaNotSupported: 'Hai Kak, maaf ya saya belum bisa baca gambar atau file. Coba ketik pertanyaannya dalam bentuk teks ya! 😊',

    technicalError: 'Aduh Kak, maaf banget lagi ada gangguan teknis. Coba lagi beberapa saat ya, atau langsung hubungi kantor PPID aja. 🙏',

    noContext: 'Wah, untuk itu saya kurang yakin Kak. Coba tanya langsung ke kantor PPID ya biar dapat info yang pasti.',
  },
};

export default config;
