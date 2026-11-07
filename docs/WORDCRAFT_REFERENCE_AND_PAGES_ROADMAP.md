# Word-processing reference study and Brightdesk Pages roadmap

**Status:** research and proposed roadmap, not a claim that these features are implemented.

## Reference reviewed

- Project: [Storytold Wordcraft](https://github.com/storytold/wordcraft)
- Reference version: public `main` branch inspected on 7 November 2026
- Project description: open-source word processor implemented in Rust
- Published licence: MIT OR Apache-2.0
- Relevant reference material: [README](https://github.com/storytold/wordcraft/blob/main/README.md), [roadmap](https://github.com/storytold/wordcraft/blob/main/ROADMAP.md), [architecture](https://github.com/storytold/wordcraft/blob/main/Cargo.toml), and the public crate layout.

This review uses public feature descriptions and architecture as product research. Brightdesk Pages remains an independent implementation with its own source, interface, product identity, icons and artwork. No Wordcraft source code, ArtCraft branding, screenshots, templates or assets are copied by this document.

## What the reference demonstrates

Wordcraft organises a substantial document editor into separable capabilities:

- Editing: text input, selection, clipboard, undo/redo, find and replace.
- Formatting: character formatting, paragraph formatting, styles and themes.
- Structure: bullets, numbering, multilevel lists and tables.
- Page composition: paper size, margins, orientation, sections, columns, headers, footers, page numbers and pagination.
- Inserted content: images, shapes, text boxes and wrapping.
- References: contents pages, footnotes, citations, captions, cross-references and indexes.
- Review: spelling, grammar, comments, tracked changes, document comparison and editing restrictions.
- Mailings: data-driven merge fields, letters, envelopes and labels.
- File exchange: DOCX, ODT, RTF, HTML, Markdown, text, TeX and PDF output.
- Automation: command-based operations and inspectable document state.

These are reference capabilities, not Brightdesk Pages completion claims. Wordcraft itself labels its current release alpha and documents remaining compatibility, pagination and stability gaps. Feature presence in a reference project does not prove complete behaviour or file fidelity.

## Brightdesk Pages: current verified baseline

The product README currently describes a first-use foundation:

- Create and edit letters, reports and text documents.
- Basic text formatting, headings, paragraph alignment, lists and simple tables.
- A4, US Letter and US Legal paper sizes; portrait/landscape and margin presets.
- Save and reopen Brightdesk project data, supported document import/export and PDF export.

The current product is an Electron desktop project using Node.js 24.22.2. Its package manifest includes document-related dependencies such as `docx`, `mammoth`, `fast-xml-parser` and `jszip`. This is evidence of declared dependencies only, not proof of full DOCX round-trip fidelity. The existing test command is `node --test`; use the repository's own scripts and tests when changing behaviour.

## Proposed capability sequence

| Priority | Brightdesk capability | Acceptance evidence before calling it complete |
|---|---|---|
| P0 | Reliable document model, save/reopen, undo/redo and selection | Tests for edit history, persistence, malformed input and recovery |
| P1 | Character and paragraph formatting; headings and named styles | Editing tests plus persisted style round-trip |
| P1 | Bullets, numbering, multilevel lists and robust tables | Keyboard, mouse, pagination and save/reopen tests |
| P1 | Page layout: A4/Letter/Legal, margins, orientation, headers, footers and page numbers | Rendered page fixtures and cross-platform visual checks |
| P2 | Find/replace, navigation, word count and spell-check integration | Search edge cases, locale tests and keyboard accessibility |
| P2 | DOCX import/export fidelity; ODT/RTF/HTML/Markdown/TXT adapters | A versioned real-document corpus with loss reports |
| P3 | Images, shapes, text boxes and text wrapping | Layout, resize, anchor and export regression tests |
| P3 | Comments, tracked changes, compare and restricted editing | Multi-state review tests and safe document persistence |
| P4 | Contents, footnotes, citations, cross-references and mail merge | Structured-document fixtures and output validation |

Priorities are proposed, not a promise that every feature will be included in the first release. Each increment must be sized against the existing code and the user's intended workflow.

## Brightdesk implementation principles

1. Keep the Brightdesk Pages product repository as the source of truth.
2. Preserve JavaScript/Node/Electron and any Rust work already in the repository. Do not replace the current stack to imitate the reference's pure-Rust architecture.
3. Keep document data, editing commands, layout/rendering and file-format adapters separated behind tested interfaces where the current architecture permits.
4. Treat DOCX as a compatibility target, not as proof of identical Word rendering. Preserve unsupported content where practical and report lossy conversions.
5. Keep document processing local by default. Do not add a paid cloud dependency or make Brightdesk-AI a runtime requirement.
6. Use original Brightdesk interface composition, terminology, icons, sample documents and visual assets. A familiar ribbon or formatting workflow is acceptable; copying another product's branding, screenshots, artwork or exact screen composition is not.
7. Add or update tests before changing behaviour. Run focused tests and then the complete `npm test` suite using Node.js 24.22.2.

## Licensing and attribution

Wordcraft publishes under MIT OR Apache-2.0. This research document does not copy its implementation. If a later change deliberately reuses a specific code component, first identify the exact source files and commit, choose and comply with the applicable licence, retain copyright and licence notices, add the required third-party attribution to Brightdesk's notices, and review dependency and distribution obligations. Do not copy ArtCraft trademarks or brand assets; the upstream project explicitly separates those from its code licence.

## Research links

- [Wordcraft repository](https://github.com/storytold/wordcraft)
- [Wordcraft README](https://github.com/storytold/wordcraft/blob/main/README.md)
- [Wordcraft roadmap](https://github.com/storytold/wordcraft/blob/main/ROADMAP.md)
- [Wordcraft attribution policy](https://github.com/storytold/wordcraft/blob/main/ATTRIBUTION.md)
- [Wordcraft licence files](https://github.com/storytold/wordcraft/tree/main)
