# Brightdesk Pages — WordCraft Reference and Parity Plan

**Status:** The draft branch now includes local recovery, document navigation, paragraph styles, Find & Replace, a metric page ruler, an initial multi-page canvas, and document design presets with watermarks. Automated tests passed on the previous head before the latest design slice; the exact new head and live visual review are pending.  
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
| Document recovery | No recovery workflow on audited `main`; the feature branch now adds a local single-document recovery slice | In implementation; automated checks pending |
| AI/automation | No Pages-specific local CLI/MCP document command surface found in the audited source | Missing |
| Troubleshooting | Existing engineering/release documentation; no complete customer troubleshooting guide matching the reference | Missing |

**Audit boundary:** This is a source inspection of the Pages default branch and the named files, not a running-build test. “Not found” means not found in the inspected source; it is not a claim about every branch or uninspected dependency.

## Current implementation progress on the draft branch

The feature branch now contains two initial, reviewable implementation slices. They are not merged into `main`, and no release build includes them yet.

| Slice | Code on the branch | Verification boundary |
|---|---|---|
| Local recovery | Recovery service, size/shape validation, safe local files, sender-validated IPC, a Recover/Discard prompt, 10-second snapshots and blur/hidden attempts | Unit and UI tests added; exact-head CI is pending. Only the active Pages document is covered. |
| Document navigation | A left outline lists Heading 1–3 paragraphs, supports heading search and jumps to a selected heading | Static regression test added; exact-head CI and running-window inspection are pending. |
| Paragraph styles | Home ribbon shortcuts apply Normal, Title, Heading 1 and Heading 2 block formatting | Static regression test added; this is not yet a full style manager or live style-preview engine. |
| Find & Replace | Local document search, Find next, Replace and Replace all; match-case and whole-word options; matches across inline runs in a paragraph | Pure search helper and UI regression tests added; exact-head CI and live desktop interaction checks pending. Regular expressions, match highlighting and cross-document search are not included. |
| Page ruler | Optional metric ruler aligned to the selected paper size/orientation, with half-centimetre ticks, labels and shaded margin areas | Pure ruler-scale and UI tests added; draggable markers are not included; exact-head CI and live desktop visual inspection pending. |
| Multi-page editing | Vertically stacked paper surfaces; whole-block automatic flow; explicit paragraph-boundary page breaks; selected page size and orientation carried into PDF export | Pure block-packing and UI regression tests added; long individual blocks are not split and can extend a page. Electron interaction and actual PDF output checks are pending. |
| Document design presets | Design tab with Brightdesk, Editorial and Modern preview cards; local Draft and Confidential watermark settings; metadata preserved by local recovery | Pure normalisation and UI integration tests added; exact-head CI and live Electron visual inspection are pending. Full user-editable styles remain future work. |

No feature is described as release-ready until the exact current branch checks pass and the Electron workspace has been captured and visually inspected.

## Latest visual implementation slice

The draft branch now includes the Pages Design tab. The selectable Brightdesk, Editorial and Modern cards preview their type treatment before application. Draft and Confidential watermark choices are stored with the local document and recovery snapshot. Presets are implemented with system-safe fonts and original Brightdesk colour treatments; no third-party font, image, icon or brand asset is introduced. The source model rejects unknown preset and watermark identifiers by falling back to Brightdesk and no watermark.

The new pure-model and UI regression tests are in the branch. Exact-head CI and a visual inspection of the running Electron window remain pending. The screenshot runner successfully captured a real Electron workspace on its previous baseline, but GitHub artifact storage quota prevented the image upload; no screenshot visual review is claimed.

## Feature target derived from the eight supplied guides

### 1. Overview and everyday writing

