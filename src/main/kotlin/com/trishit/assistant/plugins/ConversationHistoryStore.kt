package com.trishit.com.trishit.assistant.plugins

import com.trishit.com.trishit.assistant.models.ConversationSummary
import com.trishit.com.trishit.assistant.models.HistoryMessage
import java.util.Collections
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

private data class ConversationState(
    val sessionId: String,
    val messages: MutableList<HistoryMessage> = Collections.synchronizedList(mutableListOf()),
    @Volatile var updatedAt: Long = System.currentTimeMillis(),
    @Volatile var title: String = "New chat"
)

object ConversationHistoryStore {
    private val conversationsBySessionId = ConcurrentHashMap<String, ConversationState>()
    private val sessionIdsByChatKey = ConcurrentHashMap<String, MutableList<String>>()

    fun createSession(chatKey: String? = null): String {
        val sessionId = "session_${UUID.randomUUID()}"
        ensureSession(sessionId, chatKey)
        return sessionId
    }

    fun ensureSession(sessionId: String, chatKey: String? = null) {
        val state = conversationsBySessionId.computeIfAbsent(sessionId) { ConversationState(sessionId = sessionId) }
        val normalizedChatKey = chatKey?.trim().orEmpty()
        if (normalizedChatKey.isNotBlank()) {
            val sessions = sessionIdsByChatKey.computeIfAbsent(normalizedChatKey) {
                Collections.synchronizedList(mutableListOf())
            }
            synchronized(sessions) {
                if (!sessions.contains(sessionId)) {
                    sessions.add(0, sessionId)
                }
            }
        }
        state.updatedAt = System.currentTimeMillis()
    }

    fun appendUserMessage(sessionId: String, content: String) {
        appendMessage(sessionId, "user", content)
    }

    fun appendAssistantMessage(sessionId: String, content: String) {
        appendMessage(sessionId, "assistant", content)
    }

    private fun appendMessage(sessionId: String, role: String, content: String) {
        val trimmed = content.trim()
        if (trimmed.isEmpty()) return

        val state = conversationsBySessionId.computeIfAbsent(sessionId) { ConversationState(sessionId = sessionId) }
        val now = System.currentTimeMillis()
        state.messages.add(HistoryMessage(role = role, content = trimmed, timestamp = now))
        state.updatedAt = now

        if (state.title == "New chat" && role == "user") {
            state.title = buildTitle(trimmed)
        }
    }

    fun listSummaries(chatKey: String): List<ConversationSummary> {
        val sessions = sessionIdsByChatKey[chatKey] ?: return emptyList()
        return synchronized(sessions) {
            sessions.mapNotNull { sessionId ->
                conversationsBySessionId[sessionId]?.let { state ->
                    ConversationSummary(
                        sessionId = state.sessionId,
                        title = state.title,
                        updatedAt = state.updatedAt,
                        messageCount = state.messages.size
                    )
                }
            }.sortedByDescending { it.updatedAt }
        }
    }

    fun getMessages(sessionId: String): List<HistoryMessage> {
        val state = conversationsBySessionId[sessionId] ?: return emptyList()
        return state.messages.toList()
    }

    private fun buildTitle(content: String): String {
        val oneLine = content.replace("\n", " ").trim()
        return if (oneLine.length <= 56) oneLine else "${oneLine.take(53)}..."
    }
}

