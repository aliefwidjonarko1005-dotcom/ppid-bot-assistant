// Global state
let isRunning = false;
let chats = new Map();
let alertCount = 0;
let stats = { total: 0, handled: 0, alerts: 0 };

// DOM Elements
const toggleBotBtn = document.getElementById('toggle-bot-btn');
const connectionStatus = document.getElementById('connection-status');
const qrContainer = document.getElementById('qr-container');
const logContainer = document.getElementById('log-container');
const alertBadge = document.getElementById('alert-badge');

// Global Error Handler for Packaging Debugging
window.onerror = function (msg, url, line, col, error) {
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = 'position:fixed;top:0;left:0;right:0;background:rgba(220, 38, 38, 0.9);color:white;padding:15px;z-index:99999;font-family:monospace;font-size:12px;display:flex;justify-content:space-between;align-items:center;';
    errorDiv.innerHTML = `<span><strong>JS Error:</strong> ${msg} (Line ${line})</span> <button onclick="this.parentElement.remove()" style="background:white;color:black;border:none;padding:5px 10px;cursor:pointer;">Dismiss</button>`;
    document.body.appendChild(errorDiv);
    return false;
};

// ... existing code ...

// Navigation Rail
document.querySelectorAll('.nav-icon').forEach(item => {
    item.addEventListener('click', () => {
        const viewId = item.dataset.view;
        if (!viewId) return;

        // 1. Update Rail UI
        document.querySelectorAll('.nav-icon').forEach(n => n.classList.remove('active'));
        item.classList.add('active');

        // 2. Switch Main View
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        const targetView = document.getElementById(`${viewId}-view`);
        if (targetView) targetView.classList.add('active');

        // 3. Switch Sidebar Content
        const subSidebar = document.getElementById('sub-sidebar');
        const sidebarTitle = document.getElementById('sidebar-title');
        const chatListContainer = document.getElementById('chat-list');
        const dashboardMenu = document.getElementById('dashboard-menu');

        // Reset sidebar display
        if (chatListContainer) chatListContainer.style.display = 'none';
        if (dashboardMenu) dashboardMenu.classList.remove('active');
        // Default: Show sidebar for specific views needs checking.

        // Logic specific to views
        if (viewId === 'chats') {
            if (subSidebar) subSidebar.style.display = 'flex';
            if (sidebarTitle) sidebarTitle.textContent = 'Chats';
            if (chatListContainer) chatListContainer.style.display = 'block';
        }
        else if (viewId === 'dashboard') {
            if (subSidebar) subSidebar.style.display = 'none';
        }
        else if (viewId === 'training') {
            if (subSidebar) subSidebar.style.display = 'none';
        }
        else if (viewId === 'settings') {
            if (subSidebar) subSidebar.style.display = 'none';
            loadSettingsUI(); // NEW: Load settings when opening view
        }
        else if (viewId === 'evaluations') {
            if (subSidebar) subSidebar.style.display = 'none';
            loadEvaluations();
        }
    });
});

// Toggle Bot Logic
const toggleBtns = [
    document.getElementById('toggle-bot-sidebar'),
    document.getElementById('toggle-bot-dashboard')
];

toggleBtns.forEach(btn => {
    if (btn) {
        btn.addEventListener('click', async () => {
            if (isRunning) {
                await window.ppidBot.stopBot();
                updateBotStatus(false);
            } else {
                await window.ppidBot.startBot();
                updateBotStatus(true);
            }
        });
    }
});

// Update bot status UI
function updateBotStatus(running) {
    isRunning = running;

    const statusDot = connectionStatus.querySelector('.status-dot');

    // Update all toggle buttons
    toggleBtns.forEach(btn => {
        if (!btn) return;

        if (running) {
            // Stop State
            if (btn.id === 'toggle-bot-dashboard') {
                btn.innerHTML = '⏹️ Stop Bot';
                btn.classList.add('btn-danger');
            } else {
                btn.innerHTML = '⏹️'; // Icon only for sidebar
                btn.classList.add('text-danger'); // Use text color for icon
            }
            btn.title = 'Stop Bot';
        } else {
            // Start State
            if (btn.id === 'toggle-bot-dashboard') {
                btn.innerHTML = '▶️ Start Bot';
                btn.classList.remove('btn-danger');
            } else {
                btn.innerHTML = '▶️';
                btn.classList.remove('text-danger');
            }
            btn.title = 'Start Bot';
        }
    });

    // Update Status Dot
    if (running) {
        statusDot.classList.remove('offline');
        statusDot.classList.add('online');
    } else {
        statusDot.classList.remove('online');
        statusDot.classList.add('offline');

        if (qrContainer) {
            qrContainer.innerHTML = '<div class="qr-placeholder"><p>Klik "Start Bot" untuk memulai</p></div>';
        }
    }
}

// Add log entry
function addLog(message, type = 'info') {
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    logContainer.appendChild(entry);
    logContainer.scrollTop = logContainer.scrollHeight;

    // Keep only last 100 entries
    while (logContainer.children.length > 100) {
        logContainer.removeChild(logContainer.firstChild);
    }
}

// Update stats
function updateStats() {
    // 1. Dashboard Stats (Main View)
    const elTotal = document.getElementById('stat-total');
    const elHandled = document.getElementById('stat-handled');
    const elAlerts = document.getElementById('stat-alerts');

    if (elTotal) elTotal.textContent = stats.total;
    if (elHandled) elHandled.textContent = stats.handled;
    if (elAlerts) elAlerts.textContent = stats.alerts;

    // 2. Sidebar Stats (Menu Box)
    const elTotalSide = document.getElementById('stat-total-sidebar');
    const elAlertsSide = document.getElementById('stat-alerts-sidebar');

    // Always update sidebar stats if they exist
    if (elTotalSide) elTotalSide.textContent = stats.total;
    if (elAlertsSide) elAlertsSide.textContent = stats.alerts;

    // 3. Alert Badge
    if (stats.alerts > 0) {
        alertBadge.style.display = 'inline';
        alertBadge.textContent = stats.alerts;
    } else {
        alertBadge.style.display = 'none';
    }
}

