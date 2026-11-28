#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="${1:-}"
PROJECT_NAME="${2:-}"
PLATFORM="${3:-}"
if [[ -z "$PROJECT_DIR" || ! -d "$PROJECT_DIR" || -z "$PROJECT_NAME" || -z "$PLATFORM" ]]; then
  echo "Invalid private support validation arguments." >&2
  exit 2
fi

PROJECT_DIR="$(cd "$PROJECT_DIR" && pwd)"
LOG_FILE="${RUNNER_TEMP:-/tmp}/brightdesk-support-${PROJECT_NAME}-${PLATFORM}.log"
STAGE="validation setup"

fail_validation() {
  local status="$1"
  {
    echo "## Private Brightdesk support validation"
    echo
    echo "- Project: $PROJECT_NAME"
    echo "- Platform: $PLATFORM"
    echo "- Result: **FAILED**"
    echo "- Failed stage: $STAGE"
    echo "- Detailed output was kept only on the temporary runner."
  } >> "${GITHUB_STEP_SUMMARY:-/dev/null}"
  echo "::error title=Private Brightdesk support validation failed::$PROJECT_NAME failed during $STAGE on $PLATFORM. Detailed output was kept only on the temporary runner."
  exit "$status"
}

run_safely() {
  local stage="$1"
  shift
  STAGE="$stage"
  if (cd "$PROJECT_DIR" && "$@") >> "$LOG_FILE" 2>&1; then
    echo "Passed: $stage"
  else
    local status="$?"
    fail_validation "$status"
  fi
}

case "$PROJECT_NAME:$PLATFORM" in
  Brightdesk-AI:mac|Brightdesk-Fonts:linux|Brightdesk-Localization:linux|Brightdesk-Engine:mac|Brightdesk-Common-Libs:linux|Brightdesk-Common-Actions:linux|Brightdesk-Developer-Tools:linux|Brightdesk-Release-Tools:linux|Brightdesk-Services:linux|Brightdesk-Type-Preview:mac|Brightdesk-Printing:mac|Brightdesk-Printing:win|Brightdesk-Voice:mac)
    ;;
  *)
    echo "Project/platform pair is not in the support validation allowlist." >&2
    exit 2
    ;;
esac

if [[ "$PROJECT_NAME" != "Brightdesk-Engine" ]]; then
  if [[ ! -f "$PROJECT_DIR/package.json" || ! -f "$PROJECT_DIR/package-lock.json" ]]; then
    STAGE="project package files"
    fail_validation 2
  fi
  node_version="$(node -e "const p=require(process.argv[1]); process.stdout.write(p.engines?.node ?? '')" "$PROJECT_DIR/package.json")"
  if [[ "$node_version" != "24.22.2" ]]; then
    STAGE="required Node.js version"
    fail_validation 2
  fi
  run_safely "locked dependency installation" npm ci --no-audit --no-fund
else
  if [[ ! -f "$PROJECT_DIR/Cargo.toml" || ! -f "$PROJECT_DIR/rust-toolchain.toml" ]]; then
    STAGE="Rust workspace files"
    fail_validation 2
  fi
  run_safely "toolchain prerequisites" node scripts/verify-build-prerequisites.js
fi

case "$PROJECT_NAME" in
  Brightdesk-AI)
    run_safely "Node.js regression tests" npm test
    run_safely "Rust formatting" cargo fmt --manifest-path rust/Cargo.toml --all -- --check
    run_safely "Rust Clippy" cargo clippy --manifest-path rust/Cargo.toml --workspace --all-targets -- -D warnings
    run_safely "Rust unit tests" cargo test --manifest-path rust/Cargo.toml --workspace --locked
    run_safely "native Node-API build" npm run native:build
    run_safely "private engineering audit" npm run audit
    ;;
  Brightdesk-Fonts)
    run_safely "Node runtime check" npm run check:node
    run_safely "catalogue and integrity checks" npm run check
    run_safely "font licence and provenance verification" npm run verify
    run_safely "font regression tests" npm test
    ;;
  Brightdesk-Localization)
    run_safely "language catalogue checks" npm run check:catalogue
    run_safely "language resource checks" npm run check:resources
    run_safely "localization regression tests" npm test
    ;;
  Brightdesk-Engine)
    run_safely "upstream Hunspell build fixture" node --test tests/hunspell-upstream-build.test.js
    run_safely "native addon platform mapping tests" node --test tests/native-addon-platform.test.js
    run_safely "cross-platform workflow policy tests" node --test tests/cross-platform-workflow.test.js
    run_safely "pinned English Australia test dictionary" node scripts/fetch-pinned-en-au-dictionary.js
    run_safely "Rust formatting" cargo fmt --all -- --check
    run_safely "Rust workspace tests" cargo test --workspace --locked
    run_safely "Rust Clippy" cargo clippy --workspace --all-targets --locked -- -D warnings
    run_safely "native Node-API library build" cargo build --package brightdesk-language-native --release --locked
    run_safely "native addon tests" node scripts/run-native-addon-tests.js
    ;;
  Brightdesk-Common-Libs)
    run_safely "Node runtime check" npm run check:node
    run_safely "library syntax and contract checks" npm run check
    run_safely "shared library tests" npm test
    ;;
  Brightdesk-Common-Actions)
    run_safely "shared action tests" npm test
    run_safely "README visual asset validation" npm run validate:readme-visuals
    ;;
  Brightdesk-Developer-Tools)
    run_safely "Node runtime check" npm run check:node
    run_safely "developer tool syntax checks" npm run check
    run_safely "developer tool regression tests" npm test
    run_safely "JSON doctor diagnostic" node bin/brightdesk-dev.mjs doctor --root "$PROJECT_DIR" --json
    ;;
  Brightdesk-Release-Tools)
    run_safely "release tooling tests" npm test
    run_safely "release tooling audit" npm run audit
    ;;
  Brightdesk-Services)
    run_safely "services syntax and policy checks" npm run check
    run_safely "services regression tests" npm test
    ;;
  Brightdesk-Type-Preview)
    run_safely "Node runtime check" npm run check:node
    run_safely "type preview syntax checks" npm run check
    run_safely "type preview regression tests" npm test
    run_safely "native macOS Core Text collector build" npm run native:build:macos
    run_safely "native macOS Core Text tests" npm run native:test:macos
    ;;
  Brightdesk-Printing)
    if [[ "$PLATFORM" == "mac" ]]; then
      run_safely "native macOS Bonjour discovery helper build" npm run build:macos-discovery
    else
      run_safely "native Windows printer helper build" npm run build:windows-discovery
    fi
    run_safely "printing regression tests" npm test
    run_safely "virtual printer tests" npm run test:virtual-printer
    ;;
  Brightdesk-Voice)
    run_safely "language inventory validation" npm run validate:languages
    run_safely "model pack validation" npm run validate:model-packs
    run_safely "voice syntax and policy checks" npm run check
    run_safely "voice regression tests" npm test
    ;;
esac

{
  echo "## Private Brightdesk support validation"
  echo
  echo "- Project: $PROJECT_NAME"
  echo "- Platform: $PLATFORM"
  echo "- Result: **PASSED**"
  echo "- Exact source head and base ancestry were verified by the workflow."
  echo "- Detailed command output was kept only on the temporary runner."
} >> "${GITHUB_STEP_SUMMARY:-/dev/null}"
echo "Private Brightdesk support validation passed."
