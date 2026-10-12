# Questora — Next-Gen AI Search & Document Intelligence

[![Node.js](https://img.shields.io/badge/Node.js-v20+-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-~5.8-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6.2-646cff.svg)](https://vitejs.dev/)
[![Gemini API](https://img.shields.io/badge/Google-Gemini_2.5-4285f4.svg)](https://ai.google.dev/)

**Questora** is an intelligent AI search composer and multimodal workspace powered by Google Gemini and OpenAI. It combines real-time web grounding, deep contextual synthesis, automated slide generation (PowerPoint `.pptx`), research report export (Word `.docx`), an image generation studio, and voice-assisted interactions into a sleek, ultra-responsive glassmorphism interface.

---

## ✨ Features

- **🔍 Multi-Model AI Search & Reasoning**
  - Instant answers powered by Google Gemini (Gemini 2.5 Flash, Gemini 2.5 Pro) with fallback to OpenAI.
  - Live web search grounding with verified source citations, interactive links, and preview cards.

- **📊 AI Slide Deck & PowerPoint Generator**
  - Generates multi-slide presentations dynamically from search queries or custom outlines.
  - Direct, one-click export to authentic Microsoft PowerPoint (`.pptx`) files using `pptxgenjs` alongside interactive HTML slide previews and print-to-PDF options.

- **📄 AI Research Report & Word Generator**
  - Formats in-depth analysis into structured reports with headings, executive summaries, and bullet points.
  - Automatic conversion and download to authentic Microsoft Word (`.docx`) documents using `docx`.

- **🎨 Dynamic Image Generation Studio**
  - Generate visual assets directly from the active topic or custom prompts.
  - Interactive gallery with high-resolution image viewers and prompt copy tools.

- **🎙️ Voice Dictation & Text-to-Speech (TTS)**
  - Voice input with live speech recognition dictation.
  - Natural audio playback for synthesis results and answer summaries.

- **🔐 Local User Authentication & State Persistence**
  - Secure signup and login with hashed passwords (`bcryptjs`).
  - Search history logs, bookmarks collection, and user preferences (theme, default AI model).

---

## 🛠️ Tech Stack

- **Frontend**: HTML5, CSS3 (Tailwind CSS v4 & custom glassmorphism styles), Vanilla JS + React 19, Lucide Icons, FontAwesome
- **Backend**: Node.js, Express, TypeScript, `tsx`
- **AI & Grounding**: Google Gen AI SDK (`@google/genai`), OpenAI SDK (`openai`), Web search grounding
- **Export Engines**: `pptxgenjs` (PowerPoint generation), `docx` (Word document generation)
- **Tooling & Bundler**: Vite 6, esbuild, TypeScript

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- [npm](https://www.npmjs.com/) or [bun](https://bun.sh/)

### 1. Clone the Repository

```bash
git clone https://github.com/souradiproychowdhury-cpu/Questora-.git
cd Questora-
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a `.env.local` or `.env` file in the root directory:

```env
# Required for Gemini AI search and multimodal features
GEMINI_API_KEY="YOUR_GEMINI_API_KEY"

# Optional: For OpenAI models
OPENAI_API_KEY="YOUR_OPENAI_API_KEY"

# Application URL
APP_URL="http://localhost:3000"
```

> **Note**: You can get a free Gemini API key from [Google AI Studio](https://aistudio.google.com/).

### 4. Run the Development Server

```bash
npm run dev
```

Open your browser at [http://localhost:3000](http://localhost:3000).

---

## 📜 Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Runs the Express server with live TypeScript reloading via `tsx` |
| `npm run build` | Compiles the frontend with Vite and bundles `server.ts` into `dist/server.cjs` |
| `npm start` | Starts the production server bundle |
| `npm run preview` | Previews the Vite production build locally |
| `npm run lint` | Runs TypeScript type checking (`tsc --noEmit`) |

---

## 📁 Project Structure

```
Questora-/
├── data/                  # Local database storage (store.json auto-initialized)
├── public/                # Static public assets (images, fonts, welcome graphics)
├── server/                # Backend API routes & logic
│   ├── ai.ts              # Gemini & OpenAI model handlers
│   ├── db.ts              # Local database & state management
│   └── webSearch.ts       # Real-time search query formulation & grounding
├── src/                   # React components, services, and client assets
├── index.html             # Main application interface
├── main.js                # Core frontend client logic & interactions
├── features.js            # Auxiliary feature module
├── server.ts              # Express application entry point & API endpoints
├── styles.css             # Glassmorphism design system & responsive styling
├── package.json           # Dependencies and scripts
└── vite.config.ts         # Vite bundler configuration
```

---

## 🔒 Security & Privacy

- All `.env` and `.env.local` files containing API keys are excluded via `.gitignore`.
- Local user records and session data stored in `data/store.json` are excluded from version control.

---

## 📄 License

ISC License.