// Handle bot messages
window.ppidBot.onBotMessage((msg) => {
    switch (msg.type) {
        case 'qr':
            console.log('QR message received:', JSON.stringify(msg).substring(0, 200));
            console.log('QR data type:', typeof msg.qr);
            console.log('QR data preview:', msg.qr ? msg.qr.substring(0, 80) : 'NULL/UNDEFINED');

            if (msg.qr && typeof msg.qr === 'string' && msg.qr.startsWith('data:image')) {
                qrContainer.innerHTML = `<img src="${msg.qr}" alt="QR Code" style="max-width: 280px; max-height: 280px;">`;
                addLog('QR Code siap di-scan', 'info');
            } else if (msg.qr && typeof msg.qr === 'string' && msg.qr.length > 100) {
                // Maybe it's raw base64 without prefix
                const imgSrc = msg.qr.startsWith('data:') ? msg.qr : `data:image/png;base64,${msg.qr}`;
                qrContainer.innerHTML = `<img src="${imgSrc}" alt="QR Code" style="max-width: 280px; max-height: 280px;">`;
                addLog('QR Code siap di-scan', 'info');
            } else {
                console.error('Invalid QR data:', msg.qr?.substring(0, 100));
                qrContainer.innerHTML = '<div class="qr-placeholder"><p>QR Code gagal dimuat. Cek Console (F12).</p></div>';
                addLog('QR Code gagal dimuat - cek Console', 'error');
            }
            break;

        case 'connected':
            updateBotStatus(true);
            addLog(`Terhubung sebagai: ${msg.name}`, 'success');
            break;

        case 'message-in':
            stats.total++;
            addChat(msg.chatId, msg.name, msg.text, 'in', msg.needsReview);
            addLog(`Pesan masuk dari ${msg.name}`, 'info');
            updateStats();
            break;

        case 'message-out':
            stats.handled++;
            addChat(msg.chatId, msg.name, msg.text, 'out');
            addLog(`Balasan terkirim ke ${msg.name}`, 'success');
            updateStats();
            break;

        case 'alert':
            stats.alerts++;
            markChatAsAlert(msg.chatId);
            addLog(`⚠️ PERLU REVIEW: ${msg.reason}`, 'warning');
            updateStats();
            showDesktopNotification('Kasus Spesial', msg.reason);
            break;

        case 'error':
            addLog(`Error: ${msg.message}`, 'error');
            break;

        case 'logged-out':
            updateBotStatus(false);
            qrContainer.innerHTML = '<div class="qr-placeholder"><p>Logout berhasil. Klik Start Bot untuk scan QR baru.</p></div>';
            addLog('Logout berhasil', 'info');
            break;
    }
});

window.ppidBot.onBotLog((log) => {
    addLog(log.trim(), 'info');
});

window.ppidBot.onBotError((err) => {
    addLog(err.trim(), 'error');
});

window.ppidBot.onBotStatus((status) => {
    updateBotStatus(status.running);
});

// Chat functions
function addChat(chatId, name, text, direction, needsReview = false) {
    if (!chats.has(chatId)) {
        chats.set(chatId, {
            name: name,
            messages: [],
            isAlert: false, // Legacy alert (timeouts)
            needsReview: false // NEW: Low confidence / No context
        });
    }

    if (needsReview) {
        chats.get(chatId).needsReview = true;
    }

    chats.get(chatId).messages.push({
        direction,
        text,
        time: new Date()
    });

    renderChatList();
}

function markChatAsAlert(chatId) {
    if (chats.has(chatId)) {
        chats.get(chatId).isAlert = true;
        renderChatList();
    }
}

function renderChatList() {
    const chatList = document.getElementById('chat-list');
    chatList.innerHTML = '';

    if (chats.size === 0) {
        chatList.innerHTML = '<div class="empty-state"><p>Belum ada percakapan</p></div>';
        return;
    }

    chats.forEach((chat, chatId) => {
        const lastMsg = chat.messages[chat.messages.length - 1];
        const statusClass = chat.needsReview ? 'needs-review' : (chat.isAlert ? 'alert' : '');
        const statusIcon = chat.needsReview ? '🔴' : (chat.isAlert ? '⚠️' : '');

        const item = document.createElement('div');
        item.className = `chat-item ${statusClass}`;
        item.innerHTML = `
            <div class="chat-name">${chat.name} ${statusIcon}</div>
            <div class="chat-preview">${lastMsg ? lastMsg.text : ''}</div>
        `;
        item.addEventListener('click', () => openChatDetail(chatId));
        chatList.appendChild(item);
    });
}

function openChatDetail(chatId) {
    const chat = chats.get(chatId);
    if (!chat) return;

    const detail = document.getElementById('chat-detail');
    let html = `<h3>${chat.name}</h3><div class="chat-messages">`;

    chat.messages.forEach(msg => {
        html += `<div class="msg ${msg.direction}">
            <span class="msg-text">${msg.text}</span>
            <span class="msg-time">${msg.time.toLocaleTimeString()}</span>
        </div>`;
    });

    if (chat.needsReview) {
        html += `<div style="background: #ef4444; color: white; padding: 10px; margin: 10px; border-radius: 6px; font-size: 0.9em;">
                    ⚠️ Bot tidak yakin dengan jawabannya. Silakan review atau balas manual.
                 </div>`;
    }

    html += '</div>'; // Close chat-messages

    // Handover Release Button
    if (chat.isHandover) {
        html += `
            <div class="handover-banner" style="background: rgba(239, 68, 68, 0.1); border-left: 4px solid var(--danger); padding: 10px; margin: 10px; display: flex; justify-content: space-between; align-items: center;">
                <span>⚠️ Mode Manual (Handover) Aktif</span>
                <button class="btn btn-sm btn-outline-danger release-handover-btn" data-chat-id="${chatId}">✅ Selesai (Auto)</button>
            </div>
        `;
    }

    // Inline Manual Reply Area with Attachment
    html += `
        <div class="manual-reply-area">
            <button class="btn-icon attach-btn" data-chat-id="${chatId}" title="Kirim File">📎</button>
            <input type="file" id="attach-input-${chatId}" style="display: none;" onchange="handleFileSelect('${chatId}', this)">
            <input type="text" class="manual-reply-input" id="manual-reply-input-${chatId}" data-chat-id="${chatId}" placeholder="Tulis balasan manual...">
            <button class="btn btn-primary send-reply-btn" data-chat-id="${chatId}">Kirim</button>
        </div>
        <div id="file-preview-${chatId}" class="file-preview" style="display:none; padding: 5px 10px; font-size: 0.8em; color: var(--primary);"></div>
    `;

    detail.innerHTML = html;

    // Scroll to bottom
    const msgContainer = detail.querySelector('.chat-messages');
    msgContainer.scrollTop = msgContainer.scrollHeight;
}

