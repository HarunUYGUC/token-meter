# Changelog

All notable changes to the **Token Meter** extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.1.2] - 2026-08-30

### 🌟 New Features & Enhancements
* **Segmented Context Progress Bar**: Multi-colored dual-segment capacity bar visually splitting workspace code (cyan/green) and simulated prompt overhead (purple).
* **Live Prompt Formula Display**: Real-time context formula in the header (`Workspace Context: 51.3k tokens + Prompt: 15.4k = 66.7k Total`).
* **Binary Exclusion Fix**: Automatically excludes `.vsix` binary archive packages from workspace token counts.
* **UI Polish**: Simplified Prompt Simulator button tooltip and updated visual documentation assets.

---

## [0.1.1] - 2026-08-30

### 📖 Documentation & Global Release
* **English Overview Documentation**: Translated full `README.md` to fluent English for the global Visual Studio Marketplace audience.
* **Rich Media Previews**: Embedded high-resolution screenshots for Context Treemap, Prompt Simulator, AI Skills Inspector, and Workspace Token Explorer.

---

## [0.1.0] - 2026-08-30

### 🚀 Initial Release

#### 🌟 Features & Highlights
* **Interactive D3.js Context Treemap**:
  * Real-time squarified treemap visualizer rendering token distribution across files and directories.
  * 5-tier density color scale: Green (`< 1k`), Yellow (`1k - 8k`), Orange (`8k - 30k`), Red (`> 30k`), Purple (`AI Rules`).
  * Click-to-zoom hierarchy navigation with interactive breadcrumbs.
  * Instant search filtering and click-to-open file integration.
* **Prompt & Context Budget Simulator**:
  * Interactive checklist drawer in Treemap for simulating real prompt costs.
  * Real-time calculation of Baseline Rules + Selected Skills (Core) + System Index overhead.
  * Live gauge indicating context window consumption percentage.
* **Ecosystem-Aware AI Skills Detector**:
  * Auto-discovery for Google Gemini / Antigravity (`~/.gemini/...`), Claude Code (`~/.claude/...`), and Workspace skills (`.skills/`).
  * 3-tiered token cost breakdown:
    1. *Index Tokens* (Frontmatter name + description in system prompt).
    2. *Core Entry Tokens* (`SKILL.md` body).
    3. *Full Bundle Tokens* (Multi-file skill folders like `ui-ux-pro-max`, `diagram-design`).
* **AI Rules & Baseline Overhead Inspector**:
  * Automatic detection of `.cursorrules`, `.cursor/rules/*.mdc`, `GEMINI.md`, `.windsurfrules`, `.clinerules`, and `.github/copilot-instructions.md`.
  * Real-time calculation of mandatory baseline token overhead per prompt turn.
* **Interactive Target Budget & Smart Formatter**:
  * Target budget dropdown presets (`16k`, `32k`, `64k`, `128k`, `200k`, `500k`, `1M`, `2M`).
  * Custom budget input with live thousands formatting (`2.000.000`, `50k`, `1.5M`).
  * 1-click edit pencil `[ ✏️ ]` for rapid modifications.
* **Multi-Model Tokenizer Matrix**:
  * Calibrated tokenizer family engines for **Google Gemini** (SentencePiece 256k), **Anthropic Claude** (Claude BPE), **OpenAI** (o200k), and **DeepSeek / Llama** (128k).
* **Workspace Token Explorer**:
  * Sidebar tree view showing root project folder with live token badge in the header.
  * Filters for *All Files*, *AI Rules Only*, and *Open Tabs Only*.
* **Live Status Bar Counter**:
  * Active editor token count and selected text token ratio.
* **High-Performance In-Memory Caching**:
  * Zero-latency (0ms) model switching with memory cache and directory `mtime` validation.
  * 0% idle CPU overhead and zero memory leaks.
