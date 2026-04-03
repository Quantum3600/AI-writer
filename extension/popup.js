const CHAT_SESSION_STORAGE_KEY = "chatSessionsByTabAndMode";
const BACKEND_BASE_URL = "http://localhost:8080";
let currentMode = "ask";
const MAX_TYPING_ANIMATION_CHARS = 700;
const MAX_RICH_TEXT_PARSE_CHARS = 3000;
const TYPING_CHUNK_SIZE = 20;

function createSessionId() {
    return "session_" + Date.now().toString(36) + "_" + Math.random().toString(36).substring(2, 10);
}

async function getActiveTab() {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    return tab?.id ? tab : null;
}

async function getCurrentChatKey(mode = currentMode) {
    const tab = await getActiveTab();
    const tabKey = tab?.id ?? "no-tab";
    return `${tabKey}:${mode}`;
}

async function getStoredSessionMap() {
    const stored = await chrome.storage.local.get(CHAT_SESSION_STORAGE_KEY);
    return stored[CHAT_SESSION_STORAGE_KEY] || {};
}

async function setStoredSessionMap(next) {
    await chrome.storage.local.set({ [CHAT_SESSION_STORAGE_KEY]: next });
}

async function setSessionIdForChatKey(chatKey, sessionId) {
    const map = await getStoredSessionMap();
    map[chatKey] = sessionId;
    await setStoredSessionMap(map);
}

async function getSessionIdForChatKey(chatKey) {
    const map = await getStoredSessionMap();
    return map[chatKey] || null;
}

async function createSessionOnBackend(chatKey) {
    try {
        const response = await fetch(`${BACKEND_BASE_URL}/api/chat/new`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chatKey })
        });

        if (!response.ok) throw new Error(`Server Error: ${response.status}`);
        const data = await response.json();
        return data.sessionId || null;
    } catch {
        return null;
    }
}

async function ensureSessionIdForChatKey(chatKey) {
    const existing = await getSessionIdForChatKey(chatKey);
    if (existing) return existing;

    const fromBackend = await createSessionOnBackend(chatKey);
    const sessionId = fromBackend || createSessionId();
    await setSessionIdForChatKey(chatKey, sessionId);
    return sessionId;
}

async function createFreshSessionForCurrentChat() {
    const chatKey = await getCurrentChatKey();
    const fromBackend = await createSessionOnBackend(chatKey);
    const sessionId = fromBackend || createSessionId();
    await setSessionIdForChatKey(chatKey, sessionId);
    return { chatKey, sessionId };
}

// DOM Elements
const chatContainer = document.getElementById("chat-container");
const emptyState = document.getElementById("empty-state");
const userInput = document.getElementById("user-input");
const btnSubmit = document.getElementById("btn-submit");
const btnMic = document.getElementById("btn-mic");
const btnHistory = document.getElementById("btn-history");
const btnNewChat = document.getElementById("btn-new-chat");
const historyPanel = document.getElementById("history-panel");
const historyList = document.getElementById("history-list");
const checkContext = document.getElementById("use-context");
const loadingIndicator = document.getElementById("loading");
const themeToggle = document.getElementById("theme-toggle");
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let thinkingMessageEl = null;

// --- Theme Management ---
// Check local storage for theme preference
if (localStorage.getItem("theme") === "dark") {
    document.body.classList.add("dark-mode");
}

themeToggle.addEventListener("click", () => {
    document.body.classList.toggle("dark-mode");
    const isDark = document.body.classList.contains("dark-mode");
    localStorage.setItem("theme", isDark ? "dark" : "light");
});

// --- Tab Handling ---
const tabs = {
    ask: document.getElementById("tab-ask"),
    write: document.getElementById("tab-write"),
    translate: document.getElementById("tab-translate")
};

function updateInputPlaceholder(mode) {
    if (mode === "ask") userInput.placeholder = "Ask a question about this page...";
    if (mode === "write") userInput.placeholder = "Instructions (e.g., Rewrite to be formal)...";
    if (mode === "translate") userInput.placeholder = "Target language? (e.g., Japanese)";
}

async function switchTab(mode) {
    currentMode = mode;
    Object.entries(tabs).forEach(([tabMode, tab]) => {
        const isActive = tabMode === mode;
        tab.classList.toggle("active", isActive);
        tab.setAttribute("aria-selected", String(isActive));
    });

    updateInputPlaceholder(mode);
    await loadCurrentSessionConversation();

    if (!historyPanel.classList.contains("hidden")) {
        await loadHistoryPanel();
    }
}

Object.keys(tabs).forEach(mode => {
    tabs[mode].addEventListener("click", async () => switchTab(mode));
});

