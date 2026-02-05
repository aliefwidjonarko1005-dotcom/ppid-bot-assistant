import { app, BrowserWindow, ipcMain, Notification, Tray, Menu, nativeImage, shell, dialog } from 'electron';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { fork, spawn } from 'child_process';
import { promises as fs } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Intelligent Data Path
const isDev = !app.isPackaged;
const DATA_DIR = isDev
    ? join(__dirname, 'data')
    : join(process.resourcesPath, 'data');
console.log('App running in:', isDev ? 'DEV' : 'PROD');
console.log('DATA_DIR set to:', DATA_DIR);

let mainWindow = null;
let tray = null;
let botProcess = null;

/**
 * Create main application window
 */
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 900,
        minHeight: 600,
        webPreferences: {
            preload: join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
        icon: join(__dirname, 'assets', 'icon.png'),
        title: 'PPID Bot Assistant',
        show: false,
    });

    mainWindow.loadFile(join(__dirname, 'ui', 'index.html'));

    // Open external links in default browser (Chrome/Edge)
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith('https:') || url.startsWith('http:')) {
            shell.openExternal(url);
            return { action: 'deny' };
        }
        return { action: 'allow' };
    });

    // Show when ready
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    // Minimize to tray instead of close
    mainWindow.on('close', (event) => {
        if (!app.isQuitting) {
            event.preventDefault();
            mainWindow.hide();
        }
    });
}

/**
 * Create system tray
 */
function createTray() {
    const iconPath = join(__dirname, 'assets', 'icon.png');

    // Create a simple icon if file doesn't exist
    let icon;
    try {
        icon = nativeImage.createFromPath(iconPath);
    } catch {
        icon = nativeImage.createEmpty();
    }

    tray = new Tray(icon);

    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'Buka Dashboard',
            click: () => mainWindow.show()
        },
        { type: 'separator' },
        {
            label: 'Keluar',
            click: () => {
                app.isQuitting = true;
                stopBot();
                app.quit();
            }
        }
    ]);

    tray.setToolTip('PPID Bot Assistant');
    tray.setContextMenu(contextMenu);

    tray.on('double-click', () => {
        mainWindow.show();
    });
}

/**
 * Start bot process using SYSTEM Node.js (not Electron's bundled one)
 */
function startBot() {
    if (botProcess) {
        console.log('Bot already running');
        return;
    }

    // Determine path based on run mode
    const botScript = join(__dirname, 'src', 'bot-runner.js');

    // Use 'node' from system PATH
    // User must have Node.js installed
    const nodePath = 'node';

    console.log(`Starting bot from: ${botScript}`);
    console.log(`DATA_PATH env: ${DATA_DIR}`);

    botProcess = spawn(nodePath, [botScript], {
        cwd: __dirname, // Execution CWD is app root (where package.json/main.js is)
        stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
        env: {
            ...process.env,
            NODE_ENV: app.isPackaged ? 'production' : 'development',
            DATA_PATH: DATA_DIR
        }
    });

    // CAPTURE STDERR (Critical for debugging crashes)
    botProcess.stderr.on('data', (data) => {
        const err = data.toString();

        // ABSOLUTE FILTER for warnings/reconnects
        if (err.includes('[WARN]') ||
            err.includes('Reconnecting') ||
            err.includes('Connection Closed') ||
            err.includes('Timed Out') ||
            err.includes('428') ||
            err.includes('408')) {
            console.log(`[BOT WARN SILENCED] ${err}`);
            return;
        }

        console.error(`[BOT ERR] ${err}`);
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('bot-error', err);
    });

    // CAPTURE STDOUT (For logs)
    botProcess.stdout.on('data', (data) => {
        console.log(`[BOT OUT] ${data}`);
    });

    // HANDLE EXIT
    botProcess.on('exit', (code) => {
        console.log(`Bot process exited with code ${code}`);
        botProcess = null;
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('bot-status', 'stopped');
    });

    // LISTEN FOR IPC MESSAGES FROM CHILD (Notifications/QR)
    botProcess.on('message', (msg) => {
        if (msg.type === 'qr') {
            if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('qr-code', msg.qr);
        } else if (msg.type === 'status') {
            if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('bot-status', msg.status);
        } else if (msg.type === 'log') {
            if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('bot-log', msg.data);
        }
        // [FEATURE] Windows Notification
        else if (msg.type === 'notification') {
            console.log(`[NOTIF] ${msg.title}: ${msg.body}`);
            if (Notification.isSupported()) {
                new Notification({
                    title: msg.title || 'PPID Bot',
                    body: msg.body || 'Pesan Baru',
                    icon: join(__dirname, 'assets/icon.png')
                }).show();
            }
        }
    });
}

