# Brightdesk Pages

<p align="center"><img src="assets/brand/brightdesk-logo.svg" alt="Brightdesk Office Suite" width="420"></p>
<p align="center"><img src="assets/icons/pages.svg" alt="Brightdesk Pages application icon" width="112" height="112"></p>

<p align="center"><strong>Create letters, reports and formatted documents.</strong></p>

<p align="center"><a href="https://raw.githubusercontent.com/connormolloy12/Brightdesk-Pages/main/assets/previews/pages-workspace.svg"><img src="assets/previews/pages-workspace.svg" alt="Brightdesk Pages workspace design preview" width="100%"></a></p>

<p align="center"><sub>Select the preview to open the full-size artwork.</sub></p>

> **Concept artwork — not a screenshot.** The preview above is original Brightdesk design artwork, not a capture from the running desktop build. A genuine screenshot will be added only after the current product window has been launched and its primary workflow checked.

Brightdesk Pages is a dedicated desktop application within the independent Brightdesk Office Suite. It uses the shared Brightdesk design language and opens directly into Pages.

## Shared Brightdesk design standard
This product follows the local [approved design brief](docs/BRIGHTDESK_DESIGN.md) and the canonical [Brightdesk visual and interaction standard](https://github.com/connormolloy12/Brightdesk-suite/blob/main/docs/BRIGHTDESK_VISUAL_STANDARD.md). Its approved accent is `#5966C9`; the shared shell, original SVG identity, accessibility rules and screenshot evidence requirements remain consistent across the suite.

## Current first-use workflows

- Create and edit letters, reports and other text documents.
- Apply basic text formatting, headings, paragraph alignment, lists and simple tables.
- Set paper size to A4, US Letter or US Legal, choose portrait or landscape, and select margin presets.
- Save and reopen Brightdesk project data; use the supported document import and export options, including PDF export.

**Known boundaries:** Pages is an early document-editor foundation, not complete Word feature parity. Advanced page-layout tools, macros, collaboration and perfect round-trip conversion are not promised.
## Cross-platform desktop packages

All supported desktop editions use the same approved Brightdesk interface and product scope. Each product keeps its approved icon and accent on Windows, macOS and Linux. Only operating-system integrations such as window chrome, native dialogs, keyboard conventions, permissions and packaging may vary.

| Platform | Configured package target |
| --- | --- |
| Windows | x64 NSIS installer (.exe) |
| macOS | Universal disk image (.dmg), package installer (.pkg) and archive (.zip) |
| Linux | x64 AppImage (.AppImage) and Debian package (.deb) |

These are configured build targets, not confirmation that installers are published or have passed native verification. Build and verify each package on its target operating system before describing it as available. Release checks must cover installation, first launch, upgrade, launch after upgrade and removal. Removing Brightdesk must not silently delete local project data.

The customer-facing release version and release approval are managed centrally by Brightdesk Office Suite. Publishing remains a separate manual action.
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
