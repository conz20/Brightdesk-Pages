#!/usr/bin/env bash
set -Eeuo pipefail

: "${RUNNER_TEMP:?RUNNER_TEMP is required}"
: "${GITHUB_STEP_SUMMARY:?GITHUB_STEP_SUMMARY is required}"

if [[ -z "${SOURCE_READ_TOKEN:-}" || -z "${ARCHIVE_WRITE_TOKEN:-}" ]]; then
  echo "::error::Configure BRIGHTDESK_ARCHIVE_SOURCE_READ_TOKEN and BRIGHTDESK_ARCHIVE_WRITE_TOKEN in Brightdesk-Pages Actions secrets."
  exit 1
fi

work="$RUNNER_TEMP/brightdesk-archive"
rm -rf "$work"
mkdir -p "$work"
trap 'rm -rf "$work"' EXIT

# Askpass reads tokens from this process environment. Token values are never
# written to disk, URLs, Git config, outputs or workflow logs.
cat > "$work/source-askpass.sh" <<'ASKPASS'
#!/bin/sh
case "$1" in
  *Username*) printf '%s\n' 'x-access-token' ;;
  *Password*) printf '%s\n' "$SOURCE_READ_TOKEN" ;;
  *) exit 1 ;;
esac
ASKPASS
cat > "$work/archive-askpass.sh" <<'ASKPASS'
#!/bin/sh
case "$1" in
  *Username*) printf '%s\n' 'x-access-token' ;;
  *Password*) printf '%s\n' "$ARCHIVE_WRITE_TOKEN" ;;
  *) exit 1 ;;
esac
ASKPASS
chmod 700 "$work/source-askpass.sh" "$work/archive-askpass.sh"

repos=(
  Brightdesk-suite Brightdesk-Pages Brightdesk-Sheets Brightdesk-Decks
  Brightdesk-Notes Brightdesk-Database Brightdesk-Forms Brightdesk-AI
  Brightdesk-Lists Brightdesk-Planner Brightdesk-To-Do Brightdesk-Workspace
  Brightdesk-Fonts Brightdesk-Localization Brightdesk-Engine
  Brightdesk-Design-System Brightdesk-Common-Libs Brightdesk-Common-Actions
  Brightdesk-Developer-Tools Brightdesk-Extensions Brightdesk-Wiki
  Brightdesk-Release-Tools Brightdesk-Services Brightdesk-Type-Preview
  Brightdesk-Assets Brightdesk-Printing Brightdesk-Voice
)

private_repos=(
  Brightdesk-Notes Brightdesk-AI Brightdesk-Lists Brightdesk-Fonts
  Brightdesk-Localization Brightdesk-Engine Brightdesk-Common-Libs
  Brightdesk-Common-Actions Brightdesk-Developer-Tools
  Brightdesk-Release-Tools Brightdesk-Services Brightdesk-Type-Preview
  Brightdesk-Printing Brightdesk-Voice
)

stamp="$(date -u +%Y%m%dT%H%M%SZ)"
printf '## Brightdesk archive sync %s\n\n' "$stamp" >> "$GITHUB_STEP_SUMMARY"
failures=0
succeeded=0

