# SignalProof Flagship Product Design

## Product thesis

Content teams do not need another text generator. They need a decision system that converts audience signals into evidence-backed content experiments, measures whether an experiment improved quality, and preserves the human publishing decision.

## Merge decision

VoiceMap becomes the `Signals` module inside ContentProof. The flagship is renamed **SignalProof Studio**. The standalone VoiceMap repository remains as an archived prototype with a README directing visitors to the flagship; it is not presented as a second equivalent product.

## Core loop

1. Import feedback, interviews or comments.
2. Redact private data and cluster signals with traceable quotations.
3. Convert one signal cluster into a content brief.
4. Attach verified public sources.
5. run versioned prompt experiments.
6. Compare deterministic rules, retrieval grounding and model-assisted evaluation.
7. Save a human decision and export an evidence packet.
8. Feed the decision and response back into the dataset.

## Architecture

- React/TypeScript client with demo and local repositories.
- FastAPI/SQLite source of truth.
- Keyword + embedding-ready retrieval interface with citations.
- Persisted Signal, Evidence, Brief, Experiment, Evaluation and Review entities.
- Ollama remains optional; the public demo never requires a model or uploads data.

## Visual direction

The interface is a **signal cartography desk**, not a generic admin dashboard. Its signature is an interactive river map: raw quotations flow into theme tributaries, then into a brief, experiment and decision. Warm spectral colors encode signal states; the rest of the interface remains quiet graphite and mist. Typography uses a condensed display face for editorial decisions, a neutral Chinese body face, and monospace only for evidence IDs.

## Success criteria

- One coherent public demo completes signal-to-decision without dead controls.
- Every synthesized conclusion links to one or more original snippets.
- Desktop and 390px mobile pass the core flow without horizontal overflow.
- Existing backend, frontend and browser tests remain green; new signal behaviors use test-first development.
- README explains the originating problem, product boundary, architecture, evaluation and failure cases.

## Explicit non-goals

No general workflow canvas, social publishing, team auth, billing, fake production metrics, or third shallow portfolio project.
