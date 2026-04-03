package com.trishit

import com.trishit.com.trishit.assistant.models.HistoryListResponse
import com.trishit.com.trishit.assistant.models.NewChatResponse
import com.trishit.com.trishit.assistant.module
import io.ktor.client.request.get
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import io.ktor.server.testing.testApplication
import kotlinx.serialization.json.Json
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class ApplicationTest {
    private val json = Json { ignoreUnknownKeys = true }

    @Test
    fun testRoot() = testApplication {
        application {
            module()
        }
        client.get("/").apply {
            assertEquals(HttpStatusCode.OK, status)
        }
    }

    @Test
    fun testNewChatAndHistoryList() = testApplication {
        application {
            module()
        }

        val chatKey = "test-tab:ask"
        val createResponse = client.post("/api/chat/new") {
            contentType(ContentType.Application.Json)
            setBody("{\"chatKey\":\"$chatKey\"}")
        }

        assertEquals(HttpStatusCode.OK, createResponse.status)
        val newChat = json.decodeFromString<NewChatResponse>(createResponse.bodyAsText())
        assertTrue(newChat.sessionId.isNotBlank())

        val historyResponse = client.get("/api/history?chatKey=$chatKey")
        assertEquals(HttpStatusCode.OK, historyResponse.status)

        val history = json.decodeFromString<HistoryListResponse>(historyResponse.bodyAsText())
        assertTrue(history.conversations.any { it.sessionId == newChat.sessionId })
    }

    @Test
    fun testHistoryBySessionId() = testApplication {
        application {
            module()
        }

        val createResponse = client.post("/api/chat/new") {
            contentType(ContentType.Application.Json)
            setBody("{\"chatKey\":\"test-tab:write\"}")
        }

        val newChat = json.decodeFromString<NewChatResponse>(createResponse.bodyAsText())
        val sessionResponse = client.get("/api/history/${newChat.sessionId}")

        assertEquals(HttpStatusCode.OK, sessionResponse.status)
    }
}