// Global Event Delegation for Dynamic Elements
document.addEventListener('click', (e) => {
    // Check if clicked element is send button
    if (e.target.classList.contains('send-reply-btn')) {
        const chatId = e.target.dataset.chatId;
        handleManualReplySend(chatId, e.target);
    }
    // Release Handover Button
    else if (e.target.classList.contains('release-handover-btn')) {
        const chatId = e.target.dataset.chatId;
        handleReleaseHandover(chatId, e.target);
    }
    // Attachment Button
    else if (e.target.classList.contains('attach-btn')) {
        const chatId = e.target.dataset.chatId;
        document.getElementById(`attach-input-${chatId}`).click();
    }
});

// Global function for handling file selection (called by onchange attribute)
window.handleFileSelect = async function (chatId, input) {
    if (input.files.length > 0) {
        const file = input.files[0];
        const preview = document.getElementById(`file-preview-${chatId}`);

        // Convert to Base64
        const reader = new FileReader();
        reader.onload = function (e) {
            const base64Data = e.target.result.split(',')[1];

            // Store file data in input element for send logic to retrieve
            input.dataset.fileData = base64Data;
            input.dataset.fileName = file.name;
            input.dataset.fileType = file.type;

            // Show preview
            preview.style.display = 'block';
            preview.innerHTML = `📎 <strong>${file.name}</strong> terpilih <button onclick="clearAttachment('${chatId}')" style="background:none; border:none; color:red; cursor:pointer;">❌</button>`;
        };
        reader.readAsDataURL(file);
    }
};

window.clearAttachment = function (chatId) {
    const input = document.getElementById(`attach-input-${chatId}`);
    const preview = document.getElementById(`file-preview-${chatId}`);

    input.value = '';
    delete input.dataset.fileData;
    delete input.dataset.fileName;
    delete input.dataset.fileType;

    preview.style.display = 'none';
    preview.innerHTML = '';
};

async function handleReleaseHandover(chatId, btn) {
    btn.innerHTML = '⏳';
    btn.disabled = true;

    try {
        await window.ppidBot.releaseHandover(chatId);

        // Update Local State
        if (chats.has(chatId)) {
            chats.get(chatId).isHandover = false;
        }

        // Refresh UI
        addLog(`Handover selesai. Bot kembali aktif untuk chat ini.`, 'success');
        renderChatList();
        openChatDetail(chatId);

        // Remove alert styling
        const chatItem = document.querySelector(`[data-chat-id="${chatId}"]`);
        if (chatItem) chatItem.classList.remove('handover-alert');

    } catch (error) {
        alert('Gagal release handover: ' + error.message);
        btn.innerHTML = '✅ Selesai (Auto)';
        btn.disabled = false;
    }
}

// Main Send Logic
async function handleManualReplySend(chatId, btnElement) {
    console.log('Manual reply triggered for:', chatId);
    const input = document.getElementById(`manual-reply-input-${chatId}`);
    const attachInput = document.getElementById(`attach-input-${chatId}`);

    if (!input) {
        addLog('Error: Input element not found', 'error');
        return;
    }

    const message = input.value.trim();
    const hasAttachment = attachInput && attachInput.dataset.fileData;

    if (!message && !hasAttachment) return;

    // UI Feedback
    if (btnElement) {
        btnElement.dataset.originalText = btnElement.innerHTML;
        btnElement.innerHTML = '⏳';
        btnElement.disabled = true;
    }

    try {
        // Construct payload
        const payload = {
            chatId,
            message: message // Text message (optional if attachment exists)
        };

        // Add attachment if exists
        if (hasAttachment) {
            payload.media = {
                data: attachInput.dataset.fileData,
                mimetype: attachInput.dataset.fileType,
                filename: attachInput.dataset.fileName
            };
        }

        await window.ppidBot.sendManualReply(chatId, payload); // Updated signature
        console.log('IPC Success');

        // Optimistic Update
        const chat = chats.get(chatId);
        if (chat) {
            let displayMsg = message;
            if (hasAttachment) {
                displayMsg = `[File: ${attachInput.dataset.fileName}] ${message}`;
            }

            chat.messages.push({
                direction: 'out',
                text: displayMsg,
                time: new Date()
            });

            // Refresh UI
            openChatDetail(chatId);
            renderChatList();
        }

        // Clean up
        input.value = '';
        if (hasAttachment) {
            clearAttachment(chatId);
        }

    } catch (error) {
        console.error('Failed to send:', error);
        addLog('Gagal mengirim: ' + error.message, 'error');
        alert('Gagal mengirim pesan: ' + error.message);
    } finally {
        btnElement.innerHTML = '❌';
        btnElement.disabled = false;
        setTimeout(() => {
            btnElement.innerHTML = btnElement.dataset.originalText || 'Kirim';
        }, 2000);
    }
}


// Takeover modal
function openTakeover(chatId) {
    const chat = chats.get(chatId);
    if (!chat) return;

    const modal = document.getElementById('takeover-modal');
    const history = document.getElementById('modal-chat-history');

    let html = '';
    chat.messages.slice(-5).forEach(msg => {
        html += `<div class="msg ${msg.direction}">${msg.text}</div>`;
    });
    history.innerHTML = html;

    modal.classList.add('active');
    modal.dataset.chatId = chatId;
}

document.getElementById('cancel-takeover').addEventListener('click', () => {
    document.getElementById('takeover-modal').classList.remove('active');
});

document.getElementById('send-takeover').addEventListener('click', async () => {
    const modal = document.getElementById('takeover-modal');
    const chatId = modal.dataset.chatId;
    const message = document.getElementById('manual-reply').value;

    if (!message.trim()) return;

    await window.ppidBot.sendManualReply(chatId, message);

    // Mark as handled
    if (chats.has(chatId)) {
        chats.get(chatId).isAlert = false;
        stats.alerts = Math.max(0, stats.alerts - 1);
        updateStats();
        renderChatList();
    }

    modal.classList.remove('active');
    document.getElementById('manual-reply').value = '';
    addLog(`Balasan manual terkirim ke ${chatId}`, 'success');
});

