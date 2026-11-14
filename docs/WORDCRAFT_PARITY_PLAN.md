# Brightdesk Pages — WordCraft Reference and Parity Plan

**Status:** Baseline audit and implementation specification  
**Reference reviewed:** Craft Wiki WordCraft pages supplied by the product owner  
**Target repository:** `conz20/Brightdesk-Pages`  
**Target product:** Brightdesk Pages  
**Baseline inspected:** `main` at `0ed3ff44d5d4d2ce1f784116e1f318363ee3a156`

This document turns the supplied WordCraft guides into a Brightdesk Pages implementation plan. It is not a claim that the listed features have already been implemented or verified.

## Product direction

Use WordCraft as the close feature, interaction and visual-quality benchmark. Keep Brightdesk Pages recognisably Brightdesk: original product name, SVGs, typography, icons, accent colour, source code and interface details. Do not copy Craft/ArtCraft branding, proprietary assets, source code or distinctive trade dress.

The target is a polished desktop word processor with the familiar ribbon-and-document workflow shown in the WordCraft references. Do not deliberately simplify the target just because the current Pages editor is smaller.

## Brightdesk requirements that remain in force

- Pages remains one of exactly ten approved Brightdesk products.
- Windows, macOS and Linux desktop support; do not introduce a mobile edition.
- Keep documents, spelling, recovery and ordinary editing local and usable offline.
- No customer accounts, sign-in, subscriptions, billing, telemetry, advertising, cloud document storage, collaboration service or customer-text upload.
- The only approved customer internet uses remain official Brightdesk update and language-resource discovery/download/update flows. Do not introduce third-party runtime dictionary downloads.
- Keep Node.js at exactly 24.22.2 and preserve the current installer/release approval gates.
- Brightdesk-AI remains private engineering/tooling, not an eleventh customer product. Any future Pages agent bridge must be local, opt-in, permission-bounded and must not upload document text to a hosted model.
- Do not add Microsoft or Adobe dependencies, logos, code or copied assets. Use original Brightdesk artwork.

## Baseline audit — what Pages already has

The current main-branch implementation is a useful foundation, but it is not yet WordCraft-level word processing.

| Area | Evidence in current Pages source | Current assessment |
|---|---|---|
| Editing surface | `src/index.html`, `src/app.js`: contenteditable document surface | Basic rich-text editing |
| Ribbon | Home, Insert, Layout, Review and View tabs for Pages | Basic ribbon only |
| Text formatting | Bold, italic, underline, Heading 1/2, bullets, numbering, quote, alignment, undo/redo | Basic commands; no full style system |
| Tables | Insert a simple 2×2 HTML table | No table design/layout workflow found in the audited Pages toolbar |
| Page setup | A4, US Letter, US Legal; portrait/landscape; four margin presets | Basic page settings |
| Review | Word count and browser spellcheck toggle; dictionary check command when a dictionary is installed | No tracked changes, comments, compare-documents or Read Aloud workflow found in the audited source |
| View | Zoom and focus mode | No read mode, outline/draft/print/web view, navigation pane, rulers or multi-window workflow found |
| Files | `src/file-service.js`: DOCX import/export; other modules support spreadsheet/presentation formats and Brightdesk project files; PDF export is wired separately | DOCX conversion exists, but this is not full-fidelity round-trip editing |
| Local data | `brightdesk-docs-v3` local persistence and Brightdesk project storage | Local-first foundation exists |
| Language UI | Four bundled interface translations: en-AU, fr-FR, de-DE and es-ES | Useful start; not 27-language parity |
| Proofing | Bundled language packs and a Hunspell dictionary service are present | Audit catalogue entries, legally approved packs and actual installed pack coverage separately; catalogue entries are not proof of installed packs |
| Zotero | No Zotero integration found in the audited Pages source | Missing |
| Document recovery | No recovery workflow found in the audited Pages source | Missing |
| AI/automation | No Pages-specific local CLI/MCP document command surface found in the audited source | Missing |
| Troubleshooting | Existing engineering/release documentation; no complete customer troubleshooting guide matching the reference | Missing |

**Audit boundary:** This is a source inspection of the Pages default branch and the named files, not a running-build test. “Not found” means not found in the inspected source; it is not a claim about every branch or uninspected dependency.

