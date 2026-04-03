package com.trishit.com.trishit.assistant

import com.trishit.com.trishit.assistant.plugins.configureHTTP
import com.trishit.com.trishit.assistant.plugins.configureKoog
import com.trishit.com.trishit.assistant.plugins.configureRouting
import com.trishit.com.trishit.assistant.plugins.configureSerialization
import io.ktor.server.application.*
import io.ktor.server.netty.EngineMain

fun main(args: Array<String>) {
    EngineMain.main(args)
}

fun Application.module() {
    configureHTTP()
    configureSerialization()
    configureKoog()
    configureRouting()
}