// Upload zone
const uploadZone = document.getElementById('upload-zone');
const fileInput = document.getElementById('file-input');

uploadZone.addEventListener('click', () => fileInput.click());

uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.style.borderColor = 'var(--primary)';
});

uploadZone.addEventListener('dragleave', () => {
    uploadZone.style.borderColor = 'var(--border)';
});

uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.style.borderColor = 'var(--border)';
    handleFiles(e.dataTransfer.files);
});

fileInput.addEventListener('change', (e) => {
    handleFiles(e.target.files);
});

function handleFiles(files) {
    const fileList = document.getElementById('file-list');
    Array.from(files).forEach(file => {
        if (file.name.toLowerCase().endsWith('.pdf') || file.name.toLowerCase().endsWith('.txt')) {
            const item = document.createElement('div');
            item.className = 'file-item';

            const isTxt = file.name.toLowerCase().endsWith('.txt');
            const icon = isTxt ? '💬' : '📄';

            item.textContent = `${icon} ${file.name}`;
            fileList.appendChild(item);
        }
    });
}

// Reindex button
document.getElementById('reindex-btn').addEventListener('click', async () => {
    addLog('Memulai reindex dokumen...', 'info');
    const result = await window.ppidBot.reindexDocuments();
    if (result.success) {
        addLog('Reindex selesai!', 'success');
        // Refresh document list after successful re-index
        await loadIngestedDocs();
    } else {
        addLog('Reindex gagal', 'error');
    }
});

// Temperature slider
// Temperature slider
const tempSlider = document.getElementById('temperature');
const tempValue = document.getElementById('temp-value');
if (tempSlider && tempValue) {
    tempSlider.addEventListener('input', () => {
        tempValue.textContent = tempSlider.value;
    });
}

// Humor slider
const humorSlider = document.getElementById('humor-level');
const humorValue = document.getElementById('humor-value');
if (humorSlider && humorValue) {
    humorSlider.addEventListener('input', () => {
        humorValue.textContent = `${humorSlider.value}%`;
    });
}

// Test Prompt button
document.getElementById('test-btn')?.addEventListener('click', async () => {
    const testInput = document.getElementById('test-input');
    const testResult = document.getElementById('test-result');
    const query = testInput.value.trim();

    if (!query) {
        testResult.innerHTML = '<p style="color: var(--danger)">Masukkan pertanyaan terlebih dahulu</p>';
        return;
    }

    testResult.innerHTML = '<p>⏳ Memproses...</p>';

    try {
        const result = await window.ppidBot.testPrompt(query);

        if (result.success) {
            testResult.innerHTML = `
                <div style="background: var(--card-bg); padding: 12px; border-radius: 8px; border-left: 3px solid var(--success);">
                    <strong>🤖 Jawaban:</strong>
                    <p style="margin-top: 8px; white-space: pre-wrap;">${result.response}</p>
                </div>
            `;
        } else {
            testResult.innerHTML = `<p style="color: var(--danger)">❌ Error: ${result.error}</p>`;
        }
    } catch (error) {
        testResult.innerHTML = `<p style="color: var(--danger)">❌ Error: ${error.message}</p>`;
    }
});

// Desktop notification
function showDesktopNotification(title, body) {
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, { body });
    }
}

// Request notification permission
if ('Notification' in window) {
    Notification.requestPermission();
}

// Logout button
document.getElementById('logout-btn').addEventListener('click', async () => {
    if (confirm('Yakin ingin logout dari WhatsApp? Anda perlu scan QR ulang nanti.')) {
        await window.ppidBot.logoutBot();
        updateBotStatus(false);
        addLog('Logout berhasil. Silakan scan QR ulang.', 'warning');
    }
});

// Survey Chart Rendering
function renderSurveyChart(stats) {
    const chartContainer = document.getElementById('survey-chart');
    const avgEl = document.getElementById('survey-avg');
    const countEl = document.getElementById('survey-count');

    // Update summary
    avgEl.textContent = stats.average || '0.0';
    countEl.textContent = stats.total || '0';

    // Clear chart
    chartContainer.innerHTML = '';

    if (stats.total === 0) {
        chartContainer.innerHTML = '<div class="chart-placeholder">Belum ada data survei</div>';
        return;
    }

    // Find max for scaling
    const maxCount = Math.max(...stats.distribution);

    // Create bars (1-10)
    for (let i = 0; i < 10; i++) {
        const rating = i + 1;
        const count = stats.distribution[i];
        const heightPercent = maxCount > 0 ? (count / maxCount) * 100 : 0;

        const barContainer = document.createElement('div');
        barContainer.className = 'chart-bar-container';

        const bar = document.createElement('div');
        bar.className = 'chart-bar';
        bar.style.height = `${Math.max(heightPercent, 2)}%`; // Min 2% visibility
        bar.dataset.value = count;

        // Color gradient based on rating
        if (rating <= 4) bar.style.backgroundColor = 'var(--danger)';
        else if (rating <= 7) bar.style.backgroundColor = 'var(--warning)';
        else bar.style.backgroundColor = 'var(--success)';

        const label = document.createElement('div');
        label.className = 'chart-label';
        label.textContent = rating;

        barContainer.appendChild(bar);
        barContainer.appendChild(label);
        chartContainer.appendChild(barContainer);
    }
}

// Listen for survey stats
window.ppidBot.onSurveyStats((stats) => {
    renderSurveyChart(stats);
});

// Check initial status
(async () => {
    const status = await window.ppidBot.getBotStatus();
    updateBotStatus(status.running);

    // Get initial survey stats
    if (status.running) {
        const result = await window.ppidBot.getSurveyStats();
        // Result might be pending, we rely on event listener
    }

    // Load ingested docs and knowledge gaps on startup
    await loadIngestedDocs();
    await loadKnowledgeGaps();
})();

// ============ Document List & Knowledge Gaps ============

// Load and render ingested documents
async function loadIngestedDocs() {
    const container = document.getElementById('ingested-docs-list');
    container.innerHTML = '<p>Loading...</p>';

    try {
        const result = await window.ppidBot.getIngestedDocs();
        if (result.success && result.files.length > 0) {
            container.innerHTML = '';
            result.files.forEach(file => {
                const item = document.createElement('div');
                item.className = 'doc-item';

                const typeClass = file.type === 'chat-history' ? 'chat-history' : '';
                const typeLabel = file.type === 'chat-history' ? 'Chat' : file.type.toUpperCase();

                item.innerHTML = `
                    <span class="doc-name">${file.name}</span>
                    <span class="doc-type ${typeClass}">${typeLabel}</span>
                `;
                container.appendChild(item);
            });
        } else {
            container.innerHTML = '<div class="empty-state"><p>Belum ada dokumen</p></div>';
        }
    } catch (err) {
        container.innerHTML = '<div class="empty-state"><p>Gagal memuat</p></div>';
    }
}