**Multi-page editing slice on the draft branch:** Pages now groups content into vertically stacked paper surfaces using measured top-level block heights, automatically moves following blocks to the next page when they no longer fit, and preserves explicit **Insert → Page break** markers. Page wrappers are transient: document HTML stored in local state and exports is flattened back to the original content blocks. PDF export receives the selected A4/Letter/Legal size and portrait/landscape setting, and print CSS isolates the page surfaces. Ctrl+Enter (Windows/Linux) and Command+Enter (macOS) invoke the same page-break command from the document editor. This is not yet full paginated word-processing: a single long paragraph, table or other oversized block is kept intact and may extend its page rather than being split. Page sections, headers/footers and draggable margins are not yet implemented. Exact-head CI, real Electron interaction and visual PDF inspection remain outstanding.

**First ruler slice on the draft branch:** the Pages View tab now has an accessible Show ruler toggle. It renders a horizontal centimetre scale for the selected paper width and orientation, with half-centimetre ticks and shaded page margins. The scale recalculates when page settings change. It is a visual measuring aid only; draggable margin/indent markers and vertical rulers remain planned. Tests cover metric and inch scale calculations and the View toggle, but the exact-head checks and live desktop visual review are still outstanding.

**First Find & Replace slice on the draft branch:** Pages now has a Home-ribbon command that opens local Find & Replace controls. It supports Find next, Replace, Replace all, match case and whole-word matching. The range mapper supports inline formatting runs without joining separate paragraphs. This is a first literal-search implementation; regular expressions, search-result highlighting, document-wide navigation and cross-document search remain planned. Added unit and UI regression tests; no pass is claimed until the current-head workflow completes.

Build toward:
- A familiar ribbon with Home, Insert, Draw, Design, Layout, References, Mailings, Review, View, Developer and Help; show contextual tabs only when relevant.
- Command search/help so users can find a command without hunting through tabs.
- Smart quotes, AutoCorrect, automatic list continuation/indentation, find and replace, useful keyboard shortcuts and repeat-last-action behaviour.
- Extend the new document style-set previews into a full Styles pane with live style hover previews, editable paragraph/character styles, custom theme/style sets, and Format Painter.
- Full table workflows: insert, select, style, merge/split cells, repeat header rows, sort and supported formulas.
- Page layout: margins, columns, headers/footers, page numbers, watermarks, borders, drop caps, line numbers and automatic hyphenation.
- Pictures and shapes: insert, crop, recolour, remove background where safely supported, wrap text and control positioning.
- Readable document canvas, visible page boundaries, multiple-page layout and stable pagination.
- Open/save `.docx`; plan honest support for `.doc` import, `.odt`, `.rtf`, `.html`, `.md`, `.tex` and `.txt`, with PDF export for final sharing. WordCraft's documentation also lists these formats; every Brightdesk format needs its own tested round-trip contract.
- Preserve unsupported OOXML elements instead of silently discarding them wherever feasible. Expose conversion warnings when fidelity is partial.
- PDF export with selectable text, links and heading bookmarks.
- Add equation editing, Developer content controls, document protection/restrict editing and repeatable macro workflows only when their data model and security boundaries are fully tested.
- Include a polished File/start page with blank documents, templates, recent documents and clear Open/Save/Export actions.

### 2. Install, update and remove

Keep Brightdesk's existing native desktop installer model rather than copying ArtCraft Launcher:
- Document only the Windows, macOS and Linux desktop installer formats already configured and supported by Brightdesk Pages; do not copy WordCraft's extra architectures, package managers or ArtCraft Launcher.
- Explain first install, update checks, explicit download/install approval, repair and removal.
- Preserve documents and user settings during upgrades and uninstall unless the user explicitly chooses to remove settings.
- Verify SHA-256 integrity for release assets. Add signing/notarisation only through an approved Brightdesk release process and keep release-signing work separate from product runtime.
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
- WordCraft's guide describes 75 spelling/hyphenation packs and a 27-language interface. Treat those as comparison targets, not promises to duplicate a pack count before Brightdesk has verified assets.
- Keep approved Brightdesk language packs shared across the ten Brightdesk products through the shared engine where it supports them.
- Show install prompts only when useful, never download until the user explicitly chooses Install/Add/Refresh, and verify every pack's known checksum before use.
- Support mixed-language text ranges and clear states for missing or unreadable dictionaries. Keep interface language independent from each document's proofing language.
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

