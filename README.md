# ⚡ Token Meter - AI Context & Token Budget Visualizer

[![Visual Studio Marketplace](https://img.shields.io/badge/VS_Code-Extension-blue?logo=visualstudiocode)](https://marketplace.visualstudio.com/items?itemName=harunuyguc.token-meter-ai)
[![TypeScript](https://img.shields.io/badge/Language-TypeScript-blue?logo=typescript)](https://www.typescriptlang.org/)
[![D3.js](https://img.shields.io/badge/Visualization-D3.js-orange?logo=d3.js)](https://d3js.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)

**Token Meter** is a professional VS Code extension designed for AI-assisted software development (**Google Antigravity, Cursor, Windsurf, Claude Code, GitHub Copilot, Cline / Roo Code**). It provides real-time workspace token analytics, mandatory AI rule overhead detection, ecosystem skill discovery, and interactive D3.js context treemap visualizations.

---

## 🌟 Why Token Meter?

When coding with modern Large Language Models, expanding context windows introduce critical challenges:
1. **Attention Degradation (*Lost in the Middle*)**: Models lose focus on crucial code and instructions placed in the middle of bloated context windows.
2. **Compounding Costs & Latency**: Sending large files on every prompt turn exponentially increases API costs and generation lag.
3. **Invisible Baseline Overhead**: Large workspace rule files and ecosystem skills can silently consume tens of thousands of tokens before user code is even attached.

**Token Meter** gives you an X-Ray view of your codebase's token footprint, visualizes context consumption, and helps you budget prompts effectively.

---

## 🚀 Key Features

### 1. 🗺️ Interactive Context Heatmap (D3.js Squarified Treemap)

![Context Treemap Overview](media/treemap-overview.png)

* **Proportional Token Footprint**: Visualizes which files and directories consume the most context relative to total project size.
* **5-Tier Density Color Heatmap**:
  * 🟢 **Green (< 1k tokens)**: Light / Safe
  * 🟡 **Yellow (1k - 8k tokens)**: Moderate
  * 🟠 **Orange (8k - 30k tokens)**: Heavy
  * 🔴 **Red (> 30k tokens)**: Critical (*Lost in the Middle* attention risk!)
  * 🟣 **Purple**: AI Rule Files (`.cursorrules`, `GEMINI.md`, etc.)
* **Hierarchical Zoom & Breadcrumbs**: Click on any directory tile to drill down, and use the breadcrumb trail to navigate back up.
* **Instant Search & Editor Integration**: Filter files in real time and click any tile to open the file directly in the VS Code editor.

---

### 2. 🎯 Interactive Prompt Budget Simulator

![Prompt Budget Simulator](media/prompt-simulator.png)

Test and simulate prompt costs before submitting tasks to your AI coding assistant:
* **Interactive Checklist**:
  * 📜 **AI Rules**: Mandatory workspace rule files.
  * 🧠 **AI Skills**: Ecosystem-installed tool definitions and instructions.
* **Live Calculation Formula**:
  $$\text{Estimated Prompt} = \text{AI Rules} + \text{Selected Skills (Core)} + \text{System Catalog Index}$$
* Toggle rules and skills on/off to see prompt token counts and context limit fill percentages in real time.

---

### 3. 🧠 Ecosystem-Aware AI Skills Inspector

![AI Skills Tooltip & 3-Tiered Breakdown](media/skill-tooltip.png)

Automatically discovers installed skills tailored to your active AI ecosystem with **3-tiered token cost breakdown**:
* **Ecosystem Isolation**:
  * 🔵 **Google Gemini / Antigravity**: `~/.gemini/antigravity/builtin/skills`, `~/.gemini/config/skills`, `.gemini/skills/`
  * 🟠 **Anthropic Claude**: `~/.claude/skills/`, `.claude/skills/`
  * 🌐 **Workspace Skills**: Project-level `.skills/`
* **3-Tiered Token Granularity**:
  1. **Catalog Index Cost**: Frontmatter (`name + description`) injected into the system prompt (~25-35 tokens).
  2. **Core Entry Cost**: Body size of `SKILL.md` when invoked on demand.
  3. **Full Bundle Size**: Total token weight of complex multi-file skills (e.g., `ui-ux-pro-max`, `diagram-design`).
* Expand and click subfiles to inspect skill instructions directly in the editor.

---

### 4. 🎛️ Interactive Target Budget & Smart Number Formatter
Customize your context budget threshold directly from the Treemap header:
* **Preset Templates**: `16k (Free Tier)`, `32k (Light)`, `64k (Standard)`, `128k (Full Module)`, `200k (Claude Default)`, `500k`, `1M (Gemini Flash)`, `2M (Gemini Pro)`.
* **Custom Limit Input with Live Thousands Separators**:
  * Real-time formatted thousands separator typing (`2.000.000` or `50.000`).
  * Shorthand unit support (`2M`, `50k`, `1.5M`).
  * Budget progress bar dynamically transitions to **warning red** upon budget overflow.
  * **`[ ✏️ ]`** Quick edit pencil button for 1-click modifications.

---

### 5. 📊 Multi-Model Tokenizer Matrix (Future-Proof Model Support)
Calibrated token calculation engines powered by official vocabularies and BPE algorithms:
* 🔵 **Google Gemini** (SentencePiece 256k Vocab — High compression efficiency for multilingual & code content)
* 🟠 **Anthropic Claude** (Claude BPE ~65k-100k Vocab)
* 🟢 **OpenAI (GPT & o-Series)** (OpenAI `o200k_base` Tiktoken engine)
* 🟣 **DeepSeek / Llama** (128k BPE Tokenizer)

---

### 6. 🌲 Workspace Token Explorer

![Workspace Token Explorer & AI Rules](media/sidebar-explorer.png)

* **Root Folder & Header Live Badge**: Root workspace directory displayed as (`🗂️ project-name 56.5k`) with a live token badge in the sidebar header (`WORKSPACE TOKEN EXPLORER 56.5k`).
* **Sorted Hierarchy**: Lists directories and files sorted descending by token consumption.
* **Dedicated Filters**:
  * 🌐 **All Files**
  * 🤖 **AI Rules Only**
  * 📑 **Open Tabs Only**

---

### 7. ⚡ Live Status Bar Counter
* **Active File**: Real-time token count of the currently focused editor document.
* **Selection Ratio**: Highlights the token weight of the selected text vs total document tokens (`$(symbol-keyword) 140 / 2.4k tokens`).
* **Quick Switcher**: Click the status bar item to toggle tokenizer models or open the Context Treemap.

---

### 8. 🚀 High-Performance In-Memory (RAM) Caching
* **Sub-Millisecond (0ms) Model Switching**: Instant model toggles without disk re-reads.
* **Smart `mtime` Invalidation**: Only recomputes tokens when files are modified on disk.
* **Zero Idle CPU Footprint**: Event-driven with 250ms debouncing; zero background resource waste.

---

## ⚙️ Configuration Settings

Customize Token Meter behavior via VS Code `settings.json`:

```json
{
  "tokenMeter.defaultModel": "gemini-2-flash",
  "tokenMeter.contextBudget": 200000,
  "tokenMeter.statusBarEnabled": true,
  "tokenMeter.debounceDelay": 250,
  "tokenMeter.excludePatterns": [
    "**/node_modules/**",
    "**/.git/**",
    "**/dist/**",
    "**/build/**",
    "**/out/**",
    "**/.next/**",
    "**/.nuxt/**",
    "**/coverage/**",
    "**/*.min.js",
    "**/*.min.css",
    "**/*.map",
    "**/*.lock",
    "**/package-lock.json",
    "**/yarn.lock",
    "**/pnpm-lock.yaml"
  ]
}
```

---

## 🛠️ Development & Building

To run or build the extension locally:

```bash
# 1. Install dependencies
npm install

# 2. Run unit test suite (12 Unit Tests)
npm test

# 3. Development watch mode
npm run watch

# 4. Production build
npm run build:prod

# 5. Package VSIX extension
npx vsce package --no-dependencies
```

---

## 📄 License

Distributed under the [MIT License](LICENSE).