// Load and render knowledge gaps into separate panels
async function loadKnowledgeGaps() {
    const customerContainer = document.getElementById('customer-gaps-list');
    const aiContainer = document.getElementById('ai-gaps-list');

    try {
        const result = await window.ppidBot.getKnowledgeGaps();
        const gaps = result.success ? result.gaps : [];

        // Separate customer questions from AI-generated
        const customerGaps = gaps.filter(g => g.chatId !== 'auto-generated');
        const aiGaps = gaps.filter(g => g.chatId === 'auto-generated');

        // Render customer gaps
        if (customerGaps.length > 0) {
            customerContainer.innerHTML = '';
            customerGaps.forEach(gap => {
                const item = document.createElement('div');
                item.className = 'gap-item';
                const date = new Date(gap.timestamp).toLocaleDateString('id-ID');
                item.innerHTML = `
                    <span class="gap-question">"${gap.question}"</span>
                    <span class="gap-meta">Dari: ${gap.contact || 'Unknown'} - ${date}</span>
                    <div>
                        <span class="gap-train" data-question="${encodeURIComponent(gap.question)}">🧠 Latih AI</span>
                        <span class="gap-dismiss" data-question="${encodeURIComponent(gap.question)}">✓ Hapus</span>
                    </div>
                `;
                customerContainer.appendChild(item);
            });
        } else {
            customerContainer.innerHTML = '<div class="empty-state"><p>Tidak ada</p></div>';
        }

        // Render AI-generated gaps
        if (aiGaps.length > 0) {
            aiContainer.innerHTML = '';
            aiGaps.forEach(gap => {
                const item = document.createElement('div');
                item.className = 'gap-item';
                item.innerHTML = `
                    <span class="gap-question">"${gap.question}"</span>
                    <div>
                        <span class="gap-train" data-question="${encodeURIComponent(gap.question)}">🧠 Latih AI →</span>
                        <span class="gap-dismiss" data-question="${encodeURIComponent(gap.question)}">✓ Hapus</span>
                    </div>
                `;
                aiContainer.appendChild(item);
            });
        } else {
            aiContainer.innerHTML = '<div class="empty-state"><p>Tidak ada</p></div>';
        }

        // Add event listeners for dismiss buttons
        document.querySelectorAll('.gap-dismiss').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const question = decodeURIComponent(e.target.dataset.question);
                await window.ppidBot.clearKnowledgeGap(question);
                await loadKnowledgeGaps();
            });
        });

        // Add event listeners for train buttons
        document.querySelectorAll('.gap-train').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const question = decodeURIComponent(e.target.dataset.question);
                startTrainingWithQuestion(question);
            });
        });

    } catch (err) {
        customerContainer.innerHTML = '<div class="empty-state"><p>Gagal memuat</p></div>';
        aiContainer.innerHTML = '<div class="empty-state"><p>Gagal memuat</p></div>';
    }
}

// ============ Live Training Mode ============
let currentTrainingQuestion = null;
let currentTrainingResponse = null;

