# Brightdesk Pages

![Brightdesk Pages preview](assets/social-preview.svg)

![Brightdesk Pages document preview](assets/brightdesk-pages.svg)

Create letters, reports and formatted documents.

**Brightdesk Pages Desktop Edition** is a desktop document editor for writing and formatting your work. It is available for Windows, macOS and Linux.

## What you can do

Create letters, reports and formatted documents with familiar editing and page-layout tools.

## Desktop edition

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

## Identity and licence

Brightdesk is independent and is not affiliated with Microsoft. It uses original product names, code, interface design and artwork. See [LICENSE](LICENSE), [TERMS_AND_CONDITIONS.txt](TERMS_AND_CONDITIONS.txt) and [NOTICE](NOTICE) for the relevant rights and licensing terms.
