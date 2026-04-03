package com.trishit.com.trishit.assistant.models

import kotlinx.serialization.Serializable

@Serializable
data class WriteRequest(
    val sessionId: String,
    val context: String,
    val instruction: String
)
@Serializable
data class AskRequest(
    val sessionId: String,
    val prompt: String,
    val pageContext: String? = null
)
@Serializable
data class AIResponse(
    val response: String
)