// Helper to format WhatsApp text style to HTML
function formatWhatsAppText(text) {
    if (!text) return '';

    // 1. Escape HTML first (Security)
    let formatted = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

    // 2. Bold *text*
    formatted = formatted.replace(/\*([^*]+)\*/g, "<strong>$1</strong>");

    // 3. Italic _text_
    formatted = formatted.replace(/_([^_]+)_/g, "<em>$1</em>");

    // 4. Strikethrough ~text~
    formatted = formatted.replace(/~([^~]+)~/g, "<strike>$1</strike>");

    // 5. Monospace ```text```
    formatted = formatted.replace(/```([^`]+)```/g, "<code>$1</code>");

    // 6. Line breaks
    formatted = formatted.replace(/\n/g, "<br>");

    return formatted;
}

function addTrainingMessage(text, type) {
    const chat = document.getElementById('training-chat');
    const msg = document.createElement('div');
    msg.className = `training-message ${type}`;

    // Use innerHTML with formatted text
    msg.innerHTML = formatWhatsAppText(text);

    chat.appendChild(msg);
    chat.scrollTop = chat.scrollHeight;
}

function startTrainingWithQuestion(question) {
    // Pre-fill training input and trigger send
    const input = document.getElementById('training-question');
    if (input) {
        input.value = question;
        sendTrainingQuestion();
    }
}

// Function to send training question
async function sendTrainingQuestion() {
    console.log('sendTrainingQuestion called');
    const input = document.getElementById('training-question');
    console.log('Input element:', input);

    const question = input?.value?.trim();
    console.log('Question value:', question);

    if (!question) {
        console.log('Empty question, returning');
        return;
    }

    currentTrainingQuestion = question;
    input.value = '';
    console.log('Input cleared');

    try {
        addTrainingMessage(question, 'user');
        console.log('User message added');
    } catch (e) {
        console.error('Error adding user message:', e);
    }

    // Get AI response
    try {
        addTrainingMessage('⏳ Memproses...', 'system');
        const result = await window.ppidBot.testPrompt(question);
        // Remove loading message
        const chat = document.getElementById('training-chat');
        const lastMsg = chat.lastChild;
        if (lastMsg && lastMsg.textContent === '⏳ Memproses...') {
            chat.removeChild(lastMsg);
        }

        currentTrainingResponse = result.success ? result.response : 'Error: ' + result.error;
        addTrainingMessage(currentTrainingResponse, 'ai');

        // Show correction area
        document.getElementById('training-correction-area').style.display = 'block';
    } catch (err) {
        addTrainingMessage('Gagal mengambil respons AI: ' + err.message, 'system');
    }
}

// Send question for training via button
document.getElementById('training-send-btn')?.addEventListener('click', sendTrainingQuestion);

// Send on Enter key
document.getElementById('training-question')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        sendTrainingQuestion();
    }
});

// Teach AI with correction
document.getElementById('training-teach-btn')?.addEventListener('click', async () => {
    const correction = document.getElementById('training-correction').value.trim();
    if (!correction || !currentTrainingQuestion) {
        addTrainingMessage('Masukkan koreksi terlebih dahulu', 'system');
        return;
    }

    try {
        await window.ppidBot.trainAI(currentTrainingQuestion, correction);
        addTrainingMessage('✅ AI telah mempelajari jawaban yang benar!', 'system');
        document.getElementById('training-correction').value = '';
        document.getElementById('training-correction-area').style.display = 'none';
        currentTrainingQuestion = null;
        currentTrainingResponse = null;
    } catch (err) {
        addTrainingMessage('Gagal melatih AI', 'system');
    }
});

// Skip correction (answer was already correct)
document.getElementById('training-skip-btn')?.addEventListener('click', () => {
    addTrainingMessage('✓ Jawaban sudah dianggap benar', 'system');
    document.getElementById('training-correction').value = '';
    document.getElementById('training-correction-area').style.display = 'none';
    currentTrainingQuestion = null;
    currentTrainingResponse = null;
});

// Refresh button listeners
document.getElementById('refresh-docs-btn')?.addEventListener('click', loadIngestedDocs);

// Generate Questions button
document.getElementById('generate-questions-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('generate-questions-btn');
    btn.textContent = '⏳ Generating...';
    btn.disabled = true;

    try {
        const result = await window.ppidBot.generateQuestions();
        if (result.success) {
            addLog(`Generated ${result.questions?.length || 0} potential questions`, 'success');
            await loadKnowledgeGaps();
        } else {
            addLog('Failed to generate questions: ' + result.error, 'error');
        }
    } catch (err) {
        addLog('Error generating questions', 'error');
    }

    btn.textContent = '💡 Generate Pertanyaan dari Dokumen';
    btn.disabled = false;
});

// Periodically refresh knowledge gaps (every 30s)
setInterval(loadKnowledgeGaps, 30000);

// ============ Onboarding Tour ============
function showOnboardingTour() {
    // Check if user requested to skip
    if (localStorage.getItem('ppid_tour_skip') === 'true') return;

    const overlay = document.createElement('div');
    overlay.className = 'onboarding-overlay';
    overlay.innerHTML = `
        <div class="onboarding-card">
            <h2 style="color: var(--primary); margin-bottom: 10px;">👋 Selamat Datang!</h2>
            <p style="margin-bottom: 20px;">Panduan singkat menggunakan PPID Bot Assistant</p>
            
            <div class="onboarding-steps">
                <div class="step-item">
                    <div class="step-icon">💬</div>
                    <div class="step-text">
                        <h4>Menu Chats</h4>
                        <p>Pantau percakapan masuk. Balas manual jika bot bingung.</p>
                    </div>
                </div>
                <div class="step-item">
                    <div class="step-icon">📊</div>
                    <div class="step-text">
                        <h4>Dashboard</h4>
                        <p>Lihat statistik, survey, dan status koneksi QR Code WhatsApp.</p>
                    </div>
                </div>
                <div class="step-item">
                    <div class="step-icon">📚</div>
                    <div class="step-text">
                        <h4>Training</h4>
                        <p>Upload dokumen PDF/TXT untuk melatih kecerdasan AI.</p>
                    </div>
                </div>
                <div class="step-item">
                    <div class="step-icon">📋</div>
                    <div class="step-text">
                        <h4>Evaluasi</h4>
                        <p>Tinjau feedback negatif dan latih AI dari kesalahan.</p>
                    </div>
                </div>
            </div>

            <div style="margin-top: 20px; display: flex; flex-direction: column; align-items: center; gap: 10px;">
                <button class="btn btn-primary onboarding-btn" id="close-tour" style="width: 100%;">Mulai Sekarang 🚀</button>
                <label style="font-size: 13px; color: var(--text-secondary); display: flex; align-items: center; gap: 8px; cursor: pointer;">
                    <input type="checkbox" id="dont-show-tour"> Jangan tampilkan ini lagi
                </label>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    document.getElementById('close-tour').addEventListener('click', () => {
        const checkbox = document.getElementById('dont-show-tour');
        if (checkbox && checkbox.checked) {
            localStorage.setItem('ppid_tour_skip', 'true');
        }
        overlay.remove();
    });
}

// Call on startup
// showOnboardingTour(); // Moved to initApp



// ==========================================
// EVALUATION & CSAT LOGIC
// ==========================================

async function loadEvaluations() {
    try {
        const result = await window.ppidBot.getEvaluations();
        if (result.success) {
            renderEvaluationList(result.evaluations);
            updateEvalBadge(result.evaluations);
        }
    } catch (e) {
        console.error('Failed to load evaluations:', e);
        alert('Gagal memuat evaluasi: ' + e.message);
    }
}

function updateEvalBadge(evals) {
    const pendingCount = evals.filter(e => e.status === 'pending').length;
    const badge = document.getElementById('eval-badge');
    if (pendingCount > 0) {
        badge.textContent = pendingCount;
        badge.style.display = 'inline-block';
    } else {
        badge.style.display = 'none';
    }
}

function renderEvaluationList(evaluations) {
    const list = document.getElementById('eval-list');
    list.innerHTML = '';

    // Filter Pending only for now (or sort pending first)
    // Let's show all but sort pending first
    const sorted = evaluations.sort((a, b) => {
        if (a.status === 'pending' && b.status !== 'pending') return -1;
        if (a.status !== 'pending' && b.status === 'pending') return 1;
        return b.timestamp - a.timestamp;
    });

    if (sorted.length === 0) {
        list.innerHTML = '<div class="empty-state">Belum ada data evaluasi</div>';
        return;
    }

    sorted.forEach(item => {
        const card = document.createElement('div');
        card.className = 'eval-item-card'; // Add css for this
        card.style.padding = '15px';
        card.style.borderBottom = '1px solid var(--border)';
        card.style.cursor = 'pointer';
        card.style.opacity = item.status === 'pending' ? '1' : '0.5';
        card.style.backgroundColor = item.status === 'pending' ? 'transparent' : 'rgba(0,0,0,0.1)';

        if (item.status === 'pending') {
            card.style.borderLeft = '3px solid var(--danger)';
        }

        card.innerHTML = `
            <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                <strong style="color:var(--text-primary)">${item.customerName || 'Customer'}</strong>
                <span style="font-size:12px; color:var(--text-secondary)">${new Date(item.timestamp).toLocaleDateString()}</span>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <span class="badge" style="background:${item.rating < 3 ? 'var(--danger)' : 'var(--warning)'}; font-size:10px;">★ ${item.rating}</span>
                <span style="font-size:12px; color:${item.status === 'pending' ? 'var(--warning)' : 'var(--success)'}">${item.status.toUpperCase()}</span>
            </div>
            <p style="font-size:13px; color:var(--text-secondary); margin-top:5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${item.feedback}</p>
        `;

        card.onclick = () => selectEvaluation(item);
        list.appendChild(card);
    });
}