for repo in "${repos[@]}"; do
  echo "::group::Archiving $repo"
  dir="$work/$repo.git"
  rm -rf "$dir"

  is_private=false
  for private_repo in "${private_repos[@]}"; do
    if [[ "$repo" == "$private_repo" ]]; then
      is_private=true
      break
    fi
  done

  clone_ok=true
  if [[ "$is_private" == "true" ]]; then
    if ! GIT_ASKPASS="$work/source-askpass.sh" GIT_TERMINAL_PROMPT=0 \
      git clone --bare --quiet "https://github.com/conz20/$repo.git" "$dir"; then
      clone_ok=false
    fi
  elif ! GIT_TERMINAL_PROMPT=0 \
    git clone --bare --quiet "https://github.com/conz20/$repo.git" "$dir"; then
    clone_ok=false
  fi

  if [[ "$clone_ok" != "true" ]]; then
    echo "::error::Could not clone $repo. Existing archive refs were not intentionally deleted."
    printf -- '- FAILED: %s (clone)\n' "$repo" >> "$GITHUB_STEP_SUMMARY"
    failures=$((failures + 1))
    echo "::endgroup::"
    continue
  fi

  # Verify the local object database before publishing any refs.
  if ! git -C "$dir" fsck --full --no-reflogs > "$work/fsck-$repo.log" 2>&1; then
    echo "::error::Git object integrity check failed for $repo. No refs were pushed."
    printf -- '- FAILED: %s (git fsck)\n' "$repo" >> "$GITHUB_STEP_SUMMARY"
    failures=$((failures + 1))
    echo "::endgroup::"
    continue
  fi

  # Preserve timestamped pointers for every fetched source branch and tag.
  while IFS= read -r ref; do
    [[ -n "$ref" ]] || continue
    short="${ref#refs/}"
    sha="$(git -C "$dir" rev-parse "$ref")"
    git -C "$dir" update-ref "refs/archive/$repo/snapshots/$stamp/$short" "$sha"
  done < <(git -C "$dir" for-each-ref --format='%(refname)' refs/heads refs/tags)

  # Keep a namespaced current view plus immutable timestamped snapshots.
  # Deliberately do not prune: deleted source refs remain recoverable.
  git -C "$dir" remote add archive "https://github.com/conz20/Brightdesk-Archives.git"
  if ! GIT_ASKPASS="$work/archive-askpass.sh" GIT_TERMINAL_PROMPT=0 \
    git -C "$dir" push --quiet archive \
      "+refs/heads/*:refs/archive/$repo/heads/*" \
      "+refs/tags/*:refs/archive/$repo/tags/*" \
      "+refs/archive/$repo/snapshots/*:refs/archive/$repo/snapshots/*"; then
    echo "::error::Archive push failed for $repo. Existing archive refs were not intentionally deleted."
    printf -- '- FAILED: %s (push)\n' "$repo" >> "$GITHUB_STEP_SUMMARY"
    failures=$((failures + 1))
    echo "::endgroup::"
    continue
  fi

  expected_refs="$(git -C "$dir" for-each-ref --format='%(refname)' refs/heads refs/tags "refs/archive/$repo/snapshots" | wc -l | tr -d '[:space:]')"
  if ! actual_refs="$(GIT_ASKPASS="$work/archive-askpass.sh" GIT_TERMINAL_PROMPT=0 git -C "$dir" ls-remote --refs archive "refs/archive/$repo/*" | wc -l | tr -d '[:space:]')"; then
    echo "::error::Could not verify archived refs for $repo."
    printf -- '- FAILED: %s (remote verification)\n' "$repo" >> "$GITHUB_STEP_SUMMARY"
    failures=$((failures + 1))
    echo "::endgroup::"
    continue
  fi

  if [[ "$actual_refs" != "$expected_refs" ]]; then
    echo "::error::Archived ref count did not match for $repo (expected $expected_refs, found $actual_refs)."
    printf -- '- FAILED: %s (ref count mismatch)\n' "$repo" >> "$GITHUB_STEP_SUMMARY"
    failures=$((failures + 1))
    echo "::endgroup::"
    continue
  fi

  printf -- '- OK: %s (%s refs verified)\n' "$repo" "$actual_refs" >> "$GITHUB_STEP_SUMMARY"
  succeeded=$((succeeded + 1))
  echo "::endgroup::"
done

{
  echo
  echo "- Repositories passed: $succeeded / 27"
  echo "- Repositories failed: $failures"
  echo "- Snapshot timestamp: $stamp"
} >> "$GITHUB_STEP_SUMMARY"

if (( failures > 0 )); then
  echo "::error::$failures repository backup(s) failed. This run is not a complete portfolio backup."
  exit 1
fi

echo "All 27 source repositories (13 public and 14 private) were mirrored and their archive ref counts verified."