**First Pages implementation on `feature/wordcraft-parity-foundation` (not yet merged or verified):** the branch adds a bounded local recovery service, sender-validated Electron IPC, a 10-second dirty-snapshot cycle, extra attempts on window blur/hidden state, and a non-blocking Recover copy/Discard prompt. The snapshot is stored under the Pages user-data folder. Restore sanitises the saved HTML and opens it as an unsaved Pages working copy; it does not replace the original file. The service rejects unsafe IDs, unsupported products, oversized HTML, corrupt snapshots and symlink files. The README now documents its current limits. Automated branch tests are pending; do not describe it as release-ready.

**Remaining parity work:**
- Write a recovery snapshot no more often than every 10 seconds, and only after content changes.
- Extend the current single-active-document snapshot to separate snapshots for each simultaneously open document and a dedicated Recover page/list.
- Restore as a new unsaved document; never overwrite the original file.
- Discard only after explicit confirmation.
- Continue without restoring while retaining the snapshots.
- Delete the matching snapshot after a successful save or an explicit discard.
- Keep snapshots local and do not expire them silently.
- Exclude password-protected documents unless recovery data can be protected to the same standard.
- Test crash/relaunch, multiple documents, corrupt snapshots, disk-full/write errors, rapid edits during a pending write and preservation of the original.

### 7. AI agents and automation

Provide an opt-in local command interface that can be driven by a compatible local assistant:
- Define a stable, documented command registry for creating, editing, formatting and saving documents.
- Expose only the minimum operations required through a local CLI and MCP-compatible stdio bridge; no network listener should be enabled by default.
- Use a stable command registry with machine-readable command discovery, structured JSON inputs/results, and document operations that match the ribbon's available commands.
- Support explicit read and write roots (separate folders), read-only mode when no write root is supplied, and clear command-level permission boundaries.
- Validate all inputs, file paths, document sizes and command permissions.
- Require explicit user approval before destructive operations, overwrites, external launches or printing.
- Give agent edits a distinct author identity for Track Changes/comments and keep agent actions visible and undoable where possible.
- Do not add a hosted model, account, API key requirement, remote agent service or customer-document upload.
- Keep Brightdesk-AI as the separate private engineering assistant. It is not Pages and must not become a customer product.

### 8. Troubleshooting and customer help

Create clear, task-based help for:
- Window fails to open, graphics-driver issues, rendering glitches and graphics-backend workarounds.
- Slow editing, large documents, page breaks, layout and missing-font substitutions.
- File import/export compatibility, unsupported objects and formatting differences.
- Native file-dialog or drag/drop problems on Linux desktop environments.
- Missing/unreadable dictionaries and language packs, with a clear route to install the approved pack.
- Zotero not detected, citation dialog failures or bibliography refresh errors.
- Recovery after a crash and recovery-file handling.
- Printing, missing printers and stuck print submissions.
- Update, installation, repair and uninstall failures.
- Where to find local diagnostic information, with safe redaction and no automatic log upload.

## Visual direction — what to carry across