function setBusy(isBusy) {
    loadingIndicator.classList.toggle("hidden", !isBusy);
    btnSubmit.disabled = isBusy;
    btnMic.disabled = isBusy;
}

function clearChatUI() {
    const messages = [...chatContainer.querySelectorAll(".message")];
    messages.forEach(message => message.remove());
    hideThinkingMessage();
    emptyState.classList.remove("hidden");
}

function hideEmptyState() {
    if (!emptyState.classList.contains("hidden")) {
        emptyState.classList.add("hidden");
    }
}

function autoResizeTextarea() {
    userInput.style.height = "auto";
    userInput.style.height = `${Math.min(userInput.scrollHeight, 126)}px`;
}

async function captureSelectionInActivePage(tabId) {
    try {
        return await chrome.tabs.sendMessage(tabId, { type: "AI_WRITER_CAPTURE_SELECTION" });
    } catch (error) {
        return { ok: false, reason: "capture-failed", detail: String(error) };
    }
}

async function insertTextIntoActivePage(tabId, text) {
    try {
        return await chrome.tabs.sendMessage(tabId, {
            type: "AI_WRITER_INSERT_TEXT",
            text
        });
    } catch (error) {
        return { ok: false, reason: "injection-failed", detail: String(error) };
    }
}

// --- Chat UI Logic ---
function toSafeHttpUrl(rawUrl) {
    const value = String(rawUrl || "").trim();
    if (!value) return null;

    try {
        const parsed = new URL(value);
        return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.href : null;
    } catch {
        return null;
    }
}

