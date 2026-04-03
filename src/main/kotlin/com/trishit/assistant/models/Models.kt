package com.trishit.com.trishit.assistant.models

import kotlinx.serialization.Serializable

@Serializable
data class WriteRequest(
    val sessionId: String,
    val context: String,
    val instruction: String,
    val chatKey: String? = null
)

@Serializable
data class AskRequest(
    val sessionId: String,
    val prompt: String,
    val pageContext: String? = null,
    val chatKey: String? = null
)

@Serializable
data class AIResponse(
    val response: String
)

@Serializable
data class HistoryMessage(
    val role: String,
    val content: String,
    val timestamp: Long
)

@Serializable
data class ConversationSummary(
    val sessionId: String,
    val title: String,
    val updatedAt: Long,
    val messageCount: Int
)

@Serializable
data class ConversationHistoryResponse(
    val sessionId: String,
    val messages: List<HistoryMessage>
)

@Serializable
data class HistoryListResponse(
    val conversations: List<ConversationSummary>
)

@Serializable
data class NewChatRequest(
    val chatKey: String? = null
)

@Serializable
data class NewChatResponse(
    val sessionId: String
)
