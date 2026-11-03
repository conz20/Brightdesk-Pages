# Brightdesk private project maintenance runner

## Why this runs from Brightdesk Pages

GitHub-hosted Ubuntu runner jobs in the private Brightdesk repositories are currently being rejected before they start. Brightdesk Pages is public and its standard hosted runner jobs have succeeded. GitHub documents standard GitHub-hosted runner usage in public repositories as free.

This controller therefore runs from the public Brightdesk Pages repository and checks out the six private Brightdesk source repositories only onto the temporary GitHub runner. It does not copy private source files into Brightdesk Pages, publish them as artifacts, or print raw test/build logs.

## Private repository access (one-time setup)

The workflow requires a fine-grained personal access token stored as a GitHub Actions secret. The token is never part of the source code and must never be pasted into chat or a repository file.

1. In GitHub, open **Settings → Developer settings → Personal access tokens → Fine-grained tokens**.
2. Create a token for resource owner `connormolloy12`.
3. Choose **Only select repositories** and select exactly these six private repositories:
   - Brightdesk-suite
   - Brightdesk-Sheets
   - Brightdesk-Decks
   - Brightdesk-Notes
   - Brightdesk-Database
   - Brightdesk-Forms
4. Under repository permissions, grant **Contents: Read-only**. Do not grant Contents write, Administration, Actions write, Secrets, or signing-related permissions.
5. Choose an expiry that suits the owner and create the token.
6. Copy the token once. In the public `Brightdesk-Pages` repository, open **Settings → Secrets and variables → Actions → New repository secret**.
7. Set the secret name to `BRIGHTDESK_PRIVATE_REPOSITORIES_READ` and paste the token as its value. Save it.

The token is read-only. It can download the selected private repositories for checking, but it cannot change their files, create branches, open pull requests or publish releases.

## What runs

- Daily: the six private repositories run their pinned Node.js 24.22.2 checks on a public GitHub-hosted Ubuntu runner.
- Weekly: after the daily checks pass, the six private repositories build and verify their current Windows, macOS and Linux packages using GitHub-hosted runners.
- Manual: the workflow can run the daily checks on demand. Its optional cross-platform build switch starts the 18-project/platform build matrix.

All build commands use `--publish never` from the existing Brightdesk package scripts. The controller does not upload artifacts or publish a release.

## Privacy

The private repository checkout uses `persist-credentials: false`. Test, build and verification command output is redirected to a temporary file on the runner. Only the repository name, operating system, target format, pass/fail stage and a generic message are written to the public workflow summary. No source files, raw logs, installer files or private test output are uploaded as artifacts.

This is still a public workflow, so changes to the controller must be reviewed before merging. The PAT should remain read-only and limited to the six selected private repositories.

## Limits

- The controller requires the one-time read-only PAT secret before it can access private code.
- It checks code, dependencies, release readiness and whether the existing package build/verification scripts succeed. It does not install each package into a real Windows, macOS or Linux machine, launch the installed app, or verify uninstall cleanup yet.
- This first controller does not write code, create update pull requests, respond to `/ai` comments in private repositories or publish user releases.
- macOS `macos-latest` uses the current GitHub-hosted Apple-silicon runner image. Brightdesk's universal macOS build is intended to include Intel support, but the controller still needs a real Intel Mac installation test.
- Windows ARM64 and Linux ARM64 are not included in the currently declared build matrix.
- No paid API, paid AI key, signing key or paid runner is used.
