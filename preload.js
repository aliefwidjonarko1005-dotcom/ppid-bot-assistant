const { contextBridge, ipcRenderer } = require('electron');

// Expose safe APIs to renderer
contextBridge.exposeInMainWorld('ppidBot', {
    // Bot control
    startBot: () => ipcRenderer.invoke('start-bot'),
    stopBot: () => ipcRenderer.invoke('stop-bot'),
    getBotStatus: () => ipcRenderer.invoke('get-bot-status'),

    // Manual reply
    // Manual reply (supports text & media)
    sendManualReply: (chatId, data) =>
        ipcRenderer.invoke('send-manual-reply', { chatId, ...data }),

    // Documents
    reindexDocuments: () => ipcRenderer.invoke('reindex-documents'),

    // Test prompt directly (for Training UI)
    testPrompt: (query) => ipcRenderer.invoke('test-prompt', { query }),

    // Event listeners
    onBotMessage: (callback) => {
        ipcRenderer.on('bot-message', (event, data) => callback(data));
    },
    onBotLog: (callback) => {
        ipcRenderer.on('bot-log', (event, data) => callback(data));
    },
    onBotError: (callback) => {
        ipcRenderer.on('bot-error', (event, data) => callback(data));
    },
    onBotStatus: (callback) => {
        ipcRenderer.on('bot-status', (event, data) => callback(data));
    },

    // Logout
    logoutBot: () => ipcRenderer.invoke('logout-bot'),

    // Survey stats
    getSurveyStats: () => ipcRenderer.invoke('get-survey-stats'),
    onSurveyStats: (callback) => {
        ipcRenderer.on('survey-stats', (event, data) => callback(data));
    },

    // Handover Request (CS)
    onHandoverRequest: (callback) => {
        ipcRenderer.on('handover-request', (event, data) => callback(data));
    },

    // Release handover (return to bot auto-reply)
    releaseHandover: (chatId) => ipcRenderer.invoke('release-handover', { chatId }),

    // Document List and Knowledge Gaps
    getIngestedDocs: () => ipcRenderer.invoke('get-ingested-docs'),
    getKnowledgeGaps: () => ipcRenderer.invoke('get-knowledge-gaps'),
    clearKnowledgeGap: (question) => ipcRenderer.invoke('clear-knowledge-gap', { question }),
    generateQuestions: () => ipcRenderer.invoke('generate-questions'),
    trainAI: (question, answer) => ipcRenderer.invoke('train-ai', { question, answer }),

    // Evaluations
    getEvaluations: () => ipcRenderer.invoke('get-evaluations'),
    resolveEvaluation: (id, action) => ipcRenderer.invoke('resolve-evaluation', { id, action }),

    // Recaps
    getRecaps: () => ipcRenderer.invoke('get-recaps'),
    exportRecapsCsv: () => ipcRenderer.invoke('export-recaps-csv'),

    // Internship Data
    getInternships: () => ipcRenderer.invoke('get-internship-data'),
    saveInternships: (data) => ipcRenderer.invoke('save-internship-data', data),

    // Settings
    getSettings: () => ipcRenderer.invoke('get-settings'),
    saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),

    // Remove listeners
    removeAllListeners: () => {
        ipcRenderer.removeAllListeners('bot-message');
        ipcRenderer.removeAllListeners('bot-log');
        ipcRenderer.removeAllListeners('bot-error');
        ipcRenderer.removeAllListeners('bot-status');
        ipcRenderer.removeAllListeners('survey-stats');
    }
});
