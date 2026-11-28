# Brightdesk Pages

<p align="center"><img src="assets/brand/brightdesk-logo.svg" alt="Brightdesk logo" width="420"></p>
<p align="center"><img src="assets/icons/pages.svg" alt="Brightdesk Pages application icon" width="112" height="112"></p>

<p align="center"><strong>Create letters, reports and formatted documents.</strong></p>

<p align="center"><a href="https://raw.githubusercontent.com/conz20/Brightdesk-Pages/main/assets/previews/pages-workspace.svg"><img src="assets/previews/pages-workspace.svg" alt="Brightdesk Pages interface design" width="100%"></a></p>

<p align="center"><sub>Select the interface image to open the full-size design.</sub></p>

> **Interface design artwork — not a screenshot.** This image shows the intended Brightdesk interface. It is not a capture from the running desktop build. A genuine product screenshot will be added after the current desktop build has been launched and its primary workflow verified.

Brightdesk Pages is a dedicated desktop application within the independent Brightdesk Office Suite. It uses the shared Brightdesk design language and opens directly into Pages.

## Shared Brightdesk design standard

This product follows the [Brightdesk visual and interaction standard](https://github.com/conz20/Brightdesk-suite/blob/main/docs/BRIGHTDESK_VISUAL_STANDARD.md) for branding, icon usage, layout, responsive behaviour and accessibility.



### Live interaction motion

The shared motion stylesheet now animates the entry of the document and product workspaces, the Get apps and Languages views, and native disclosure-panel content. Product buttons use the shared timing and easing scale while preserving the existing horizontal navigation hover treatment. Update checks and downloads show a decorative loading spinner beside the live status text; presentation mode uses the shared open/close overlay and closes immediately when reduced motion is requested.

## Shared motion foundation

This product bundles the canonical Brightdesk motion stylesheet locally at `src/motion.css`, loaded after `src/design-system.css`. Existing product controls use the shared fast timing and standard easing tokens (120 ms); the shared scale also defines 180 ms and 260 ms transitions. Reusable surface, interactive-control, overlay, progress and loading-indicator primitives are available for product-owned components.

The stylesheet is packaged with the desktop product and does not load from GitHub or another network service at runtime. The `prefers-reduced-motion: reduce` setting disables the shared transitions and spinner animation. Motion does not replace keyboard focus, accessibility semantics or component-specific state handling.

## Product navigation

Individual Pages windows use the canonical [Brightdesk Design System product-window shell](https://github.com/conz20/Brightdesk-Design-System/blob/main/css/product-window.css). Navigation expands to 232 px at 1008 px and wider, and starts compact at 76 px between 641 px and 1007 px. Compact labels remain available to assistive technology. Brightdesk is desktop-only for Windows, macOS and Linux; no mobile application, mobile edition or mobile navigation mode is built or supported. The Suite keeps its fixed 192 px labelled rail and does not receive the individual-product window class.

The product stylesheet is mirrored into the Pages source so the installed product works offline. It does not load the Design System over the network at runtime. Keep `src/product-window.css` aligned with the canonical Design System file.

## Cross-platform consistency

The Windows, macOS and Linux editions use the same approved Brightdesk interface and supported product scope. Shared layout, typography, spacing, component states and navigation follow the [Brightdesk visual and interaction standard](https://github.com/conz20/Brightdesk-suite/blob/main/docs/BRIGHTDESK_VISUAL_STANDARD.md). This product's original icon and approved accent remain the same on every operating system. Only operating-system integrations such as window controls, native file dialogs, keyboard conventions and package formats may adapt to platform conventions.

| Operating system | Configured package targets |
| --- | --- |
| Windows | x64 NSIS installer (.exe) |
| macOS | Universal disk image (.dmg), package installer (.pkg) and archive (.zip) |
| Linux | x64 AppImage (.AppImage) and Debian package (.deb) |

These are configured build targets, not confirmation that a package has passed its native build, installation, upgrade and removal checks. Each operating system must pass its own release verification before its download is described as available.

**Terms and first launch:** A valid acceptance of the current Brightdesk Terms and Conditions is required before the product opens. When no current acceptance record exists, a blocking agreement window is shown. Accept continues; declining or closing the window exits the product. This first-use gate is present in the product source for Windows, macOS and Linux. Follow any additional agreement shown by the native installer.

**Updates and removal:** The approved product version and feature scope must remain aligned across all operating systems. Update packages must come from the same tested release. Native installation and removal controls can differ by operating system, but the expected outcome is consistent: remove the product without silently deleting local project data. Do not claim update, upgrade or uninstall verification for an operating system until its native workflow has passed.

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
| Linux | x64 AppImage (.AppImage) or Debian package (.deb) |

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
- `assets/previews/pages-workspace.svg` — workspace interface design.
- `scripts/` — build and release verification tools.
- `tests/` — automated checks.

## Related project

[Brightdesk Office Suite](https://github.com/conz20/Brightdesk-suite) brings the approved Brightdesk products together in one desktop installation.


### Repository-owner context for private checks

The private maintenance and Brightdesk-AI validation workflows derive the GitHub owner from the current repository context rather than embedding an account name in workflow configuration. Private project checkouts remain limited to the selected repository and use the existing short-lived Contents: read-only token. Targeted manual runs still validate only the selected project's exact branch, tag or commit on the GitHub-hosted Linux runner; they do not publish installers or expose private test output.

## Private maintenance checks

The Brightdesk-Pages maintenance controller checks each approved private project from its default `main` branch during scheduled, push and pull-request validation. For a manual run, the owner can choose one approved private project or all projects and provide that project's exact branch, tag or commit ref. A targeted manual run filters the Linux test matrix to that one project, skips the separate shared-foundation checks and does not start installer builds; selecting all projects retains the full maintenance behaviour. It uses short-lived, repository-scoped Contents: read-only tokens. The Suite's combined Node.js and Vitest test command is run in two parts so the TAP reporter option is passed only to Node's test runner, not to Vitest. For failed Suite tests, a separate Issues-only token can post bounded failing-test names to the private Suite maintenance issue. One-time Suite installer checks build Windows, macOS and Linux packages, verify expected files and SHA-256 checksums, then perform temporary native install, startup and uninstall checks. The launch check sets `BRIGHTDESK_STARTUP_SMOKE_TEST=1`; the installed desktop runtime validates its packaged version, protected terms and default language resources, loads its actual hidden main window, checks the required navigation panels, and exits with a result code. Launch checks fail if the process exits unsuccessfully or exceeds the platform timeout. For installer failures, a separate Suite-only Issues token can post only the platform, approved failed stage, exit code and allow-listed diagnostic details to the private issue. Raw logs, source files, file paths, stack traces, credentials and installer binaries are not published in this repository; build files remain on ephemeral runners.

For one owner-triggered batch run of the current reviewed product PRs, use **Actions → Brightdesk private maintenance** and enable **Run reviewed product PR matrix**. Leave **Project** as `all`, **Project ref** as `main`, and keep cross-platform builds disabled. The batch covers the nine current product attribution/security PRs plus the separate Lists official-dictionary change. Each entry is pinned to its reviewed PR head and base SHA; the job checks the exact head has not moved, applies the README freshness rule and runs the existing private test, lockfile, licence and release-preflight checks on a GitHub-hosted Linux runner. It uses one short-lived Contents: read-only token per repository, keeps raw test logs on the temporary runner, and does not build or publish installers. Refresh the pinned matrix in the workflow and tests before using it after any listed PR head changes.

## Documentation freshness

The root README is maintained alongside the product, not as an end-of-project task. Every pull request that changes application code, tests, UI, design assets, screenshots, icons, configuration, dependencies, packaging, or build/release workflows must also update this README in the same pull request. Keep feature status, screenshots and visual references, application icons, setup/build instructions, platform compatibility, and repository links aligned with the latest verified implementation. Describe planned or untested functionality as planned, never as completed. The **README freshness** GitHub Actions check requires a root `README.md` update whenever a pull request or direct push to `main` changes a non-Markdown file; a passing check confirms inclusion, while reviewers remain responsible for checking factual accuracy and current visuals.


## Shared local storage foundation

This product vendors the browser-compatible JSON storage helper from [Brightdesk Common Libraries](https://github.com/conz20/Brightdesk-Common-Libs/blob/0f1bd6bc1c4d88466dea4bd35f89f69660ad7d3c/src/browser/json-storage.js). The upstream commit is `0f1bd6bc1c4d88466dea4bd35f89f69660ad7d3c`; the source Git blob is pinned to `c32eed522d283bcf24aeda25729c79f655b37497`.

The checked-in copy is loaded locally before the renderer. It is not fetched from a package registry or any remote service at runtime. Existing document keys are preserved: current documents continue to save under `brightdesk-docs-v3`, legacy `brightdesk-docs-v2` data remains readable, and setup preferences remain under `brightdesk-app-setup-v1`. Document content and settings remain on this device.

## Customer network policy

Once installed, this product uses the internet only to check for, download and install official Brightdesk updates. Spelling checks run locally. Already-installed, integrity-verified dictionaries remain available offline. Catalogue entries that are not included in this build are reference information only and cannot be downloaded in-product. Future pack discovery, download and updates must use verified official Brightdesk resources; full online/offline/hybrid pack support remains pending until packs are licensed, built and tested. The product does not provide separate in-product installer downloads, customer accounts, passwords, profiles, subscriptions, cloud storage or online services. Normal product work remains local and available offline. Initial installer distribution takes place outside the running product.


## Individual product window

When opened by itself, Brightdesk Pages goes straight to its document workspace. The Suite's generic product-management view and welcome banner are removed from this window. The Pages identity and file actions remain in the top bar; the document name, editing ribbon and page canvas stay within the focused workspace.

The interface preview is design artwork showing the intended workspace arrangement. It is not a screenshot from a verified running build.


## Installer and platform verification

The product build configuration defines desktop packages for all three supported operating systems:

- **Windows:** NSIS installer (.exe).
- **macOS:** DMG, PKG and ZIP packages.
- **Linux:** AppImage and Debian package (.deb).

The private installer smoke-test scripts are shared verification tooling. Their regression tests check that a test run uses product-specific names and unique temporary locations, refuses to overwrite an existing macOS installation or package receipt, and does not remove a pre-existing Linux package. These source and regression checks are not proof that a native installer has been executed on each operating system.

The Pages maintenance controller uses GitHub-hosted runners on this public repository to check out the ten private Brightdesk projects with short-lived, repository-scoped read-only tokens. Daily checks run on hosted Linux; installer verification uses hosted Windows, macOS and Linux runners. No self-hosted runner or owner's MacBook is required, and standard hosted runners are free for public repositories.

A platform is complete only after the matching current-version artifacts and SHA-256 records are verified, followed by actual install, first launch, upgrade, repair, uninstall and user-data-preservation checks on that platform. Wine compatibility checks must not be described as native Windows certification. A passing CI run or queued native job does not prove platform acceptance. No unverified platform is described as release-ready.


## Shared local JSON storage

Pages uses the Brightdesk Common-Libs JSON storage helper from a checked-in local copy at `src/vendor/brightdesk-common-libs/json-storage.js`. The renderer loads it before `app.js`; no package registry, GitHub access or runtime network request is required. `src/vendor/brightdesk-common-libs/UPSTREAM.json` records the exact upstream revision and Git blob SHA. The consumer test verifies that provenance and the local storage contract.



## Portfolio archive backup

The `brightdesk-archive-sync.yml` workflow is the scheduled/manual controller for the private Brightdesk-Archives repository. It runs on a standard GitHub-hosted runner from this public repository, so portfolio backups do not depend on the owner's MacBook or private-repository Actions compute. It clones 13 public sources anonymously and reads the 14 private sources with a narrowly scoped, read-only credential; a separate credential can write only to Brightdesk-Archives. It verifies cloned Git objects, preserves timestamped branch/tag refs without pruning older snapshots, and checks every uploaded ref by exact name and object SHA. Pull-request validation runs only syntax and inventory tests; it never receives backup secrets or runs a mirror. The initial full backup and restore checks remain pending until the owner configures the two Actions secrets and dispatches a successful run. The controller reconciles every six hours (four times daily) using only GitHub-hosted runners; no local machine or MacBook is required. This Git mirror does not include GitHub settings, secrets, discussions, release assets, workflow artifacts, package data, Git LFS objects, local uncommitted files or an independent off-GitHub copy.

## Repository automation

The repository bootstrap templates use pinned GitHub Actions checkout v7.0.1 and setup-node v7.1.0 actions. README freshness checks run on GitHub-hosted Ubuntu.
