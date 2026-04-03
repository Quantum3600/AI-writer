const CHAT_SESSION_STORAGE_KEY = "chatSessionsByTabAndMode";
let currentMode = "ask";

function createSessionId() {
    return "session_" + Date.now().toString(36) + "_" + Math.random().toString(36).substring(2, 10);
}

async function getSessionIdForCurrentChat() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const tabKey = tab?.id ?? "no-tab";
    const chatKey = `${tabKey}:${currentMode}`;

    const stored = await chrome.storage.local.get(CHAT_SESSION_STORAGE_KEY);
    const sessions = stored[CHAT_SESSION_STORAGE_KEY] || {};

    if (!sessions[chatKey]) {
        sessions[chatKey] = createSessionId();
        await chrome.storage.local.set({ [CHAT_SESSION_STORAGE_KEY]: sessions });
    }

    return sessions[chatKey];
}

const tabAsk = document.getElementById("tab-ask");
const tabWrite = document.getElementById("tab-write");
const tabTranslate = document.getElementById("tab-translate");
const userInput = document.getElementById("user-input");
const btnSubmit = document.getElementById("btn-submit");
const btnMic = document.getElementById("btn-mic");
const checkContext = document.getElementById("use-context");
const responseOutput = document.getElementById("response-output");
const loadingIndicator = document.getElementById("loading");

// Tab Handling
function resetTabs() {
    [tabAsk, tabWrite, tabTranslate].forEach(tab => tab.classList.remove("active"));
}

tabAsk.addEventListener("click", () => {
    currentMode = "ask";
    resetTabs();
    tabAsk.classList.add("active");
    userInput.placeholder = "Ask a question about this page...";
});

tabWrite.addEventListener("click", () => {
    currentMode = "write";
    resetTabs();
    tabWrite.classList.add("active");
    userInput.placeholder = "Instructions (e.g., Rewrite this paragraph to be more formal)...";
});

tabTranslate.addEventListener("click", () => {
    currentMode = "translate";
    resetTabs();
    tabTranslate.classList.add("active");
    userInput.placeholder = "Target language? (e.g., Japanese). Optionally highlight text on the page.";
});

// Page Context Extraction
async function getPageContext() {
    if (!checkContext.checked) return "";
    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return "";
    
    try {
        const result = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
                const selection = window.getSelection().toString();
                if (selection) return selection;
                return document.body.innerText.substring(0, 8000); 
            }
        });
        return result[0].result || "";
    } catch (e) {
        console.log("Cannot extract context from this tab.");
        return "";
    }
}

// Text Submission
btnSubmit.addEventListener("click", async () => {
    const text = userInput.value.trim();
    if (!text) return;

    responseOutput.innerText = "";
    loadingIndicator.classList.remove("hidden");
    btnSubmit.disabled = true;

    try {
        const sessionId = await getSessionIdForCurrentChat();
        const pageContext = await getPageContext();
        let endpoint = `http://localhost:8080/api/${currentMode}`;
        let requestBody = {};

        if (currentMode === "ask") {
            requestBody = { sessionId, prompt: text, pageContext };
        } else if (currentMode === "write") {
            requestBody = { sessionId, context: pageContext, instruction: text };
        } else if (currentMode === "translate") {
            const contextToSend = pageContext ? pageContext : "Translate this exactly:";
            requestBody = { sessionId, context: contextToSend, instruction: text };
        }

        const response = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestBody)
        });

        const data = await response.json();
        responseOutput.innerText = data.response || "No response received.";

    } catch (error) {
        responseOutput.innerText = "Error: Could not connect to backend.";
        console.error(error);
    } finally {
        loadingIndicator.classList.add("hidden");
        btnSubmit.disabled = false;
    }
});

// Voice Submission Logic
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
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                await sendVoiceRequest(audioBlob);
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            isRecording = true;
            btnMic.style.background = "#ff1744";
            btnMic.innerText = "⏹";
            userInput.placeholder = "Listening...";
        } catch (err) {
            responseOutput.innerText = "Microphone access denied.";
        }
    } else {
        mediaRecorder.stop();
        isRecording = false;
        btnMic.style.background = "#ff5252";
        btnMic.innerText = "🎤";
        userInput.placeholder = "Processing voice...";
    }
});

async function sendVoiceRequest(audioBlob) {
    responseOutput.innerText = "";
    loadingIndicator.classList.remove("hidden");

    try {
        const sessionId = await getSessionIdForCurrentChat();
        const pageContext = await getPageContext();
        const formData = new FormData();
        formData.append("audio", audioBlob, "voice.webm");
        formData.append("sessionId", sessionId);
        formData.append("mode", currentMode);
        formData.append("context", pageContext);

        const response = await fetch("http://localhost:8080/api/voice", {
            method: "POST",
            body: formData
        });

        const data = await response.json();
        responseOutput.innerText = data.response || "No response received.";
    } catch (error) {
        responseOutput.innerText = "Error processing voice.";
    } finally {
        loadingIndicator.classList.add("hidden");
    }
}