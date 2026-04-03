const CAPTURE_SELECTION_MESSAGE = "AI_WRITER_CAPTURE_SELECTION";
const INSERT_TEXT_MESSAGE = "AI_WRITER_INSERT_TEXT";

let lastSelectionSnapshot = null;
let suppressSelectionSnapshot = 0;
let lastSnapshotAt = 0;
const SNAPSHOT_THROTTLE_MS = 120;
let snapshotScheduled = false;

function isTextControl(element) {
    return element instanceof HTMLTextAreaElement ||
        (element instanceof HTMLInputElement && ["text", "search", "url", "tel", "email", "password", "number"].includes(element.type));
}

function getEditableHost(node) {
    if (!(node instanceof Node)) return null;
    const element = node instanceof Element ? node : node.parentElement;
    return element?.closest?.("[contenteditable='true'], [contenteditable='plaintext-only']") || null;
}

function cloneCurrentSelection(force = false) {
    if (suppressSelectionSnapshot > 0) {
        return lastSelectionSnapshot;
    }

    const now = Date.now();
    if (!force && now - lastSnapshotAt < SNAPSHOT_THROTTLE_MS) {
        return lastSelectionSnapshot;
    }
    lastSnapshotAt = now;

    const active = document.activeElement;

    if (isTextControl(active) && !active.disabled && !active.readOnly) {
        lastSelectionSnapshot = {
            kind: "control",
            element: active,
            start: active.selectionStart ?? active.value.length,
            end: active.selectionEnd ?? active.value.length
        };
        return lastSelectionSnapshot;
    }

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return null;

    const host = getEditableHost(selection.anchorNode) || (active instanceof HTMLElement && active.isContentEditable ? active : null);
    if (!host) return null;

    lastSelectionSnapshot = {
        kind: "range",
        host,
        range: selection.getRangeAt(0).cloneRange()
    };
    return lastSelectionSnapshot;
}

function scheduleSelectionSnapshot() {
    if (snapshotScheduled || suppressSelectionSnapshot > 0) return;
    snapshotScheduled = true;

    setTimeout(() => {
        snapshotScheduled = false;
        cloneCurrentSelection(false);
    }, 0);
}

function withSelectionSnapshotSuppressed(operation) {
    suppressSelectionSnapshot += 1;
    try {
        return operation();
    } finally {
        suppressSelectionSnapshot = Math.max(0, suppressSelectionSnapshot - 1);
    }
}

function restoreSelectionSnapshot() {
    const snapshot = lastSelectionSnapshot;
    if (!snapshot) return null;

    if (snapshot.kind === "control") {
        if (!snapshot.element?.isConnected || snapshot.element.disabled || snapshot.element.readOnly) return null;
        return withSelectionSnapshotSuppressed(() => {
            snapshot.element.focus();
            snapshot.element.setSelectionRange(snapshot.start, snapshot.end);
            return snapshot.element;
        });
    }

    if (snapshot.kind === "range") {
        if (!snapshot.host?.isConnected) return null;
        return withSelectionSnapshotSuppressed(() => {
            snapshot.host.focus();
            const selection = window.getSelection();
            if (!selection) return null;
            selection.removeAllRanges();
            selection.addRange(snapshot.range.cloneRange());
            return snapshot.host;
        });
    }

    return null;
}

function dispatchInputEvent(target, text) {
    try {
        target.dispatchEvent(new InputEvent("input", {
            bubbles: true,
            cancelable: true,
            data: text,
            inputType: "insertText"
        }));
    } catch {
        target.dispatchEvent(new Event("input", { bubbles: true }));
    }
}

function insertIntoControl(control, text) {
    const start = control.selectionStart ?? control.value.length;
    const end = control.selectionEnd ?? control.value.length;
    control.setRangeText(text, start, end, "end");
    dispatchInputEvent(control, text);
    return true;
}

