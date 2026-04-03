# ✍️ AI-Writer

![Kotlin](https://img.shields.io/badge/Kotlin-B125EA?style=for-the-badge&logo=kotlin&logoColor=white)
![Ktor](https://img.shields.io/badge/Ktor-087CFA?style=for-the-badge&logo=ktor&logoColor=white)
![Manifest V3](https://img.shields.io/badge/Manifest_V3-4285F4?style=for-the-badge&logo=google-chrome&logoColor=white)

**AI-Writer** is an intelligent, AI-powered browser extension designed to enhance your web experience. Whether you need to digest long articles, ask specific questions about a webpage, or generate fresh content on the fly, AI-Writer acts as your personal web-browsing assistant.

## ✨ Features

- **📝 Webpage Summarization:** Instantly generate concise, accurate summaries of long articles, blogs, or documentation.
- **💬 Contextual Q&A:** Ask questions based directly on the content of the webpage you are currently reading.
- **💡 Content Generation:** Need to write an email, reply to a thread, or draft a post? Let the AI assist you right in your browser.

## 🛠️ Architecture & Tech Stack

This project uses a modern, strictly separated architecture to ensure scalability and ease of maintenance:

*   **Frontend (Browser Extension):** Built using **Manifest V3** for modern, secure, and performant browser integration.
*   **Backend Server:** Powered by **Ktor**, handling high-concurrency server-side operations and API routing. 
*   **AI Agent:** Developed using the **Koog** AI Agent framework, completely decoupling the intelligent agent logic from the backend infrastructure.

## 📖 Developer's Journey

This project marks my first deep dive into **Kotlin** beyond traditional Android and frontend web development. Building AI-Writer allowed me to explore Kotlin's evolving maturity and flexibility across diverse server-side and AI use cases.

Throughout this journey, I gained hands-on experience in:
- Backend system design
- AI agent architecture and orchestration
- Browser extension development using modern manifest-based systems

**Key Takeaways:**
- **Ktor vs. The World:** I found Ktor to be incredibly lightweight yet increasingly powerful, standing strong against traditional backend frameworks like Spring Boot, Node.js, and FastAPI.
- **Koog Framework:** Building AI agents doesn't have to be complicated. Koog provided a simple, intuitive, and highly effective way to integrate LLM logic without bloating the codebase.

## 🚀 Getting Started

### Prerequisites
- JDK 11 or higher
- Gradle
- A Chromium-based browser (Chrome, Edge, Brave)

### Running the Backend (Ktor + Koog)
1. Clone the repository:
   ```bash
   git clone https://github.com/Quantum3600/AI-writer.git
   cd AI-writer/backend
   ```
2. Set up your AI API keys in an `.env` file.
3. Run the Ktor server:
   ```bash
   ./gradlew run
   ```

### Loading the Extension
1. Open your browser and navigate to the extensions page (e.g., `chrome://extensions/`).
2. Enable **Developer mode** in the top right corner.
3. Click **Load unpacked** and select the `extension` directory from this repository.
4. Pin the extension to your toolbar and start writing!

## 🤝 Contributing
Contributions, issues, and feature requests are welcome! Feel free to check the [issues page](https://github.com/Quantum3600/AI-writer/issues) if you want to contribute.

## 📄 License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
