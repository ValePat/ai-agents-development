# Real-Time Show Orchestrator Architecture

## Background & Motivation
The goal is to build a sustainable, dynamic, and responsive live-performance system for a 3-person team (Programmer, Music Expert, TouchDesigner Artist). The "Orchestrator Agent" allows the director to input high-level concepts (e.g., "Industrial buildup," "Ethereal breakdown") which an AI translates into macro variables. These variables control live techno audio in Ableton Live and real-time visuals in TouchDesigner.

## Scope & Impact
- **Dynamic Control:** Enables semantic direction of a live electronic show.
- **Low Complexity (Team-friendly):** Clear separation of concerns via OSC (Open Sound Control). The programmer handles the AI/Backend/UI, the music expert maps macros in Ableton, and the visual artist maps macros in TouchDesigner.

## Proposed Solution: The "Conductor" Architecture

### 1. Director's UI (Next.js / TypeScript)
- **Role:** The control surface for the Director (you).
- **Features:** 
  - A text input field for semantic prompts ("Transition into a heavy, dark techno drop").
  - Emergency manual override sliders for core macro variables (e.g., Energy, Tension, Rhythm Complexity, Visual Chaos).
  - A real-time visualizer of current macro values.
- **Communication:** Connects to the Python backend via WebSockets (`socket.io` or native WebSockets).

### 2. Orchestrator Backend (Python)
- **Role:** The brain of the operation, handling AI translation and signal smoothing.
- **Components:**
  - **LLM Agent:** Receives the director's prompt and uses an LLM (e.g., Gemini Flash) with a strict structured output (JSON). It translates the prompt into target values (0.0 to 1.0) for a predefined set of macros. 
  - **Interpolation Engine (The Transition Component):** *See detailed explanation below.*
  - **OSC Dispatcher:** Uses the `python-osc` library to broadcast the interpolated values continuously (e.g., at 60Hz) over a local network via UDP.

### 3. Audio Node (Ableton Live + Max for Live)
- **Role:** Managed by the Music Expert.
- **Workflow:** Uses Max for Live to receive OSC messages (e.g., `/orchestrator/energy 0.85`) and map them to Ableton parameters.

### 4. Visual Node (TouchDesigner)
- **Role:** Managed by the TouchDesigner Artist.
- **Workflow:** Uses an `OSC In` CHOP to receive the signals and drive visual parameters (noise, color, geometry).

---

## Deep Dive: The Interpolation Engine (The Transition Component)

In a live show, you cannot have variables "jump" instantly. If you type "make it darker" and the AI returns `energy: 0.2`, you don't want the music to suddenly cut to 20% volume. It would sound like a mistake. 

The **Interpolation Engine** solves two problems: **AI Latency** and **Performance Aesthetics**.

### How it Works:
1.  **The Trigger:** You type a prompt. The AI takes ~2 seconds to think.
2.  **The Target:** The AI returns a new state: `{"energy": 0.3, "duration": 8.0}`.
3.  **The State Machine:** The Python backend keeps track of your **Current Values** (e.g., Energy is at 0.9).
4.  **The Calculation:** Instead of jumping from 0.9 to 0.3, the engine calculates the step size needed to get there over 8 seconds at 60 frames per second (480 steps).
5.  **The Output:** Every 16ms, the engine sends a new OSC message with a slightly lower value (`0.899`, `0.898`...).

### Why this is critical for your team:
-   **For the Director:** You can specify *how long* a transition should take. You can say "Slowly fade into a chill vibe over 30 seconds" or "Sudden high energy shift in 0.5 seconds."
-   **For the Music Expert:** It creates smooth filter sweeps and gradual volume swells that feel intentional and "musical" rather than glitchy.
-   **For the TD Guy:** It prevents visuals from "teleporting." Geometry and colors morph smoothly over time.

### Advanced Features:
-   **Easing Curves:** Instead of linear transitions (boring), we can use "Ease-In-Out" curves so transitions start slow, accelerate, and finish smoothly.
-   **Manual Interruption:** If you move a physical slider on your UI, the interpolation for that specific variable stops immediately to give you "Hard Control" for emergencies.

---

## Standardized Macro Variable Ideas
Standardizing on 0.0 - 1.0 variables is crucial for team coordination:
- `Energy`: Overall intensity (volume, high frequencies, brightness).
- `Tension`: Dissonance, reverb washes, visual glitching.
- `Rhythm_Density`: Minimalist (0.0) vs. maximalist/breakbeat (1.0).
- `Atmosphere`: Dry/Dark (0.0) vs. Ethereal/Wide (1.0).

## Implementation Steps
1.  **Phase 1 (POC):** Simple Python OSC sender -> TouchDesigner/Ableton.
2.  **Phase 2 (Logic):** Python Backend + LLM Integration + Interpolation Logic.
3.  **Phase 3 (Control):** Next.js UI for prompt input and manual overrides.
4.  **Phase 4 (Rehearsal):** Team tuning of the "feel" of the variables.