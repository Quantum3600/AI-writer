<div align="center">

  <img src="extension/icon.png" alt="AI-Writer Logo" width="150" />

  <h1>✍️ AI-Writer</h1>
  
  <p><strong>Your intelligent, AI-powered browser assistant. Ask, write, and translate faster.</strong></p>

  <p>
    <img alt="Kotlin" src="https://img.shields.io/badge/Kotlin-B125EA?style=for-the-badge&logo=kotlin&logoColor=white" />
    <img alt="Ktor" src="https://img.shields.io/badge/Ktor-087CFA?style=for-the-badge&logo=ktor&logoColor=white" />
    <img alt="Manifest V3" src="https://img.shields.io/badge/Manifest_V3-4285F4?style=for-the-badge&logo=google-chrome&logoColor=white" />
    <br/>
    <a href="https://github.com/Quantum3600/AI-writer/issues"><img alt="PRs Welcome" src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=for-the-badge" /></a>
    <a href="LICENSE"><img alt="License" src="https://img.shields.io/badge/License-MIT-success?style=for-the-badge" /></a>
  </p>

</div>

---

**AI-Writer** is an intelligent, AI-powered browser extension designed to supercharge your web experience. Whether you need to digest long articles, ask specific questions about a webpage, translate text, or generate fresh content on the fly, AI-Writer acts as your personal, context-aware web assistant.

## ✨ Features

- **📝 Webpage Summarization & Q&A (Ask):** Instantly generate concise summaries or ask questions based directly on the content of the webpage you are currently reading.
- **💡 Content Generation (Write):** Need to write an email, reply to a thread, or draft a post? Let the AI assist you right in your browser, and inject the text directly into the page.
- **🌍 Instant Translation:** Effortlessly translate complex web content or specific selections into any language.
- **🎙️ Voice Input:** Tired of typing? Use the built-in microphone feature to speak your prompts and instructions directly to the AI.
- **📜 Conversation History:** Never lose your context. AI-Writer saves your chat sessions per tab and mode so you can pick up exactly where you left off.

---

## 📸 Screenshots

| Ask | Write | Translate |
|------|-------|-----------|
| <img src=".github/public/Screenshot 2026-04-03 190845.png" alt="Alt Text" width="300"> | <img src="path/to/image.png" alt="Alt Text" width="300"> | <img src="path/to/image.png" alt="Alt Text" width="300"> |

---

## 🛠️ Architecture & Tech Stack

This project uses a modern, strictly separated architecture to ensure scalability, security, and ease of maintenance:

| Component | Technology | Description |
| :--- | :--- | :--- |
| **🎨 Frontend** | **Manifest V3** | Modern, secure, and performant browser extension integration with Vanilla JS & CSS. |
| **⚙️ Backend** | **Ktor (Kotlin)** | Handles high-concurrency server-side operations and API routing seamlessly. |
| **🧠 AI Agent** | **Koog Framework (Kotlin)** | Decouples the intelligent LLM agent logic from the backend infrastructure. |

---

## 📖 Developer's Journey

This project marks my first deep dive into **Kotlin** beyond traditional Android, Multiplatform and frontend web development. Building AI-Writer allowed me to explore Kotlin's evolving maturity and flexibility across diverse server-side and AI use cases.

**Key Takeaways:**
* 🚀 **Ktor vs. The World:** I found Ktor to be incredibly lightweight yet increasingly powerful, standing strong against traditional backend frameworks like Spring Boot, Node.js, and FastAPI.
* 🤖 **Koog Framework:** Building AI agents doesn't have to be complicated. Koog provided a simple, intuitive, and highly effective way to integrate LLM logic without bloating the codebase.

---

## 🚀 Getting Started

### Prerequisites

* ☕ **JDK 21** (Required by the backend configuration)
* 🐘 **Gradle**
* 🌐 **A Chromium-based browser** (Chrome, Edge, Brave, etc.)

### 1️⃣ Running the Backend (Ktor + Koog)

1. Clone the repository:
   ```bash
   git clone [https://github.com/Quantum3600/AI-writer.git](https://github.com/Quantum3600/AI-writer.git)
   cd AI-writer
   ```
2. Set up your AI API keys. Export your Gemini API key in your terminal or add it to your environment:
   ```bash
   export GEMINI_API_KEY="your_api_key_here"
   ```
3. Run the Ktor server:
   ```bash
   ./gradlew run
   ```
   *The server will start running on http://localhost:8080.*
---

### 2️⃣ Load the Extension

1. Go to `chrome://extensions/`
2. Enable **Developer Mode**
3. Click **Load Unpacked**
4. Select the `extension` folder

📌 Pin the extension and start using it from your browser toolbar.

---

## 🤝 Contributing

Contributions are welcome!

* Open an issue for bugs or feature requests
* Submit pull requests for improvements
* Share ideas to enhance the project

---

## 📄 License

This project is licensed under the **MIT License**.
See the `LICENSE` file for more details.

---

✨ *AI-Writer is a step toward building intelligent, context-aware tools that seamlessly integrate into everyday workflows.*
