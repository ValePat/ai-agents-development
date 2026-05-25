# 🎭 Orchestrator Prompt Samples

A curated collection of director prompts for the **Real-Time Show Orchestrator**. These are designed to be pasted directly into the Director Dashboard prompt input at `/`.

> **How it works**: Each prompt is translated by the LLM into a structured JSON object that updates numeric and string macros, which are then smoothly interpolated at 60 Hz and dispatched as OSC signals to Ableton Live and/or TouchDesigner.

---

## 🎵 Music & Energy

### Energy Ramp-Ups
```
Push the energy up — we're heading into the main drop. Make it feel massive and urgent.
```
```
Kick the BPM feel into high gear. Add tension and momentum like a freight train picking up speed.
```
```
We're at the peak of the set. Everything should be firing — maximum energy, maximum density.
```

### Breakdowns & Builds
```
Pull everything back for a breakdown. Drop the energy, create space and anticipation.
```
```
We're in a build section. Gradually increase tension — subtle at first, then overwhelming by the end.
```
```
Give me a false drop feel. Lots of space and suspense, like something is about to happen but hasn't yet.
```

### Chill & Ambient
```
Ease into a deep ambient section. Slow everything down, make it breathe and float.
```
```
Wind the intensity down. We're transitioning into a chill-out zone — warm, hazy, and relaxed.
```

---

## 💡 Lighting & Atmosphere

### Mood & Colour
```
Go full neon. Harsh magenta and cyan, like a cyberpunk back alley at 3am.
```
```
Warm the stage up — golden hour vibes, like the sun is setting behind the performers.
```
```
Ice cold. Deep blue and white, sterile and clinical. Like a sci-fi surgery room.
```
```
Fire palette only. Deep reds, burnt oranges, crackling amber. Make it feel dangerous.
```

### Movement & Intensity
```
Strobe aggressively but keep it rhythmically synced to the music.
```
```
Slow, hypnotic sweeps. Like the lights are breathing in time with a heartbeat.
```
```
Kill the movement — static, heavy, focused beams. Like spotlights on an empty stage.
```
```
Scatter everything. Chaotic, unpredictable light movement that feels slightly out of control.
```

### Darkness & Drama
```
Dramatically reduce all light output. Just a hint of presence — barely visible, deeply moody.
```
```
One single spotlight, center stage. Everything else is pitch black.
```

---

## 🎨 Visuals (TouchDesigner)

### Abstraction & Motion
```
Go full abstract — generative geometry, no representational content. Fast, reactive, angular.
```
```
Fluid and organic visuals. Think lava lamp meets deep sea creature, slow and hypnotic.
```
```
Glitch everything. Corrupt the visuals — digital noise, scanlines, data errors.
```

### Themes & Aesthetics
```
Industrial aesthetic. Steel, concrete, mechanical movement. Gritty and functional.
```
```
Euphoric and celestial — soft gradients, particles like starfields, otherworldly beauty.
```
```
Urban decay. Crumbling textures, rust, broken glass, late-night city reflections.
```
```
Bio-mechanical. Organic forms growing through mechanical structures, pulsing and alive.
```

### Sync & Reactivity
```
Make visuals tightly locked to the beat — every kick should cause a visible impact.
```
```
Decouple visuals from the music. Let them drift on their own timeline, dream-like.
```

---

## 🌐 Combined / Full-Show Directives

### Scene Transitions
```
We're transitioning from a warm, intimate opening to a high-energy main set. Begin the shift now — slowly but inevitably.
```
```
Hard cut. Everything resets to neutral. Clean slate before the next act comes on.
```
```
Cross-fade into the finale. Everything should feel like it's building towards a single moment of release.
```

### Genre & Vibe Shifts
```
Shift the whole feel from techno to house. Warmer, more groove, less aggression.
```
```
Make it feel like jungle or DnB — choppy, frantic, and slightly chaotic but deeply rhythmic.
```
```
We're going ambient-dub now. Reggae-influenced space and reverb, heavily reduced density.
```

### Emotional Direction
```
The crowd is tiring — re-engage them. Inject surprise and novelty. Something unexpected.
```
```
Make it feel triumphant. Like the end of an epic journey — earned, emotional, massive.
```
```
Create an intimate moment. Like a 4am warehouse when only the true believers are left.
```
```
Something is off. Introduce a sense of unease and tension without breaking the groove.
```

---

## 🔧 Specific Macro Adjustments

> Use these when you want to be precise about a specific parameter rather than a full vibe shift.

```
Increase reverb send to about 70%. Keep everything else the same.
```
```
Push the visual particle density up by roughly half. Leave the colours where they are.
```
```
Bring the master brightness down to about 30% and shift the colour temperature colder.
```
```
Set the music macro for "density" to maximum but keep "energy" where it is.
```
```
Reduce the strobe rate significantly — it's too fast for this moment.
```

---

## ⚠️ Edge Case / Stress Tests

> Good for verifying agent robustness and fallback behaviour.

```
Nothing should change. Maintain exactly the current state.
```
```
I want complete silence and darkness. Zero everything that can be zeroed.
```
```
Maximum everything. Push every parameter to its maximum value simultaneously.
```
```
Make the visuals feel like the music sounds right now. Mirror the audio energy in the visual domain.
```

---

*Prompts designed for use with the Real-Time Show Orchestrator — [README.md](./README.md)*
