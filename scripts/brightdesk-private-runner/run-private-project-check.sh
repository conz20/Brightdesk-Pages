#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-}"
PROJECT_DIR="${2:-}"
PROJECT_NAME="${3:-unknown}"
PLATFORM="${4:-}"
VERIFY_SCRIPT="${5:-}"

if [[ -z "$MODE" || -z "$PROJECT_DIR" || ! -d "$PROJECT_DIR" ]]; then
  echo "Brightdesk private project checker received invalid arguments." >&2
  exit 2
fi

PROJECT_DIR="$(cd "$PROJECT_DIR" && pwd)"
LOG_FILE="${RUNNER_TEMP:-/tmp}/brightdesk-private-${PROJECT_NAME}-${PLATFORM:-tests}.log"
STAGE="runtime check"

fail_check() {
  status="$1"
  if [[ "$MODE" == "build" && "$PROJECT_NAME" == "Brightdesk-suite" && "$PLATFORM" =~ ^(win|mac|linux)$ ]]; then
    local summary_file="${RUNNER_TEMP:-/tmp}/brightdesk-suite-installer-${PLATFORM}-failure-summary.b64"
    if node "$(dirname "$0")/private-installer-diagnostics.js" "$LOG_FILE" "$PLATFORM" "$STAGE" "$status" > "$summary_file"; then
      if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
        printf 'installer_failure_summary_file=%s\n' "$summary_file" >> "$GITHUB_OUTPUT"
      fi
    else
      rm -f "$summary_file"
    fi
  fi
  {
    echo "## Brightdesk private project check"
    echo
    echo "- Project: ${PROJECT_NAME}"
    echo "- Operating system: ${RUNNER_OS:-unknown}"
    if [[ -n "$PLATFORM" ]]; then
      echo "- Installer target: ${PLATFORM}"
    fi
    echo "- Result: **FAILED**"
    echo "- Failed stage: ${STAGE}"
    echo "- Detailed output was kept only on the temporary runner and was not published."
  } >> "${GITHUB_STEP_SUMMARY:-/dev/null}"
  echo "::error title=Brightdesk check failed::${PROJECT_NAME} failed at ${STAGE} on ${RUNNER_OS:-unknown}. Private command output was suppressed."
  exit "$status"
}

run_private_command() {
  local stage="$1"
  shift
  STAGE="$stage"
  if (cd "$PROJECT_DIR" && "$@") >> "$LOG_FILE" 2>&1; then
    return 0
  else
    local status=$?
    fail_check "$status"
  fi
}

if [[ ! -f "$PROJECT_DIR/package.json" || ! -f "$PROJECT_DIR/package-lock.json" ]]; then
  STAGE="project files"
  fail_check 2
fi

if ! node -e "const p=require(process.argv[1]); if (p.engines?.node !== '24.22.2') process.exit(1)" "$PROJECT_DIR/package.json"; then
  STAGE="required Node.js version"
  fail_check 2
fi

run_private_tests() {
  STAGE="automated tests"
  if (cd "$PROJECT_DIR" && npm test -- --test-reporter=tap) >> "$LOG_FILE" 2>&1; then
    return 0
  else
    local status=$?
    if [[ "$PROJECT_NAME" == "Brightdesk-suite" ]]; then
      local summary
      local summary_file="${RUNNER_TEMP:-/tmp}/brightdesk-private-${PROJECT_NAME}-failure-summary.b64"
      summary="$(node "$(dirname "$0")/private-test-diagnostics.js" "$LOG_FILE" "$PROJECT_NAME")"
      printf '%s' "$summary" > "$summary_file"
      if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
        printf 'failure_summary_file=%s\n' "$summary_file" >> "$GITHUB_OUTPUT"
      fi
    fi
    fail_check "$status"
  fi
}

if [[ "$MODE" == "test" ]]; then
  run_private_command "Node.js version check" npm run check:node
  run_private_command "dependency lock check" npm run lock:verify
  run_private_command "locked dependency installation" npm ci --no-audit --no-fund
  run_private_command "third-party licence check" npm run verify:licenses
  run_private_tests
  run_private_command "release readiness check" npm run release:preflight
elif [[ "$MODE" == "build" ]]; then
  if [[ -z "$PLATFORM" || -z "$VERIFY_SCRIPT" ]]; then
    STAGE="build configuration"
    fail_check 2
  fi
  run_private_command "Node.js version check" npm run check:node
  run_private_command "dependency lock check" npm run lock:verify
  run_private_command "locked dependency installation" npm ci --no-audit --no-fund
  run_private_command "third-party licence check" npm run verify:licenses
  run_private_command "release readiness check" npm run release:preflight
  if [[ "$PLATFORM" == "mac" ]]; then
    export CSC_IDENTITY_AUTO_DISCOVERY=false
  fi
  run_private_command "installer build" npm run "dist:${PLATFORM}"
  run_private_command "release asset preparation" npm run release:prepare -- "$PLATFORM"
  run_private_command "installer package verification" npm run "$VERIFY_SCRIPT"
  if [[ "$PROJECT_NAME" == "Brightdesk-suite" ]]; then
    run_private_command "installer installation smoke test" bash "$(dirname "$0")/verify-private-install.sh" "$PROJECT_DIR" "$PLATFORM"
  fi
else
  STAGE="unknown check mode"
  fail_check 2
fi

{
  echo "## Brightdesk private project check"
  echo
  echo "- Project: ${PROJECT_NAME}"
  echo "- Operating system: ${RUNNER_OS:-unknown}"
  if [[ -n "$PLATFORM" ]]; then
    echo "- Installer target: ${PLATFORM}"
  fi
  echo "- Result: **PASSED**"
  echo "- Detailed command output was not published."
} >> "${GITHUB_STEP_SUMMARY:-/dev/null}"

echo "Brightdesk private project checks passed."