function createRichTextNodes(input) {
    const text = String(input || "");
    const nodes = [];
    const tokenPattern = /(\*\*[^*\n]+\*\*|\*[^*\n]+\*|`[^`\n]+`|\[[^\]\n]+\]\((https?:\/\/[^\s)]+)\))/g;

    let lastIndex = 0;
    let match;

    while ((match = tokenPattern.exec(text)) !== null) {
        if (match.index > lastIndex) {
            nodes.push(document.createTextNode(text.slice(lastIndex, match.index)));
        }

        const token = match[0];

        if (token.startsWith("**") && token.endsWith("**")) {
            const strong = document.createElement("strong");
            strong.textContent = token.slice(2, -2);
            nodes.push(strong);
        } else if (token.startsWith("*") && token.endsWith("*")) {
            const em = document.createElement("em");
            em.textContent = token.slice(1, -1);
            nodes.push(em);
        } else if (token.startsWith("`") && token.endsWith("`")) {
            const code = document.createElement("code");
            code.textContent = token.slice(1, -1);
            nodes.push(code);
        } else if (token.startsWith("[")) {
            const labelEnd = token.indexOf("](");
            const label = token.slice(1, labelEnd);
            const rawUrl = token.slice(labelEnd + 2, -1);
            const safeUrl = toSafeHttpUrl(rawUrl);

            if (safeUrl) {
                const link = document.createElement("a");
                link.href = safeUrl;
                link.target = "_blank";
                link.rel = "noopener noreferrer";
                link.textContent = label;
                nodes.push(link);
            } else {
                nodes.push(document.createTextNode(token));
            }
        } else {
            nodes.push(document.createTextNode(token));
        }

        lastIndex = tokenPattern.lastIndex;
    }

    if (lastIndex < text.length) {
        nodes.push(document.createTextNode(text.slice(lastIndex)));
    }

    return nodes;
}

function renderPlainTextMessage(container, messageText) {
    container.textContent = "";
    const lines = String(messageText || "").split("\n");

    lines.forEach((line, idx) => {
        container.appendChild(document.createTextNode(line));
        if (idx < lines.length - 1) {
            container.appendChild(document.createElement("br"));
        }
    });
}

function renderRichTextMessage(container, messageText) {
    container.textContent = "";
    const text = String(messageText || "");

    // Avoid expensive recursive markdown parsing on very large model responses.
    if (text.length > MAX_RICH_TEXT_PARSE_CHARS) {
        renderPlainTextMessage(container, text);
        return;
    }

    const lines = text.split("\n");

    lines.forEach((line, idx) => {
        createRichTextNodes(line).forEach(node => container.appendChild(node));
        if (idx < lines.length - 1) {
            container.appendChild(document.createElement("br"));
        }
    });
}

function shouldAnimateTyping(text) {
    if (prefersReducedMotion) return false;
    return String(text || "").length <= MAX_TYPING_ANIMATION_CHARS;
}

function addMessage(text, sender) {
    hideEmptyState();
    const msgDiv = document.createElement("div");
    msgDiv.classList.add("message", sender === "user" ? "msg-user" : "msg-ai");
    renderRichTextMessage(msgDiv, text);
    chatContainer.appendChild(msgDiv);
    // Auto-scroll to bottom
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function renderConversation(messages) {
    clearChatUI();
    if (!messages.length) return;

    hideEmptyState();
    messages.forEach(message => {
        const sender = message.role === "user" ? "user" : "ai";
        addMessage(message.content, sender);
    });
}

function showThinkingMessage() {
    hideEmptyState();
    if (thinkingMessageEl) return;

    thinkingMessageEl = document.createElement("div");
    thinkingMessageEl.classList.add("message", "msg-ai", "msg-thinking");
    thinkingMessageEl.setAttribute("aria-label", "AI is thinking");
    thinkingMessageEl.innerText = "Thinking...";
    chatContainer.appendChild(thinkingMessageEl);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function hideThinkingMessage() {
    if (!thinkingMessageEl) return;
    thinkingMessageEl.remove();
    thinkingMessageEl = null;
}

async function addTypedAIMessage(text) {
    hideThinkingMessage();

    const finalText = text || "No response received.";
    const msgDiv = document.createElement("div");
    msgDiv.classList.add("message", "msg-ai", "msg-typing");
    chatContainer.appendChild(msgDiv);

    if (!shouldAnimateTyping(finalText)) {
        renderRichTextMessage(msgDiv, finalText);
        msgDiv.classList.remove("msg-typing");
        chatContainer.scrollTop = chatContainer.scrollHeight;
        return;
    }

    const textNode = document.createTextNode("");
    msgDiv.appendChild(textNode);

    let index = 0;
    let frameCount = 0;

    while (index < finalText.length) {
        const nextIndex = Math.min(finalText.length, index + TYPING_CHUNK_SIZE);
        textNode.appendData(finalText.slice(index, nextIndex));
        index = nextIndex;
        frameCount += 1;

        if (frameCount % 3 === 0 || index >= finalText.length) {
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }

        await new Promise(resolve => requestAnimationFrame(resolve));
    }

    msgDiv.classList.remove("msg-typing");
    renderRichTextMessage(msgDiv, finalText);
}

// --- History Panel ---
function formatUpdatedAt(timestamp) {
    if (!timestamp) return "Just now";
    return new Date(timestamp).toLocaleString();
}

function renderHistoryList(conversations, activeSessionId) {
    historyList.innerHTML = "";

    if (!conversations.length) {
        const empty = document.createElement("div");
        empty.className = "history-empty";
        empty.textContent = "No previous chats yet for this mode.";
        historyList.appendChild(empty);
        return;
    }

    conversations.forEach(item => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "history-item";
        if (item.sessionId === activeSessionId) {
            button.classList.add("active");
        }

        const title = document.createElement("div");
        title.className = "history-title";
        title.textContent = item.title || "New chat";

        const meta = document.createElement("div");
        meta.className = "history-meta";
        meta.textContent = `${item.messageCount} msgs - ${formatUpdatedAt(item.updatedAt)}`;

        button.appendChild(title);
        button.appendChild(meta);
        button.addEventListener("click", async () => {
            const chatKey = await getCurrentChatKey();
            await setSessionIdForChatKey(chatKey, item.sessionId);
            await loadCurrentSessionConversation();
            await loadHistoryPanel();
        });

        historyList.appendChild(button);
    });
}

async function loadHistoryPanel() {
    const chatKey = await getCurrentChatKey();
    const activeSessionId = await ensureSessionIdForChatKey(chatKey);

    try {
        const response = await fetch(`${BACKEND_BASE_URL}/api/history?chatKey=${encodeURIComponent(chatKey)}`);
        if (!response.ok) throw new Error("history fetch failed");

        const data = await response.json();
        renderHistoryList(data.conversations || [], activeSessionId);
    } catch {
        renderHistoryList([], activeSessionId);
    }
}

btnHistory.addEventListener("click", async () => {
    const willShow = historyPanel.classList.contains("hidden");
    historyPanel.classList.toggle("hidden", !willShow);
    btnHistory.classList.toggle("active", willShow);

    if (willShow) {
        await loadHistoryPanel();
    }
});

btnNewChat.addEventListener("click", async () => {
    await createFreshSessionForCurrentChat();
    clearChatUI();
    if (!historyPanel.classList.contains("hidden")) {
        await loadHistoryPanel();
    }
});

// --- Conversation Load ---
async function loadCurrentSessionConversation() {
    const chatKey = await getCurrentChatKey();
    const sessionId = await ensureSessionIdForChatKey(chatKey);

    try {
        const response = await fetch(`${BACKEND_BASE_URL}/api/history/${encodeURIComponent(sessionId)}`);
        if (!response.ok) throw new Error("history conversation fetch failed");

        const data = await response.json();
        renderConversation(data.messages || []);
    } catch {
        clearChatUI();
    }
}

userInput.addEventListener("input", autoResizeTextarea);

// Allow pressing 'Enter' to send (Shift+Enter for new line)
userInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        btnSubmit.click();
    }
});

// --- Context & Submission ---
async function getPageContext(tab = null) {
    if (!checkContext.checked) return "";
    const activeTab = tab || await getActiveTab();
    if (!activeTab?.id) return "";

    try {
        const result = await chrome.scripting.executeScript({
            target: { tabId: activeTab.id },
            func: () => {
                const selection = window.getSelection().toString();
                if (selection) return selection;
                return document.body.innerText.substring(0, 8000);
            }
        });
        return result[0].result || "";
    } catch {
        return "";
    }
}

btnSubmit.addEventListener("click", async () => {
    const text = userInput.value.trim();
    if (!text) return;

    addMessage(text, "user");
    userInput.value = "";
    autoResizeTextarea();
    setBusy(true);
    showThinkingMessage();

    try {
        const activeTab = await getActiveTab();
        if (currentMode === "write" && activeTab?.id) {
            await captureSelectionInActivePage(activeTab.id);
        }

        const pageContext = await getPageContext(activeTab);
        const chatKey = await getCurrentChatKey();
        const sessionId = await ensureSessionIdForChatKey(chatKey);
        const endpoint = `${BACKEND_BASE_URL}/api/${currentMode}`;
        let requestBody = {};

        if (currentMode === "ask") {
            requestBody = { sessionId, prompt: text, pageContext, chatKey };
        } else if (currentMode === "write") {
            requestBody = { sessionId, context: pageContext, instruction: text, chatKey };
        } else if (currentMode === "translate") {
            const contextToSend = pageContext ? pageContext : "Translate this exactly:";
            requestBody = { sessionId, context: contextToSend, instruction: text, chatKey };
        }

        const response = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) throw new Error(`Server Error: ${response.status}`);
        const data = await response.json();

        setBusy(false);

        if (currentMode === "write" && data.response && activeTab?.id) {
            const pageInsertResult = await insertTextIntoActivePage(activeTab.id, data.response);
            if (!pageInsertResult?.ok) {
                console.warn("Writer-mode page insertion failed:", pageInsertResult);
            }
        }

        await addTypedAIMessage(data.response);

        if (!historyPanel.classList.contains("hidden")) {
            await loadHistoryPanel();
        }
    } catch (error) {
        hideThinkingMessage();
        addMessage("Error: Could not connect to Ktor backend. Is it running?", "ai");
        console.error(error);
    } finally {
        setBusy(false);
    }
});

// --- Voice Submission Logic ---
let mediaRecorder;
let audioChunks = [];
let isRecording = false;

btnMic.addEventListener("click", async () => {
    if (!isRecording) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];

            mediaRecorder.ondataavailable = event => audioChunks.push(event.data);

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
                addMessage("Audio message sent", "user");
                showThinkingMessage();
                await sendVoiceRequest(audioBlob);
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            isRecording = true;
            btnMic.classList.add("recording");
            userInput.placeholder = "Listening... (Click stop to send)";
        } catch {
            addMessage("Error: Microphone access denied.", "ai");
        }
    } else {
        mediaRecorder.stop();
        isRecording = false;
        btnMic.classList.remove("recording");
        updateInputPlaceholder(currentMode);
    }
});

async function sendVoiceRequest(audioBlob) {
    setBusy(true);

    try {
        const pageContext = await getPageContext();
        const chatKey = await getCurrentChatKey();
        const sessionId = await ensureSessionIdForChatKey(chatKey);

        const formData = new FormData();
        formData.append("audio", audioBlob, "voice.webm");
        formData.append("sessionId", sessionId);
        formData.append("mode", currentMode);
        formData.append("context", pageContext);
        formData.append("chatKey", chatKey);

        const response = await fetch(`${BACKEND_BASE_URL}/api/voice`, {
            method: "POST",
            body: formData
        });

        if (!response.ok) throw new Error(`Server Error: ${response.status}`);
        const data = await response.json();

        setBusy(false);
        await addTypedAIMessage(data.response);

        if (!historyPanel.classList.contains("hidden")) {
            await loadHistoryPanel();
        }
    } catch {
        hideThinkingMessage();
        addMessage("Error processing voice request.", "ai");
    } finally {
        setBusy(false);
    }
}

(async function init() {
    updateInputPlaceholder(currentMode);
    autoResizeTextarea();
    await loadCurrentSessionConversation();
})();