function insertIntoContentEditable(text) {
    const selection = window.getSelection();
    const active = document.activeElement;

    if (!selection) return false;

    const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
    if (range) {
        range.deleteContents();
        const lines = String(text).split("\n");

        // Preserve line breaks when inserting into rich editors.
        lines.forEach((line, index) => {
            if (line) {
                range.insertNode(document.createTextNode(line));
                range.collapse(false);
            }
            if (index < lines.length - 1) {
                const br = document.createElement("br");
                range.insertNode(br);
                range.setStartAfter(br);
                range.collapse(true);
            }
        });

        selection.removeAllRanges();
        selection.addRange(range);
        if (active instanceof HTMLElement) {
            dispatchInputEvent(active, text);
        }
        return true;
    }

    const inserted = document.execCommand?.("insertText", false, text);
    if (inserted && active instanceof HTMLElement) {
        dispatchInputEvent(active, text);
    }
    return Boolean(inserted);
}

function insertUsingPasteEvent(target, text) {
    try {
        const dataTransfer = new DataTransfer();
        dataTransfer.setData("text/plain", text);
        const event = new ClipboardEvent("paste", {
            bubbles: true,
            cancelable: true,
            clipboardData: dataTransfer
        });
        return target.dispatchEvent(event);
    } catch {
        return false;
    }
}

function insertIntoGoogleDocs(text) {
    const docsEditor = document.querySelector("textarea.kix-appview-editor") || document.querySelector("textarea.docs-texteventtarget-iframe");
    if (!(docsEditor instanceof HTMLTextAreaElement)) return { ok: false, reason: "no-docs-editor" };

    docsEditor.focus();

    // Docs often listens to insertText or paste events on the hidden editor target.
    if (document.execCommand?.("insertText", false, text)) {
        return { ok: true, method: "google-docs-execCommand" };
    }

    if (insertUsingPasteEvent(docsEditor, text)) {
        return { ok: true, method: "google-docs-paste" };
    }

    try {
        docsEditor.setRangeText(text, docsEditor.selectionStart ?? 0, docsEditor.selectionEnd ?? 0, "end");
        dispatchInputEvent(docsEditor, text);
        return { ok: true, method: "google-docs-textarea" };
    } catch {
        return { ok: false, reason: "google-docs-insert-failed" };
    }
}

function isGoogleDocsPage() {
    return location.hostname === "docs.google.com" && location.pathname.startsWith("/document/");
}

function captureSelection() {
    const snapshot = cloneCurrentSelection(true) || lastSelectionSnapshot;
    if (!snapshot) {
        return { ok: false, reason: "no-selection" };
    }

    return {
        ok: true,
        kind: snapshot.kind
    };
}

function insertText(text) {
    const incomingText = String(text ?? "");
    if (!incomingText) return { ok: false, reason: "empty-text" };

    const restored = restoreSelectionSnapshot();
    if (!restored) {
        cloneCurrentSelection(true);
    }

    const active = document.activeElement;
    if (isTextControl(active) && !active.disabled && !active.readOnly) {
        return withSelectionSnapshotSuppressed(() => ({ ok: insertIntoControl(active, incomingText), method: "control" }));
    }

    if (active instanceof HTMLElement && active.isContentEditable) {
        const inserted = withSelectionSnapshotSuppressed(() => insertIntoContentEditable(incomingText));
        if (inserted) return { ok: true, method: "contenteditable" };
    }

    if (isGoogleDocsPage()) {
        const docsResult = withSelectionSnapshotSuppressed(() => insertIntoGoogleDocs(incomingText));
        if (docsResult.ok) return docsResult;
    }

    const inserted = document.execCommand?.("insertText", false, incomingText);
    if (inserted) {
        return { ok: true, method: "execCommand" };
    }

    if (active instanceof HTMLElement && insertUsingPasteEvent(active, incomingText)) {
        return { ok: true, method: "paste-event" };
    }

    return { ok: false, reason: "unsupported-target" };
}

function handleMessage(message, sender, sendResponse) {
    if (message?.type === CAPTURE_SELECTION_MESSAGE) {
        sendResponse(captureSelection());
        return true;
    }

    if (message?.type === INSERT_TEXT_MESSAGE) {
        sendResponse(insertText(message.text));
        return true;
    }

    return false;
}

// Keep a lightweight caret snapshot in sync without listening to high-frequency selectionchange loops.
document.addEventListener("mouseup", scheduleSelectionSnapshot, true);
document.addEventListener("keyup", scheduleSelectionSnapshot, true);

document.addEventListener("blur", () => {
    snapshotScheduled = false;
}, true);

chrome.runtime.onMessage.addListener(handleMessage);

