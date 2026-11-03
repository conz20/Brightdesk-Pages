# Rust engine integration

This repository vendors the Brightdesk Rust engine source so the standalone product can build independently without access to the private Brightdesk-AI repository. Rust provides bounded source chunking, source statistics and deterministic lexical feature vectors. Node.js remains the application orchestration layer and communicates through a JSON Lines process boundary.

The bridge applies a timeout and reports a missing native executable explicitly. Existing JavaScript functionality remains available as the fallback. No native binary is committed; CI builds from source on Linux, Windows and macOS.

The 384-dimensional vectors are deterministic lexical features, **not semantic embeddings**. No model provider or remote embedding service is enabled. Future model adapters must be provider-neutral, opt-in, and must not upload customer documents or private source without separate approval. Brightdesk-AI remains private and is not bundled with customer installers.

Run `npm run rust:check` to check formatting, Clippy, tests and a release build.
