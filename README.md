# Brightdesk Pages

![Brightdesk Pages preview](assets/social-preview.svg)

![Brightdesk Pages document preview](assets/brightdesk-pages.svg)

Create letters, reports and formatted documents.

**Brightdesk Pages** is a desktop document editor for writing and formatting your work. It is delivered through a desktop installer for your computer.

## What you can do

Create letters, reports and formatted documents with familiar editing and page-layout tools.

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
- `assets/brightdesk-pages.svg` — Brightdesk Pages preview artwork.
- `scripts/` — build and release verification tools.
- `tests/` — automated checks.

## Related project

[Brightdesk Office Suite](https://github.com/connormolloy12/Brightdesk-suite) brings the approved Brightdesk products together in one desktop installation.

## Private maintenance checks

The Brightdesk-Pages maintenance controller checks each approved private project from its default `main` branch. It uses short-lived, repository-scoped Contents: read-only tokens. For failed Suite tests, a separate Issues-only token can post bounded failing-test names to the private Suite maintenance issue. One-time Suite installer checks build Windows, macOS and Linux packages, verify expected files and SHA-256 checksums, then perform temporary native install, startup and uninstall checks. The launch check sets `BRIGHTDESK_STARTUP_SMOKE_TEST=1`; the installed desktop runtime validates its packaged version, protected terms and default language resources, loads its actual hidden main window, checks the required navigation panels, and exits with a result code. Launch checks fail if the process exits unsuccessfully or exceeds the platform timeout. For installer failures, a separate Suite-only Issues token can post only the platform, approved failed stage, exit code and allow-listed diagnostic details to the private issue. Raw logs, source files, file paths, stack traces, credentials and installer binaries are not published in this repository; build files remain on ephemeral runners.

## Identity and licence

Brightdesk is independent and is not affiliated with Microsoft. It uses original product names, code, interface design and artwork. See [LICENSE](LICENSE), [TERMS_AND_CONDITIONS.txt](TERMS_AND_CONDITIONS.txt), and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Rust native engine

This standalone product builds and loads the shared Rust Node-API module from its own source. Rust handles bounded source processing and provider-neutral embedding normalisation, cosine similarity, and ranking for vectors returned by an explicitly configured model provider. It does not create semantic embeddings or call external models. No remote provider, paid API, credential, or remote source upload is enabled. See [Rust Node-API integration](docs/RUST_ENGINE_INTEGRATION.md).