function selectEvaluation(item) {
    const placeholder = document.getElementById('eval-detail-placeholder');
    const area = document.getElementById('eval-action-area');

    placeholder.style.display = 'none';
    area.style.display = 'block';

    // Populate data
    document.getElementById('eval-customer-name').textContent = item.customerName || 'Customer';
    document.getElementById('eval-time').textContent = new Date(item.timestamp).toLocaleString();
    document.getElementById('eval-rating-display').textContent = item.rating;
    document.getElementById('eval-feedback-text').textContent = `"${item.feedback}"`;

    // Auto-fill context (Question) if empty
    // We don't have the original question easily here, admin has to infer or we fetch chat history later
    // For now, leave empty
    document.getElementById('eval-question-input').value = '';
    document.getElementById('eval-answer-input').value = '';

    // Bind Buttons
    const trainBtn = document.getElementById('eval-train-btn');
    const ignoreBtn = document.getElementById('eval-ignore-btn');

    trainBtn.onclick = async () => {
        const question = document.getElementById('eval-question-input').value.trim();
        const answer = document.getElementById('eval-answer-input').value.trim();

        if (!question || !answer) {
            alert('Mohon isi konteks pertanyaan dan jawaban perbaikan.');
            return;
        }

        trainBtn.textContent = 'Menyimpan...';
        trainBtn.disabled = true;

        try {
            // 1. Train AI
            const trainRes = await window.ppidBot.trainAI(question, answer);
            if (!trainRes.success) throw new Error(trainRes.error);

            // 2. Mark Resolved
            await window.ppidBot.resolveEvaluation(item.id, 'trained');

            // 3. UI Update
            addLog(`Evaluasi diselesaikan & AI dilatih: ${question}`, 'success');
            loadEvaluations(); // Refresh list

            // Reset Detail
            area.style.display = 'none';
            placeholder.style.display = 'flex';

        } catch (e) {
            alert('Gagal: ' + e.message);
            trainBtn.textContent = 'Simpan & Latih AI';
            trainBtn.disabled = false;
        }
    };

    ignoreBtn.onclick = async () => {
        if (!confirm('Abaikan masukan ini? Status akan menjadi "ignored".')) return;

        try {
            await window.ppidBot.resolveEvaluation(item.id, 'ignored');
            loadEvaluations();
            area.style.display = 'none';
            placeholder.style.display = 'flex';
        } catch (e) {
            console.error(e);
        }
    };

    // If already resolved, disable buttons
    if (item.status !== 'pending') {
        trainBtn.disabled = true;
        ignoreBtn.disabled = true;
        trainBtn.textContent = `Sudah ${item.status}`;
    } else {
        trainBtn.disabled = false;
        ignoreBtn.disabled = false;
        trainBtn.textContent = 'Simpan & Latih AI 🧠';
    }
}


// ==========================================
// INITIALIZATION & API KEY SETUP
// ==========================================

async function initApp() {
    try {
        // DEBUG: Proof of life (Validated, removing alert to reduce noise)
        // alert('App Initializing...'); 

        // Setup listeners
        window.ppidBot.onBotError((err) => {
            console.error('BOT ERROR:', err);

            // Filter non-critical warnings & connection drops
            if (err.includes('[WARN]') ||
                err.includes('Reconnecting') ||
                err.includes('ExperimentalWarning') ||
                err.includes('Connection Closed') ||
                err.includes('Precondition Required') ||
                err.includes('428') ||
                err.includes('Timed Out') ||
                err.includes('Request Time-out') ||
                err.includes('408') ||
                err.includes('Bad MAC') ||
                err.includes('Failed to decrypt')) {
                // Just log, don't alert
                return;
            }

            alert('❌ SYSTEM ERROR: ' + err);
        });

        // Handover Request Listener (CS)
        window.ppidBot.onHandoverRequest((data) => {
            console.log('HANDOVER REQUEST:', data);

            // Add log
            addLog(`🆘 ${data.name} meminta bicara dengan CS`, 'warning');

            // Visual + Sound Alert
            const chatItem = document.querySelector(`[data-chat-id="${data.chatId}"]`);
            if (chatItem) {
                chatItem.classList.add('handover-alert');
                chatItem.scrollIntoView({ behavior: 'smooth' });
            }

            // Play notification sound
            try {
                const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdGx9cnR5eHp4d3V0cnBtamVhXVlVUk5LR0REQD08Ojg2NDIwLiwqKCYkIiAeHBsZGBYVExIREA8ODQwLCgkIBwYFBAMCAQAA');
                audio.volume = 0.5;
                audio.play();
            } catch (e) {
                console.log('No sound support');
            }
        });

        await loadEvaluations();
        await checkApiKeyAndTour();
    } catch (e) {
        alert('CRITICAL ERROR initApp: ' + e.message);
        console.error(e);
    }
}

async function checkApiKeyAndTour() {
    try {
        const result = await window.ppidBot.getSettings();
        const settings = result.success ? result.settings : {};

        if (!settings.groqApiKey) {
            showApiKeySetupModal();
        } else {
            showOnboardingTour();
        }
    } catch (e) {
        console.error('Failed to check settings:', e);
        showOnboardingTour(); // Fallback
    }
}

