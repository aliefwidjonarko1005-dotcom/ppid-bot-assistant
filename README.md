# PPID Bot Assistant

🤖 WhatsApp Bot dengan AI lokal untuk layanan PPID (Pejabat Pengelola Informasi dan Dokumentasi).

## Fitur

- **AI Lokal** - Menggunakan Ollama, tidak perlu internet setelah setup
- **Dashboard GUI** - Antarmuka visual yang mudah digunakan
- **Chat Monitor** - Pantau percakapan real-time
- **Human Takeover** - Ambil alih percakapan jika bot tidak yakin
- **Training UI** - Import dokumen PDF untuk melatih bot
- **Auto Response** - Bot menjawab otomatis dengan nada ramah

## Requirements

- Windows 10/11
- Node.js 18+
- Ollama

## Instalasi

### Cara Mudah (Recommended)

1. **Download dan Install Node.js** dari https://nodejs.org
2. **Download dan Install Ollama** dari https://ollama.com/download
3. **Klik 2x file `Setup.bat`** - otomatis install dependencies dan model AI
4. Setelah selesai, klik **`Buka Dashboard.bat`** untuk membuka aplikasi

### Manual Setup

```bash
# Install dependencies
npm install

# Download model AI
ollama pull llama3.2:3b
ollama pull nomic-embed-text
ollama create ppid-assistant -f Modelfile.ppid

# Index dokumen (opsional)
npm run ingest

# Jalankan dashboard
npm start
```

## Penggunaan

### Mode Dashboard (GUI)
```bash
npm start
# atau klik "Buka Dashboard.bat"
```

### Mode Terminal
```bash
npm run bot
# atau klik "Jalankan Bot.bat"
```

## Menambah Dokumen

1. Masukkan file PDF ke folder `dokumen_ppid/`
2. Jalankan `npm run ingest` atau klik "Re-index" di dashboard
3. Bot akan bisa menjawab berdasarkan dokumen tersebut

## Struktur Folder

```
📁 PPID Bot Assistant/
├── 📄 Setup.bat              # Script instalasi
├── 📄 Buka Dashboard.bat     # Jalankan GUI
├── 📄 Jalankan Bot.bat       # Jalankan terminal mode
├── 📄 main.js                # Electron main process
├── 📁 ui/                    # Dashboard GUI
├── 📁 src/                   # Source code bot
├── 📁 dokumen_ppid/          # Dokumen PDF
└── 📁 data/                  # Session & vector store
```

## Troubleshooting

### Bot tidak merespon
- Pastikan Ollama berjalan (`ollama serve`)
- Cek koneksi internet saat setup pertama

### QR code tidak muncul
- Gunakan hotspot HP jika WiFi kantor memblokir
- Hapus folder `data/wwebjs_auth` dan coba lagi

### Respon lambat
- Model AI membutuhkan beberapa detik untuk generate
- Pastikan tidak ada aplikasi berat lain berjalan

## License

MIT