## Feature target derived from the eight supplied guides

### 1. Overview and everyday writing

Build toward:
- A familiar ribbon with Home, Insert, Draw, Design, Layout, References, Mailings, Review, View, Developer and Help; show contextual tabs only when relevant.
- Command search/help so users can find a command without hunting through tabs.
- Smart quotes, AutoCorrect, automatic list continuation/indentation, find and replace, useful keyboard shortcuts and repeat-last-action behaviour.
- A real Styles gallery with live preview, editable paragraph/character styles, theme and style-set support, and Format Painter.
- Full table workflows: insert, select, style, merge/split cells, repeat header rows, sort and supported formulas.
- Page layout: margins, columns, headers/footers, page numbers, watermarks, borders, drop caps, line numbers and automatic hyphenation.
- Pictures and shapes: insert, crop, recolour, remove background where safely supported, wrap text and control positioning.
- Readable document canvas, visible page boundaries, multiple-page layout and stable pagination.
- Open/save common document formats with honest compatibility reporting; preserve unsupported OOXML elements instead of silently discarding them wherever feasible.
- PDF export with selectable text, links and heading bookmarks.

### 2. Install, update and remove

Keep Brightdesk's existing native desktop installer model rather than copying ArtCraft Launcher:
- Document the supported Windows, macOS and Linux installer formats already configured for Brightdesk Pages.
- Explain first install, update checks, explicit download/install approval, repair and removal.
- Preserve documents and user settings during upgrades and uninstall unless the user explicitly chooses to remove settings.
- Verify SHA-256 integrity for downloaded release assets and keep release-signing work separate from ordinary product runtime.
- Never imply an installer or platform is verified until its native checks have passed.

### 3. Workflows

Add the workflows as real commands and visible user journeys, not just ribbon labels:
- Styles, themes and Format Painter.
- Tables, pictures, shapes and page layout.
- Read/Focus/Outline/Draft/Print/Web views, navigation/search pane, rulers, zoom and multiple document windows.
- Print using the operating system's visible print dialog.
- General, Display, Save, Accessibility and Advanced settings with explicit descriptions of what is local and what is stored.
- Customisable keyboard shortcuts, ribbon and Quick Access Toolbar only after a stable command registry exists.

### 4. Languages and spelling

- Keep interface language separate from document proofing language.
- Detect mixed-language text ranges and allow users to assign a language to selected text.
- Show clear states for not-installed, unavailable, unreadable and installed dictionaries.
- Install/remove/set-default language resources without restarting where technically safe.
- Support standard Hunspell `.aff` and `.dic` resources, with provenance, licence, attribution and integrity verification.
- Keep language packs shared across the ten Brightdesk products where the shared engine supports them.
- Do not describe a catalogue entry or candidate locale as a usable language pack until the actual files, licence, checksum, engine compatibility and offline behaviour are verified.
- Do not silently download third-party dictionaries at runtime. Only official Brightdesk-controlled, reviewed language resources may be discovered or updated online.

### 5. Zotero

Plan an optional local integration with the Zotero desktop application:
- Add/Edit Citation using Zotero's citation dialog.
- Add/Edit Bibliography and refresh citations.
- Document Preferences for citation style and footnote/in-text behaviour.
- Add Note, unlink citations and move past citation where supported.
- Detect Zotero availability and explain how to start it; do not require a Zotero account inside Brightdesk.
- Keep communication local to the user's machine. No document or library upload to Brightdesk services.
- Treat missing Zotero, incompatible versions and cancelled dialogs as recoverable states.

### 6. Document recovery

Implement local recovery for unsaved drafts and documents with unsaved changes:
- Write a recovery snapshot no more often than every 10 seconds, and only after content changes.
- Keep separate snapshots for each open document.
- On next launch, offer a Recover view listing available copies.
- Restore as a new unsaved document; never overwrite the original file.
- Discard only after explicit confirmation.
- Continue without restoring while retaining the snapshots.
- Delete the matching snapshot after a successful save or an explicit discard.
- Keep snapshots local and do not expire them silently.
- Exclude password-protected documents unless recovery data can be protected to the same standard.
- Test crash/relaunch, multiple documents, corrupt snapshots, disk-full/write errors and preservation of the original.