/**
 * Stop bot process
 */
function stopBot() {
    if (botProcess) {
        botProcess.kill();
        botProcess = null;
    }
}

/**
 * Show desktop notification
 */
function showNotification(title, body) {
    if (Notification.isSupported()) {
        const notification = new Notification({
            title: title,
            body: body,
            icon: join(__dirname, 'assets', 'icon.png'),
        });

        notification.on('click', () => {
            mainWindow.show();
            mainWindow.focus();
        });

        notification.show();
    }
}

// IPC Handlers
ipcMain.handle('start-bot', () => {
    startBot();
    return { success: true };
});

ipcMain.handle('stop-bot', () => {
    stopBot();
    return { success: true };
});

ipcMain.handle('get-bot-status', () => {
    return { running: botProcess !== null };
});

ipcMain.handle('send-manual-reply', async (event, { chatId, message, media }) => {
    if (botProcess) {
        botProcess.send({ type: 'manual-reply', chatId, message, media });
        return { success: true };
    }
    return { success: false, error: 'Bot not running' };
});

// Release handover (return control to bot)
ipcMain.handle('release-handover', async (event, { chatId }) => {
    if (botProcess) {
        botProcess.send({ type: 'release-handover', chatId });
        return { success: true };
    }
    return { success: false, error: 'Bot not running' };
});

// Internship Data Handlers
ipcMain.handle('get-internship-data', async () => {
    try {
        const filePath = join(DATA_DIR, 'internships.json');
        const data = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') return []; // Return empty if file doesn't exist yet
        return { error: error.message };
    }
});

