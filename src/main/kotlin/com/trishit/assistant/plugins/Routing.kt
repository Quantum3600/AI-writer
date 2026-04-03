package com.trishit.com.trishit.assistant.plugins

import ai.koog.ktor.llm
import ai.koog.prompt.dsl.prompt
import ai.koog.prompt.executor.clients.google.GoogleModels
import com.trishit.com.trishit.assistant.models.AIResponse
import com.trishit.com.trishit.assistant.models.AskRequest
import com.trishit.com.trishit.assistant.models.WriteRequest
import io.ktor.http.content.*
import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.plugins.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import io.ktor.utils.io.jvm.javaio.*
import java.io.File
import java.util.*

private fun requireSessionId(rawSessionId: String?): String {
    val sessionId = rawSessionId?.trim().orEmpty()
    if (sessionId.isBlank()) {
        throw BadRequestException("sessionId is required")
    }
    return sessionId
}

fun Application.configureRouting() {
    routing {
        get("/") {
            call.respondText("OK", ContentType.Text.Plain, HttpStatusCode.OK)
        }

        post("/api/ask") {
            try {
                val request = call.receive<AskRequest>()
                val sessionId = requireSessionId(request.sessionId)
                val promptText = if (!request.pageContext.isNullOrBlank()) {
                    "Webpage Context:\n---\n${request.pageContext}\n---\nQuestion: ${request.prompt}"
                } else {
                    request.prompt
                }

                val messages = llm().execute(
                    prompt(sessionId) {
                        system("You are a helpful AI assistant powering a browser extension. Answer clearly and concisely.")
                        user(promptText)
                    },
                    GoogleModels.Gemini2_5Flash
                )
                val output = messages.joinToString(separator = "") { it.content }
                call.respond(AIResponse(output))
            } catch (e: BadRequestException) {
                call.respond(HttpStatusCode.BadRequest, AIResponse("Error: ${e.message}"))
            } catch (e: Exception) {
                call.respond(AIResponse("Error: ${e.message}"))
            }
        }

        post("/api/write") {
            try {
                val request = call.receive<WriteRequest>()
                val sessionId = requireSessionId(request.sessionId)
                val messages = llm().execute(
                    prompt(sessionId) {
                        system("You are an expert writing assistant. Follow the instructions to draft, expand, or rewrite text. Provide ONLY the final text without conversational filler.")
                        user("Context: ${request.context}\n\nInstructions: ${request.instruction}")
                    },
                    GoogleModels.Gemini2_5Flash
                )

                val output = messages.joinToString(separator = "") { it.content }
                call.respond(AIResponse(output))
            } catch (e: BadRequestException) {
                call.respond(HttpStatusCode.BadRequest, AIResponse("Error: ${e.message}"))
            } catch (e: Exception) {
                call.respond(AIResponse("Error: ${e.message}"))
            }
        }

        post("/api/translate") {
            try {
                val request = call.receive<WriteRequest>()
                val sessionId = requireSessionId(request.sessionId)
                val messages = llm().execute(
                    prompt(sessionId) {
                        system("You are an expert polyglot and linguistic translator. Provide ONLY the direct translation in the requested script/language. Do not include conversational filler.")
                        user("Text to translate:\n${request.context}\n\nInstructions: ${request.instruction}")
                    },
                    GoogleModels.Gemini2_5Flash
                )

                val output = messages.joinToString(separator = "") { it.content }
                call.respond(AIResponse(output))
            } catch (e: BadRequestException) {
                call.respond(HttpStatusCode.BadRequest, AIResponse("Error: ${e.message}"))
            } catch (e: Exception) {
                call.respond(AIResponse("Error: ${e.message}"))
            }
        }

        post("/api/voice") {
            val multipart = call.receiveMultipart()
            var sessionId: String? = null
            var mode = "ask"
            var pageContext = ""
            var audioFile: File? = null

            multipart.forEachPart { part ->
                when (part) {
                    is PartData.FormItem -> {
                        when (part.name) {
                            "sessionId" -> sessionId = part.value
                            "mode" -> mode = part.value
                            "context" -> pageContext = part.value
                        }
                    }
                    is PartData.FileItem -> {
                        val ext = File(part.originalFileName ?: "voice.webm").extension
                        audioFile = File.createTempFile("upload_${UUID.randomUUID()}", ".$ext")
                        part.provider().toInputStream().use { input ->
                            audioFile!!.outputStream().buffered().use { output ->
                                input.copyTo(output)
                            }
                        }
                    }
                    else -> {}
                }
                part.dispose()
            }

            try {
                if (audioFile == null) throw IllegalArgumentException("No audio file received")
                val resolvedSessionId = requireSessionId(sessionId)

                val textPrompt = if (pageContext.isNotBlank() && mode != "translate") {
                    "Webpage Context:\n---\n$pageContext\n---\nListen to the attached audio instruction regarding this text."
                } else if (pageContext.isNotBlank() && mode == "translate") {
                    "Text to translate:\n---\n$pageContext\n---\nListen to the attached audio to know which language to translate this to."
                } else {
                    "Listen to the attached audio and follow the instructions."
                }

                // Determine system prompt based on mode
                val sysPrompt = when (mode) {
                    "write" -> "You are an expert writing assistant. Follow the audio instructions to draft, expand, or rewrite text. Provide ONLY the final text without conversational filler."
                    "translate" -> "You are an expert polyglot and linguistic translator. Provide ONLY the direct translation in the requested script/language. Do not include conversational filler."
                    else -> "You are a helpful AI assistant. Answer the user's questions clearly and accurately."
                }

                val messages = llm().execute(
                    prompt(resolvedSessionId) {
                        system(sysPrompt)
                        user {
                            text(textPrompt)
                            audio(audioFile.absolutePath)
                        }
                    },
                    GoogleModels.Gemini2_5Flash
                )

                val output = messages.joinToString(separator = "") { it.content }
                call.respond(AIResponse(output))

            } catch (e: BadRequestException) {
                call.respond(HttpStatusCode.BadRequest, AIResponse("Error: ${e.message}"))
            } catch (e: Exception) {
                call.respond(AIResponse("Error: ${e.message}"))
            } finally {
                audioFile?.delete()
            }
        }
    }
}
