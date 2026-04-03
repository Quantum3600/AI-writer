package com.trishit.com.trishit.assistant.tools

import ai.koog.agents.core.tools.annotations.LLMDescription
import ai.koog.agents.core.tools.annotations.Tool
import java.net.URI
import java.time.LocalDateTime

@Tool
@LLMDescription("Gets the current local date and time.")
fun getCurrentTime(): String {
    return "The current local time is ${LocalDateTime.now()}"
}

@Tool
@LLMDescription("Fetches the text content of a given URL from the internet.")
fun fetchWebsiteContent(
    @LLMDescription("The full HTTP/HTTPS URL to fetch") url: String
): String {
    return try {
        URI(url).toURL().readText().take(5000)
    } catch (e: Exception) {
        "Error fetching website: ${e.message}"
    }
}