ipcMain.handle('save-internship-data', async (event, data) => {
    try {
        const filePath = join(DATA_DIR, 'internships.json');
        await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('reindex-documents', async () => {
    // Determine path based on run mode
    const isProd = app.isPackaged;
    const baseDir = isProd ? process.resourcesPath : __dirname;
    const scriptPath = join(baseDir, 'scripts', 'ingestDocs.js');

    // Use spawn 'node' instead of fork to use System Node
    const ingestProcess = spawn('node', [scriptPath], {
        cwd: baseDir,
        stdio: 'ignore' // or inherit if debugging needed
    });

    return new Promise((resolve) => {
        ingestProcess.on('exit', (code) => {
            resolve({ success: code === 0 });
        });

        ingestProcess.on('error', (err) => {
            console.error('Ingest error:', err);
            resolve({ success: false, error: err.message });
        });
    });
});

// Generate potential questions from documents using AI
ipcMain.handle('generate-questions', async () => {
    try {
        const { queryRAG, isVectorStoreReady } = await import('./src/rag/retriever.js');
        const { testQuery } = await import('./src/ai/ollama.js');
        const fs = await import('fs/promises');

        if (!await isVectorStoreReady()) {
            return { success: false, error: 'Vector store not ready' };
        }

        // Get a sample of document content
        const sampleContext = await queryRAG('apa saja layanan yang tersedia');

        if (!sampleContext) {
            return { success: true, questions: [] };
        }

        // Ask AI to generate potential questions
        const prompt = `Berdasarkan informasi berikut, buatlah 5 pertanyaan yang mungkin ditanyakan oleh masyarakat. Format: satu pertanyaan per baris, tanpa nomor.

Informasi:
${sampleContext.slice(0, 1500)}

Pertanyaan yang mungkin:`;

        const response = await testQuery(prompt, '');

        // Parse questions from response
        const questions = response.split('\n')
            .map(q => q.trim())
            .filter(q => q && q.length > 10 && q.includes('?'));

        // Save to knowledge gaps file for review
        const gapsPath = join(__dirname, 'data', 'knowledge_gaps.json');
        let gaps = [];
        try {
            const data = await fs.readFile(gapsPath, 'utf-8');
            gaps = JSON.parse(data);
        } catch { /* File doesn't exist */ }

        // Add new questions (avoid duplicates)
        for (const q of questions.slice(0, 5)) {
            if (!gaps.some(g => g.question === q)) {
                gaps.push({
                    question: q,
                    chatId: 'auto-generated',
                    contact: 'AI Analysis',
                    timestamp: new Date().toISOString()
                });
            }
        }

        await fs.mkdir(join(__dirname, 'data'), { recursive: true });
        await fs.writeFile(gapsPath, JSON.stringify(gaps, null, 2));

        return { success: true, questions };
    } catch (error) {
        return { success: false, error: error.message };
    }
});



// Custom IPC Handlers
ipcMain.handle('logout-bot', async () => {
    const fs = await import('fs/promises');
    const sessionPath = join(__dirname, 'data', 'wwebjs_auth');

    console.log('Logout requested. Session path:', sessionPath);

    try {
        // FIRST: Stop the bot process completely
        if (botProcess) {
            console.log('Killing bot process...');
            botProcess.kill('SIGKILL');
            botProcess = null;
            // Wait for process to fully terminate
            await new Promise(r => setTimeout(r, 2000));
        }

        // THEN: Delete session folder to force QR re-scan
        console.log('Deleting session folder...');
        try {
            await fs.rm(sessionPath, { recursive: true, force: true });
            console.log('Session folder deleted successfully');
        } catch (e) {
            console.log('Session folder deletion error:', e.message);
        }

        // Verify deletion
        try {
            await fs.access(sessionPath);
            console.log('WARNING: Session folder still exists!');
        } catch {
            console.log('CONFIRMED: Session folder deleted');
        }

        // Send UI update
        if (mainWindow) {
            mainWindow.webContents.send('bot-status', { running: false, loggedOut: true });
        }

        return { success: true, message: 'Logged out. Please start bot and scan QR.' };
    } catch (error) {
        console.error('Logout error:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('get-survey-stats', async () => {
    // If bot not running, try to return empty or cached
    if (botProcess) {
        botProcess.send({ type: 'get-survey-stats' });
        // We can't await reply easily here in simple IPC, 
        // rely on 'survey-stats' event being sent back
        return { pending: true };
    }
    return { success: false, error: 'Bot not running' };
});

// Get list of ingested documents
ipcMain.handle('get-ingested-docs', async () => {
    try {
        const { getIngestedFilesList } = await import('./src/rag/loader.js');
        const files = await getIngestedFilesList();
        return { success: true, files };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Get knowledge gaps (unanswered questions)
ipcMain.handle('get-knowledge-gaps', async () => {
    try {
        const fs = await import('fs/promises');
        const gapsPath = join(__dirname, 'data', 'knowledge_gaps.json');
        const data = await fs.readFile(gapsPath, 'utf-8');
        return { success: true, gaps: JSON.parse(data) };
    } catch (error) {
        // File doesn't exist = no gaps yet
        return { success: true, gaps: [] };
    }
});

// Clear a knowledge gap
ipcMain.handle('clear-knowledge-gap', async (event, { question }) => {
    try {
        const fs = await import('fs/promises');
        const gapsPath = join(__dirname, 'data', 'knowledge_gaps.json');
        const data = await fs.readFile(gapsPath, 'utf-8');
        let gaps = JSON.parse(data);
        gaps = gaps.filter(g => g.question !== question);
        await fs.writeFile(gapsPath, JSON.stringify(gaps, null, 2));
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// TEST PROMPT (Live Training)
ipcMain.handle('test-prompt', async (event, { query }) => {
    try {
        if (!botProcess) throw new Error("Bot belum dinyalakan. Klik Start Bot.");

        // We need to implement a request/response mechanism via IPC
        // This is tricky because IPC is async unidirectional by default
        // Solution: Send message to bot, bot replies with event, we wrap in promise

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                botProcess.removeListener('message', messageHandler);
                reject(new Error("Timeout waiting for AI response"));
            }, 30000);

            const messageHandler = (msg) => {
                if (msg.type === 'test-prompt-response') {
                    clearTimeout(timeout);
                    botProcess.removeListener('message', messageHandler);
                    // Match the format expected by app.js: result.success, result.response
                    resolve({ success: true, response: msg.text });
                }
            };

            botProcess.on('message', messageHandler);

            botProcess.send({ type: 'test-prompt', text: query });
        });
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// TRAIN AI (Add Knowledge)
ipcMain.handle('train-ai', async (event, { question, answer }) => {
    try {
        if (!botProcess) throw new Error("Bot belum dinyalakan. Klik Start Bot.");

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                botProcess.removeListener('message', messageHandler);
                reject(new Error("Timeout waiting for training"));
            }, 30000);

            const messageHandler = (msg) => {
                if (msg.type === 'train-ai-response') {
                    clearTimeout(timeout);
                    botProcess.removeListener('message', messageHandler);
                    resolve({ success: msg.success, error: msg.error });
                }
            };

            botProcess.on('message', messageHandler);

            botProcess.send({ type: 'train-ai', question, answer });
        });
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Save Settings
ipcMain.handle('get-settings', async () => {
    try {
        const fs = await import('fs/promises');
        const settingsPath = join(DATA_DIR, 'settings.json');
        const data = await fs.readFile(settingsPath, 'utf-8');
        return { success: true, settings: JSON.parse(data) };
    } catch (error) {
        return { success: true, settings: {} }; // Return empty if not found
    }
});

ipcMain.handle('save-settings', async (event, settings) => {
    try {
        const fs = await import('fs/promises');
        const settingsPath = join(DATA_DIR, 'settings.json');

        // Ensure data dir exists
        await fs.mkdir(DATA_DIR, { recursive: true });

        // Read existing or create new
        let current = {};
        try {
            const data = await fs.readFile(settingsPath, 'utf-8');
            current = JSON.parse(data);
        } catch { }

        // Merge
        const newSettings = { ...current, ...settings };
        await fs.writeFile(settingsPath, JSON.stringify(newSettings, null, 2));

        // Notify bot process if running
        if (botProcess) {
            botProcess.send({ type: 'settings-update', settings: newSettings });
        }

        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Evaluations (Feedback) Handlers
ipcMain.handle('get-evaluations', async () => {
    try {
        const fs = await import('fs/promises');
        const evalPath = join(DATA_DIR, 'evaluations.json');
        const data = await fs.readFile(evalPath, 'utf-8');
        return { success: true, evaluations: JSON.parse(data) };
    } catch (error) {
        return { success: true, evaluations: [] }; // No file = no evals
    }
});

ipcMain.handle('resolve-evaluation', async (event, { id, action }) => {
    try {
        const fs = await import('fs/promises');
        const evalPath = join(DATA_DIR, 'evaluations.json');
        let evals = JSON.parse(await fs.readFile(evalPath, 'utf-8'));

        const idx = evals.findIndex(e => e.id === id);
        if (idx !== -1) {
            evals[idx].status = action; // 'trained' or 'ignored'
            await fs.writeFile(evalPath, JSON.stringify(evals, null, 2));
            return { success: true };
        }
        return { success: false, error: 'ID not found' };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Recap Handlers
ipcMain.handle('get-recaps', async () => {
    try {
        const recapPath = join(DATA_DIR, 'recaps.json');
        const data = await fs.readFile(recapPath, 'utf-8');
        return { success: true, recaps: JSON.parse(data) };
    } catch (error) {
        return { success: true, recaps: [] }; // No file = no recaps
    }
});

ipcMain.handle('export-recaps-csv', async () => {
    try {
        const recapPath = join(DATA_DIR, 'recaps.json');
        let recaps = [];
        try {
            const data = await fs.readFile(recapPath, 'utf-8');
            recaps = JSON.parse(data);
        } catch { }

        if (!recaps || recaps.length === 0) return { success: false, error: 'Tidak ada data rekap' };

        // CSV Generation
        const headers = ['Timestamp', 'Nama Customer', 'Kategori', 'Status', 'Rating', 'Evaluasi AI', 'Ringkasan', 'Chat ID'];
        const clean = (text) => text ? `"${String(text).replace(/"/g, '""')}"` : '""';

        let csv = headers.join(',') + '\n';

        csv += recaps.map(r => {
            return [
                clean(new Date(r.timestamp).toLocaleString('id-ID')),
                clean(r.customerName),
                clean(r.category),
                clean(r.status),
                clean(r.rating || ''),
                clean(r.evaluation),
                clean(r.summary),
                clean(r.chatId)
            ].join(',');
        }).join('\n');

        // Save Dialog
        const { filePath } = await dialog.showSaveDialog(mainWindow, {
            title: 'Export Data Recap',
            defaultPath: `recap_ppid_${Date.now()}.csv`,
            filters: [{ name: 'CSV File', extensions: ['csv'] }]
        });

        if (filePath) {
            await fs.writeFile(filePath, csv, 'utf-8');
            return { success: true, path: filePath };
        }
        return { success: false, error: 'Dibatalkan' };

    } catch (error) {
        return { success: false, error: error.message };
    }
});

// App lifecycle
app.whenReady().then(() => {
    createWindow();
    createTray();
});

app.on('window-all-closed', () => {
    // Don't quit on macOS
    if (process.platform !== 'darwin') {
        // Keep running in tray
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

app.on('before-quit', () => {
    app.isQuitting = true;
    stopBot();
});