Use the supplied WordCraft screenshots and the upstream WordCraft README's Home, Review, References, Design, Layout, Dark and File screenshots as the visual quality bar. The screenshots describe these concrete visual states:
1. **Home/editor:** the Open Studio Handbook is shown across two pages; the ribbon is across the top, the left Navigation pane lists headings, rulers are visible, and the live Styles gallery shows Normal, Heading 1, Title and Subtitle previews. A selected word demonstrates editing context.
2. **Review:** a distinct markup area to the right of the page; inserted text is coloured, deleted text is struck through, comment balloons are anchored to highlighted text, and accept/reject controls are easy to locate.
3. **References:** a two-page example with a table of contents, dotted leaders and page numbers on one page, and a table, numbered list and link on the next. The References tab groups footnotes, citations, bibliography, captions, cross-references, table of figures and index.
4. **Design:** visible style-set previews, a serif type treatment, plum-coloured headings, paragraph spacing choices and a pale diagonal DRAFT watermark; page colour and border controls are grouped coherently.
5. **Layout:** drop cap at the start of a paragraph, a floating shape with text wrapping, visible automatic hyphenation, line numbers and a subtle page border.
6. **Dark mode:** a genuinely dark shell and document surface with formatting marks visible and the Insert ribbon still usable.
7. **File/start page:** clear blank-document and template tiles (handbook, letter, résumé, report), recent documents, and easy open/save/export actions.

Do not copy screenshot pixels, Craft/ArtCraft logos, typography or assets. Recreate their information architecture, hierarchy, spacing and interaction patterns using original Brightdesk components, icons, accent and artwork.

Brightdesk should follow the same overall information architecture and interaction rhythm, but use its own original Pages icon, approved Pages accent, Brightdesk typography, component shapes, spacing tokens and illustrations. Keep controls discoverable, keyboard accessible and consistent across Windows, macOS and Linux. Do not use Craft or ArtCraft screenshots as Brightdesk product screenshots.

## Implementation order

1. **Document foundation:** robust DOCX fidelity and file-format round-trip tests; structured document model; undo/redo history; save/recovery safety.
2. **Editor and visual shell:** WordCraft-inspired ribbon architecture, command search, navigation pane, Styles gallery, page rendering and contextual tabs using original Brightdesk design.
3. **Core writing/layout:** find/replace, AutoCorrect/smart quotes, tables, page headers/footers/numbers, columns, images/shapes and layout controls.
4. **Review and references:** comments, tracked changes, compare, TOC, footnotes, citations, bibliography, captions and index.
5. **Language and accessibility:** mixed-language proofing, approved offline dictionaries, Read Aloud and reader views.
6. **Integrations and automation:** local Zotero bridge and permission-bounded CLI/MCP command surface.
7. **Reliability and release:** recovery, print, diagnostics, customer help and native Windows/macOS/Linux acceptance.

Each phase must add behaviour tests before implementation, update the README in the same change, capture genuine running Pages screenshots after the interface is built, and verify the current branch head. For the visual implementation, capture the same Home, Review, References, Design, Layout, Dark and File states from the actual Pages desktop runtime. Keep incomplete capabilities labelled as planned rather than implemented.

## Reference material and screenshot sources

- The eight supplied Craft Wiki WordCraft guides are listed below and are the product/feature specification.
- The WordCraft upstream README describes its own UI-test-rendered screenshots and the visible details above: [storytold/wordcraft README](https://github.com/storytold/wordcraft#-a-tour) and [screenshot assets](https://github.com/storytold/wordcraft/tree/main/docs/images).
- The AI integration guide's folder-root limits, stdio transport and optional control port are useful architectural references only. Brightdesk must default to local stdio, restrict read/write folders, and must not silently expose a network port or upload document content.
- The WordCraft project itself is a feature reference, not a dependency or source-code donor. Brightdesk's independent implementation and licensing review remain required.

## Reference pages

- [WordCraft overview](https://craft.wiki/apps/wordcraft/overview/)
- [Install and update](https://craft.wiki/apps/wordcraft/install-update/)
- [Workflows](https://craft.wiki/apps/wordcraft/workflows/)
- [Languages and spelling](https://craft.wiki/apps/wordcraft/languages/)
- [Zotero](https://craft.wiki/apps/wordcraft/zotero/)
- [Document recovery](https://craft.wiki/apps/wordcraft/recovery/)
- [AI agents](https://craft.wiki/apps/wordcraft/ai-agents/)
- [Troubleshooting](https://craft.wiki/apps/wordcraft/troubleshooting/)