### 7. AI agents and automation

Provide an opt-in local command interface that can be driven by a compatible local assistant:
- Define a stable, documented command registry for creating, editing, formatting and saving documents.
- Expose only the minimum operations required through a local CLI and MCP-compatible bridge.
- Validate all inputs, file paths, document sizes and command permissions.
- Require explicit user approval before destructive operations, overwrites, external launches or printing.
- Keep agent actions visible and undoable where possible.
- Do not add a hosted model, account, API key requirement, remote agent service or customer-document upload.
- Keep Brightdesk-AI as the separate private engineering assistant. It is not Pages and must not become a customer product.

### 8. Troubleshooting and customer help

Create clear, task-based help for:
- Window fails to open, graphics-driver issues and rendering problems.
- Slow editing, large documents and pagination.
- File import/export compatibility and formatting differences.
- Missing/unreadable dictionaries and language packs.
- Zotero not detected or citations not refreshing.
- Recovery after a crash and recovery-file handling.
- Printing and missing printers.
- Update, installation, repair and uninstall failures.
- Where to find local diagnostic information, with safe redaction and no automatic log upload.

## Visual direction — what to carry across

Use the supplied WordCraft screenshots as the visual quality bar:
1. **Home/editor:** compact, well-organised ribbon across the top; document canvas centred beneath it; clear page edges; a useful Navigation pane on the left; a live Styles gallery visible without crowding the writing area.
2. **Review:** tracked changes and comment balloons clearly separated from document text, with obvious accept/reject controls and author/time information.
3. **References:** a dedicated tab and contextual controls for contents, footnotes, citations, bibliography, captions and index.
4. **Design:** visually legible theme/style-set previews, page colour, border, watermark and paragraph spacing controls.
5. **Layout:** clear page, column, wrapping, hyphenation and line-number controls.
6. **Dark mode:** a complete dark interface and document-view treatment, not merely a dark sidebar.
7. **File/start page:** polished new/open/recent/template choices, with clear file actions.

Brightdesk should follow the same overall information architecture and interaction rhythm, but use its own original Pages icon, approved Pages accent, Brightdesk typography, component shapes, spacing tokens and illustrations. Keep controls discoverable, keyboard accessible and consistent across Windows, macOS and Linux. Do not use Craft or ArtCraft screenshots as Brightdesk product screenshots.

## Implementation order

1. **Document foundation:** robust DOCX fidelity and file-format round-trip tests; structured document model; undo/redo history; save/recovery safety.
2. **Editor and visual shell:** WordCraft-inspired ribbon architecture, command search, navigation pane, Styles gallery, page rendering and contextual tabs using original Brightdesk design.
3. **Core writing/layout:** find/replace, AutoCorrect/smart quotes, tables, page headers/footers/numbers, columns, images/shapes and layout controls.
4. **Review and references:** comments, tracked changes, compare, TOC, footnotes, citations, bibliography, captions and index.
5. **Language and accessibility:** mixed-language proofing, approved offline dictionaries, Read Aloud and reader views.
6. **Integrations and automation:** local Zotero bridge and permission-bounded CLI/MCP command surface.
7. **Reliability and release:** recovery, print, diagnostics, customer help and native Windows/macOS/Linux acceptance.

Each phase must add behaviour tests before implementation, update the README in the same change, capture genuine running Pages screenshots after the interface is built, and verify the current branch head. Keep incomplete capabilities labelled as planned rather than implemented.

## Reference pages

- [WordCraft overview](https://craft.wiki/apps/wordcraft/overview/)
- [Install and update](https://craft.wiki/apps/wordcraft/install-update/)
- [Workflows](https://craft.wiki/apps/wordcraft/workflows/)
- [Languages and spelling](https://craft.wiki/apps/wordcraft/languages/)
- [Zotero](https://craft.wiki/apps/wordcraft/zotero/)
- [Document recovery](https://craft.wiki/apps/wordcraft/recovery/)
- [AI agents](https://craft.wiki/apps/wordcraft/ai-agents/)
- [Troubleshooting](https://craft.wiki/apps/wordcraft/troubleshooting/)
