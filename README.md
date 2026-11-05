# Brightdesk Pages

<p align="center"><img src="assets/brand/brightdesk-logo.svg" alt="Brightdesk Office Suite" width="420"></p>
<p align="center"><img src="assets/icons/pages.svg" alt="Brightdesk Pages application icon" width="112" height="112"></p>

<p align="center"><strong>Create letters, reports and formatted documents.</strong></p>

<p align="center"><a href="https://raw.githubusercontent.com/connormolloy12/Brightdesk-Pages/main/assets/previews/pages-workspace.svg"><img src="assets/previews/pages-workspace.svg" alt="Brightdesk Pages workspace design preview" width="100%"></a></p>

<p align="center"><sub>Select the preview to open the full-size artwork.</sub></p>

> **Concept artwork — not a screenshot.** The preview above is original Brightdesk design artwork, not a capture from the running desktop build. A genuine screenshot will be added only after the current product window has been launched and its primary workflow checked.

Brightdesk Pages is a dedicated desktop application within the independent Brightdesk Office Suite. It uses the shared Brightdesk design language and opens directly into Pages.

## Shared Brightdesk design standard

This product follows the [Brightdesk visual and interaction standard](https://github.com/connormolloy12/Brightdesk-suite/blob/main/docs/BRIGHTDESK_VISUAL_STANDARD.md) for branding, icon usage, layout, responsive behaviour and accessibility.

## Current first-use workflows

- Create and edit letters, reports and other text documents.
- Apply basic text formatting, headings, paragraph alignment, lists and simple tables.
- Set paper size to A4, US Letter or US Legal, choose portrait or landscape, and select margin presets.
- Save and reopen Brightdesk project data; use the supported document import and export options, including PDF export.

**Known boundaries:** Pages is an early document-editor foundation, not complete Word feature parity. Advanced page-layout tools, macros, collaboration and perfect round-trip conversion are not promised.
## Desktop installers

Choose the installer for your computer:

| Computer | Installer |
| --- | --- |
| Windows | Windows x64 installer (.exe) |
| macOS | Universal installer (.dmg), package (.pkg) or archive (.zip) |
| Linux | Portable Linux package or Debian package (.deb) |

Installers are published here after the release checks have passed and a release has been approved.

## Run from source

Use Node.js **24.22.2**.

```sh
npm ci
npm start
```

To build and verify an installer on its native operating system:

```sh
npm run dist:desktop:mac
npm run verify:desktop:mac
```

Use `win` on Windows or `linux` on Linux instead of `mac`.

## Project files

- `src/` — the Brightdesk Pages editor and supporting desktop code.
- `assets/icons/pages.svg` — original Brightdesk Pages application icon.
- `assets/previews/pages-workspace.svg` — workspace concept preview.
- `scripts/` — build and release verification tools.
- `tests/` — automated checks.

## Related project

[Brightdesk Office Suite](https://github.com/connormolloy12/Brightdesk-suite) brings the approved Brightdesk products together in one desktop installation.

## Private maintenance checks

The Brightdesk-Pages maintenance controller checks each approved private project from its default `main` branch. It uses short-lived, repository-scoped Contents: read-only tokens. For failed Suite tests, a separate Issues-only token can post bounded failing-test names to the private Suite maintenance issue. One-time Suite installer checks build Windows, macOS and Linux packages, verify expected files and SHA-256 checksums, then perform temporary native install, startup and uninstall checks. The launch check sets `BRIGHTDESK_STARTUP_SMOKE_TEST=1`; the installed desktop runtime validates its packaged version, protected terms and default language resources, loads its actual hidden main window, checks the required navigation panels, and exits with a result code. Launch checks fail if the process exits unsuccessfully or exceeds the platform timeout. For installer failures, a separate Suite-only Issues token can post only the platform, approved failed stage, exit code and allow-listed diagnostic details to the private issue. Raw logs, source files, file paths, stack traces, credentials and installer binaries are not published in this repository; build files remain on ephemeral runners.

## Identity and licence

Brightdesk is independent and is not affiliated with Microsoft. It uses original product names, code, interface design and artwork. See [LICENSE](LICENSE), [TERMS_AND_CONDITIONS.txt](TERMS_AND_CONDITIONS.txt), and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Rust engineering foundation

This repository now has a reviewable Rust integration contract in [docs/RUST_INTEGRATION.md](docs/RUST_INTEGRATION.md). Rust is being introduced alongside the existing JavaScript/Electron architecture, not as a rewrite. The document defines the safe-core rules, workload benchmarking, JavaScript fallback, native bridge gates, Cargo checks and the adoption standard for future Brightdesk repositories.

This documentation does **not** claim that Rust is already connected to the application, included in installers or producing a performance improvement. Existing product behaviour, Node.js 24.22.2, the customer version 0.1.0, and manual owner approval for releases remain unchanged.
