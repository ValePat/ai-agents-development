# Real-Time Show Orchestrator — Next.js + FastAPI + MCP + OSC

A production-ready system for building semantic AI show control agents with a **secure FastAPI backend** and a **modern Next.js frontend**. Designed for live performance, it translates director prompts into real-time OSC signals for Ableton Live and TouchDesigner.

---

## 🏗 Architecture Overview

| Layer     | Technology                          | Role                                      |
|-----------|-------------------------------------|-------------------------------------------|
| **Frontend**  | Next.js 15+ (App Router) + Tailwind | Director Console, Gauge Visuals           |
| **Backend**   | FastAPI + smolagents + LiteLLM      | OSC Orchestration, API server             |
| **Protocol**  | OSC (Open Sound Control)            | Real-time hardware/software control       |
| **Protocol**  | MCP (Model Context Protocol)        | Standardized, sandboxed tool access       |
| **LLM**       | OpenRouter (Gemini Flash)           | Semantic prompt translation               |

---

## 🚀 Key Features
- **Real-Time Interpolation**: 60 Hz smooth-easing engine for jitter-free transitions.
- **Multi-Target OSC**: Simultaneous broadcast to Music (Ableton) and Visuals (TouchDesigner).
- **Dynamic MCP Loading**: Retains infrastructure for filesystem and memory tools.
- **Modern UI**: Polished director console with animated horizontal gauges.

---

## 🎯 Project Roadmap

### ✅ Completed
- **Single-Purpose Focus**: UI and API streamlined for the Orchestrator.
- **OSC Integration**: Full support for numeric and string macro dispatch.
- **MCP Infrastructure**: Dynamic loading of filesystem and memory servers.

### 🔄 In Progress / Planned
- **Memory MCP Integration**: Persistent director preferences and show motifs.
- **Closed-Loop Feedback**: Reading state back from Ableton/TD via OSC MCP.
- **Script-to-Scene**: Automatic transitions based on show scripts via Filesystem MCP.

---

## 📖 Documentation Index

| Topic | Description |
|-------|-------------|
| [Architecture](./docs/ARCHITECTURE.md) | System design, MCP integration, and agent behavior. |
| [Operations](./docs/OPERATIONS.md) | Local setup (Colima), Docker workflows, and deployment. |
| [Security & Safety](./docs/SECURITY.md) | Guidelines for safe AI usage and security audit. |