function showApiKeySetupModal() {
    const overlay = document.createElement('div');
    overlay.className = 'onboarding-overlay'; // Re-use overlay style
    overlay.style.zIndex = '9999'; // Ensure top
    overlay.innerHTML = `
        <div class="onboarding-card" style="max-width: 500px;">
            <h2 style="color: var(--primary); margin-bottom: 10px;">🔑 Setup Diperlukan</h2>
            <p style="margin-bottom: 20px;">Sebelum memulai, silakan masukkan <strong>Groq API Key</strong> Anda agar bot dapat berjalan.</p>
            
            <div style="margin-bottom: 20px; text-align: left;">
                <label style="display:block; margin-bottom: 8px; font-weight: 500;">Groq API Key</label>
                <input type="password" id="setup-api-key" placeholder="gsk_..." style="width: 100%; padding: 12px; background: var(--bg-input); border: 1px solid var(--border); color: white; border-radius: 8px;">
                <small style="display:block; margin-top: 8px; color: var(--text-secondary);">
                    Belum punya key? <a href="https://console.groq.com/keys" target="_blank" style="color: var(--primary);">Dapatkan disini</a>
                </small>
            </div>

            <button class="btn btn-primary onboarding-btn" id="save-api-key-btn" style="width: 100%;">Simpan & Lanjutkan 🚀</button>
        </div>
    `;

    document.body.appendChild(overlay);

    const btn = document.getElementById('save-api-key-btn');
    const input = document.getElementById('setup-api-key');

    btn.addEventListener('click', async () => {
        const key = input.value.trim();
        if (!key) {
            alert('Mohon masukkan API Key');
            return;
        }

        btn.textContent = 'Menyimpan...';
        btn.disabled = true;

        try {
            await window.ppidBot.saveSettings({ groqApiKey: key });
            overlay.remove();

            // Show tour after success
            showOnboardingTour();
            addLog('API Key berhasil disimpan', 'success');

        } catch (e) {
            alert('Gagal menyimpan: ' + e.message);
            btn.textContent = 'Simpan & Lanjutkan 🚀';
            btn.disabled = false;
        }
    });
}

async function loadSettingsUI() {
    try {
        const result = await window.ppidBot.getSettings();
        if (result.success && result.settings) {
            // Populate Fields
            const s = result.settings;
            if (document.getElementById('humor-level')) {
                document.getElementById('humor-level').value = s.humorLevel || 0;
                document.getElementById('humor-value').innerText = (s.humorLevel || 0) + '%';
            }

            if (document.getElementById('temperature')) {
                document.getElementById('temperature').value = s.temperature || 0.6;
                document.getElementById('temp-value').innerText = s.temperature || 0.6;
            }

            if (document.getElementById('model-select') && s.model) {
                document.getElementById('model-select').value = s.model;
            }

            // Update range listeners for interactivity (re-add to ensure they exist)
            const humor = document.getElementById('humor-level');
            if (humor) humor.oninput = (e) => document.getElementById('humor-value').innerText = e.target.value + '%';

            const temp = document.getElementById('temperature');
            if (temp) temp.oninput = (e) => document.getElementById('temp-value').innerText = e.target.value;

        }
    } catch (e) {
        console.error('Failed to load settings into UI:', e);
        alert('Gagal memuat settings: ' + e.message);
    }
}

// ==========================================
// LIVE TRAINING MODE LOGIC
// ==========================================
const trainingChat = document.getElementById('training-chat');
const trainingInput = document.getElementById('training-question');
const trainingSendBtn = document.getElementById('training-send-btn');
const trainingCorrectionArea = document.getElementById('training-correction-area');
const trainingCorrectionInput = document.getElementById('training-correction');
const trainingTeachBtn = document.getElementById('training-teach-btn');
const trainingSkipBtn = document.getElementById('training-skip-btn');

let lastTrainingQuestion = '';

if (trainingSendBtn && trainingInput) {
    // Send Question
    async function handleTrainingSend() {
        const question = trainingInput.value.trim();
        if (!question) return;

        lastTrainingQuestion = question;

        // Add User Message
        addTrainingMessage(question, 'user');
        trainingInput.value = '';
        trainingInput.disabled = true;
        trainingSendBtn.disabled = true;

        // Hide correction area initially
        trainingCorrectionArea.style.display = 'none';

        try {
            // Show loading
            const loadingMsg = addTrainingMessage('Sedang berpikir...', 'bot waiting');

            // Call AI
            const result = await window.ppidBot.testPrompt(question);

            // Remove loading
            loadingMsg.remove();

            if (result.success) {
                addTrainingMessage(result.response, 'bot');
                // Show correction area
                trainingCorrectionArea.style.display = 'block';
                trainingCorrectionInput.value = '';
                trainingCorrectionInput.focus();
            } else {
                addTrainingMessage('Error: ' + result.error, 'system');
                trainingInput.disabled = false;
                trainingSendBtn.disabled = false;
            }
        } catch (error) {
            addTrainingMessage('Error: ' + error.message, 'system');
            trainingInput.disabled = false;
            trainingSendBtn.disabled = false;
        }
    }

    trainingSendBtn.addEventListener('click', handleTrainingSend);
    trainingInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleTrainingSend();
    });

    // Teach / Correct
    trainingTeachBtn.addEventListener('click', async () => {
        const correction = trainingCorrectionInput.value.trim();
        if (!correction) {
            alert('Masukkan jawaban yang benar untuk melatih AI.');
            return;
        }

        trainingTeachBtn.textContent = 'Menyimpan...';
        trainingTeachBtn.disabled = true;

        try {
            const res = await window.ppidBot.trainAI(lastTrainingQuestion, correction);
            if (res.success) {
                addTrainingMessage('✅ AI berhasil dilatih dengan jawaban baru!', 'system');
                resetTrainingFlow();
            } else {
                alert('Gagal melatih: ' + res.error);
            }
        } catch (e) {
            alert('Error: ' + e.message);
        } finally {
            trainingTeachBtn.textContent = '💡 Ajarkan ke AI';
            trainingTeachBtn.disabled = false;
        }
    });

    // Skip
    trainingSkipBtn.addEventListener('click', () => {
        addTrainingMessage('👍 Jawaban sudah benar.', 'system');
        resetTrainingFlow();
    });
}

function addTrainingMessage(text, type) {
    const div = document.createElement('div');
    div.className = `training-message ${type}`;
    div.innerText = text;
    trainingChat.appendChild(div);
    trainingChat.scrollTop = trainingChat.scrollHeight;
    return div;
}

function resetTrainingFlow() {
    trainingCorrectionArea.style.display = 'none';
    trainingInput.disabled = false;
    trainingSendBtn.disabled = false;
    trainingInput.focus();
    lastTrainingQuestion = '';
}

// Initial Load
document.addEventListener('DOMContentLoaded', initApp);

