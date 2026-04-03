package com.trishit.com.trishit.assistant.plugins

import ai.koog.agents.chatMemory.feature.ChatMemory
import ai.koog.ktor.Koog
import com.trishit.com.trishit.assistant.tools.fetchWebsiteContent
import com.trishit.com.trishit.assistant.tools.getCurrentTime
import io.ktor.server.application.*

fun Application.configureKoog() {
    install(Koog) {
        llm {
            google(apiKey = System.getenv("GEMINI_API_KEY") ?: throw Exception("Missing GEMINI_API_KEY"))
        }
        agentConfig {
            install(ChatMemory)

            maxAgentIterations = 5
            registerTools {
                tool(::getCurrentTime)
                tool(::fetchWebsiteContent)
            }
        }
    }
}