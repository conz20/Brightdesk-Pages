#!/usr/bin/env bash
set -Eeuo pipefail

: "${RUNNER_TEMP:?RUNNER_TEMP is required}"
: "${GITHUB_STEP_SUMMARY:?GITHUB_STEP_SUMMARY is required}"
: "${GITHUB_RUN_ID:?GITHUB_RUN_ID is required}"
: "${GITHUB_RUN_ATTEMPT:?GITHUB_RUN_ATTEMPT is required}"

if [[ -z "${SOURCE_READ_TOKEN:-}" || -z "${ARCHIVE_WRITE_TOKEN:-}" ]]; then
  echo "::error::Configure BRIGHTDESK_ARCHIVE_SOURCE_READ_TOKEN and BRIGHTDESK_ARCHIVE_WRITE_TOKEN in Brightdesk-Pages Actions secrets."
  exit 1
fi

work="$RUNNER_TEMP/brightdesk-archive"
rm -rf "$work"
mkdir -p "$work"
trap 'rm -rf "$work"' EXIT

# Askpass reads credentials from the process environment. Tokens are never
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

# In scheduled change-check mode, compare current source ref SHAs with the
# archive's stable refs before downloading any Git objects. Unchanged sources
# are skipped, so no clone or new timestamped snapshot is created for them.
# Include the workflow run and retry number so concurrent/manual reruns never
# reuse a snapshot namespace. Earlier snapshots remain immutable.
stamp="$(date -u +%Y%m%dT%H%M%SZ)-run${GITHUB_RUN_ID}-attempt${GITHUB_RUN_ATTEMPT}"
printf '## Brightdesk archive sync %s\n\n' "$stamp" >> "$GITHUB_STEP_SUMMARY"

# Scheduled change-check mode compares current source refs with stable archive
# refs before downloading Git objects. Unchanged sources do not get cloned.
only_changed="${ONLY_CHANGED:-false}"
declare -A changed_lookup=()
changed_repos=()

is_private_repo() {
  local candidate="$1"
  local private_repo
  for private_repo in "${private_repos[@]}"; do
    if [[ "$candidate" == "$private_repo" ]]; then
      return 0
    fi
  done
  return 1
}

source_base="https://github.com/conz20"
archive_url="https://github.com/conz20/Brightdesk-Archives.git"

if [[ "$only_changed" == "true" ]]; then
  echo "::group::Checking source refs for changes"
  scan_failures=0

  for repo in "${repos[@]}"; do
    source_url="$source_base/$repo.git"
    source_refs="$work/$repo.source-refs"
    archive_refs="$work/$repo.archive-stable-refs"

    if is_private_repo "$repo"; then
      if ! GIT_ASKPASS="$work/source-askpass.sh" GIT_TERMINAL_PROMPT=0 git ls-remote --refs "$source_url" 'refs/heads/*' 'refs/tags/*' > "$source_refs"; then
        echo "::error::Could not inspect current source refs for $repo."
        scan_failures=$((scan_failures + 1))
        continue
      fi
    elif ! GIT_TERMINAL_PROMPT=0 git ls-remote --refs "$source_url" 'refs/heads/*' 'refs/tags/*' > "$source_refs"; then
      echo "::error::Could not inspect current source refs for $repo."
      scan_failures=$((scan_failures + 1))
      continue
    fi

    if ! GIT_ASKPASS="$work/archive-askpass.sh" GIT_TERMINAL_PROMPT=0 git ls-remote --refs "$archive_url" "refs/archive/$repo/heads/*" "refs/archive/$repo/tags/*" > "$archive_refs"; then
      echo "::error::Could not inspect stable archive refs for $repo."
      scan_failures=$((scan_failures + 1))
      continue
    fi

    source_count="$(wc -l < "$source_refs" | tr -d '[:space:]')"
    if (( source_count == 0 )); then
      echo "::error::No source branches or tags were returned for $repo; cannot safely declare it unchanged."
      scan_failures=$((scan_failures + 1))
      continue
    fi

    declare -A archived_refs=()
    while read -r sha ref; do
      [[ -n "$ref" ]] || continue
      archived_refs["$ref"]="$sha"
    done < "$archive_refs"

    repo_changed=false
    while read -r sha source_ref; do
      [[ -n "$source_ref" ]] || continue
      case "$source_ref" in
        refs/heads/*) stable_ref="refs/archive/$repo/heads/${source_ref#refs/heads/}" ;;
        refs/tags/*) stable_ref="refs/archive/$repo/tags/${source_ref#refs/tags/}" ;;
        *) continue ;;
      esac
      if [[ "${archived_refs[$stable_ref]:-}" != "$sha" ]]; then
        repo_changed=true
        break
      fi
    done < "$source_refs"
    unset archived_refs

    if [[ "$repo_changed" == "true" ]]; then
      changed_lookup["$repo"]=true
      changed_repos+=("$repo")
      printf -- '- CHANGED: %s (source refs differ from archive)\n' "$repo" >> "$GITHUB_STEP_SUMMARY"
    else
      printf -- '- UNCHANGED: %s (no clone or snapshot needed)\n' "$repo" >> "$GITHUB_STEP_SUMMARY"
    fi
  done

  if (( scan_failures > 0 )); then
    echo "::endgroup::"
    echo "::error::$scan_failures repository ref check(s) failed. No repositories were cloned or reported unchanged for a complete run."
    exit 1
  fi

  if (( ${#changed_repos[@]} == 0 )); then
    echo "No source changes detected; no clones, pushes or new snapshots created."
    printf '\n- Repositories checked: 27\n- Repositories changed: 0\n- Git clone and snapshot work: skipped (no changes)\n' >> "$GITHUB_STEP_SUMMARY"
    echo "::endgroup::"
    exit 0
  fi

  echo "Changed repositories: ${changed_repos[*]}"
  echo "::endgroup::"
fi

failures=0
succeeded=0
unchanged=0

for repo in "${repos[@]}"; do
  echo "::group::Archiving $repo"
  dir="$work/$repo.git"
  rm -rf "$dir"

  if [[ "$only_changed" == "true" && "${changed_lookup[$repo]:-false}" != "true" ]]; then
    echo "No ref changes for $repo; clone and snapshot skipped."
    unchanged=$((unchanged + 1))
    printf -- '- UNCHANGED: %s (no clone or snapshot created)\n' "$repo" >> "$GITHUB_STEP_SUMMARY"
    echo "::endgroup::"
    continue
  fi

  is_private=false
  if is_private_repo "$repo"; then
    is_private=true
  fi

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

  # Verify the complete cloned object database before publishing refs.
  if ! git -C "$dir" fsck --full --no-reflogs > "$work/fsck-$repo.log" 2>&1; then
    echo "::error::Git object integrity check failed for $repo. No refs were pushed."
    printf -- '- FAILED: %s (git fsck)\n' "$repo" >> "$GITHUB_STEP_SUMMARY"
    failures=$((failures + 1))
    echo "::endgroup::"
    continue
  fi

  expected="$work/$repo.expected-refs"
  : > "$expected"
  while IFS= read -r ref; do
    [[ -n "$ref" ]] || continue
    short="${ref#refs/}"
    sha="$(git -C "$dir" rev-parse "$ref")"
    snapshot_ref="refs/archive/$repo/snapshots/$stamp/$short"
    if [[ "$ref" == refs/heads/* ]]; then
      stable_ref="refs/archive/$repo/heads/${ref#refs/heads/}"
    elif [[ "$ref" == refs/tags/* ]]; then
      stable_ref="refs/archive/$repo/tags/${ref#refs/tags/}"
    else
      continue
    fi
    git -C "$dir" update-ref "$snapshot_ref" "$sha"
    printf '%s %s\n' "$sha" "$stable_ref" >> "$expected"
    printf '%s %s\n' "$sha" "$snapshot_ref" >> "$expected"
  done < <(git -C "$dir" for-each-ref --format='%(refname)' refs/heads refs/tags)

  expected_count="$(wc -l < "$expected" | tr -d '[:space:]')"
  if (( expected_count == 0 )); then
    echo "::error::No source branches or tags were found for $repo. Nothing will be marked backed up."
    printf -- '- FAILED: %s (no source refs)\n' "$repo" >> "$GITHUB_STEP_SUMMARY"
    failures=$((failures + 1))
    echo "::endgroup::"
    continue
  fi

  # Stable refs may advance; this run's timestamped snapshots are never force
  # pushed. Deleted source refs are not pruned from the recovery archive.
  git -C "$dir" remote add archive "https://github.com/conz20/Brightdesk-Archives.git"
  if ! GIT_ASKPASS="$work/archive-askpass.sh" GIT_TERMINAL_PROMPT=0 \
    git -C "$dir" push --quiet archive \
      "+refs/heads/*:refs/archive/$repo/heads/*" \
      "+refs/tags/*:refs/archive/$repo/tags/*" \
      "refs/archive/$repo/snapshots/$stamp/*:refs/archive/$repo/snapshots/$stamp/*"; then
    echo "::error::Archive push failed for $repo. Existing archive refs were not intentionally deleted."
    printf -- '- FAILED: %s (push)\n' "$repo" >> "$GITHUB_STEP_SUMMARY"
    failures=$((failures + 1))
    echo "::endgroup::"
    continue
  fi

  # Verify every ref written by this run by exact name and object SHA. Do not
  # compare total namespace counts: earlier snapshots are intentionally kept.
  actual="$work/$repo.actual-refs"
  if ! GIT_ASKPASS="$work/archive-askpass.sh" GIT_TERMINAL_PROMPT=0 \
    git -C "$dir" ls-remote --refs archive "refs/archive/$repo/*" > "$actual"; then
    echo "::error::Could not read back archived refs for $repo."
    printf -- '- FAILED: %s (remote verification read)\n' "$repo" >> "$GITHUB_STEP_SUMMARY"
    failures=$((failures + 1))
    echo "::endgroup::"
    continue
  fi

  verify_failed=0
  while read -r expected_sha expected_ref; do
    [[ -n "$expected_ref" ]] || continue
    actual_sha="$(awk -v target="$expected_ref" '$2 == target { print $1; exit }' "$actual")"
    if [[ "$actual_sha" != "$expected_sha" ]]; then
      echo "::error::Archived ref verification failed for $repo: $expected_ref"
      verify_failed=1
    fi
  done < "$expected"

  if (( verify_failed > 0 )); then
    printf -- '- FAILED: %s (remote ref SHA mismatch)\n' "$repo" >> "$GITHUB_STEP_SUMMARY"
    failures=$((failures + 1))
    echo "::endgroup::"
    continue
  fi

  printf -- '- OK: %s (%s refs verified by exact SHA)\n' "$repo" "$expected_count" >> "$GITHUB_STEP_SUMMARY"
  succeeded=$((succeeded + 1))
  echo "::endgroup::"
done

{
  echo
  if [[ "$only_changed" == "true" ]]; then
    echo "- Repositories checked for changes: 27"
    echo "- Repositories archived and verified: $succeeded"
    echo "- Unchanged repositories skipped: $unchanged"
  else
    echo "- Repositories archived and verified: $succeeded / 27"
  fi
  echo "- Repositories failed: $failures"
  echo "- Snapshot namespace: $stamp"
} >> "$GITHUB_STEP_SUMMARY"

if (( failures > 0 )); then
  echo "::error::$failures repository backup(s) failed. This run is not a complete portfolio backup."
  exit 1
fi

if [[ "$only_changed" == "true" ]]; then
  echo "All $succeeded changed source repositories were mirrored and every current-run archive ref was verified by exact SHA; $unchanged unchanged repositories were skipped."
else
  echo "All 27 source repositories (13 public and 14 private) were mirrored and every current-run archive ref was verified by exact SHA."
fi
\\t' read -r sha ref; do
      [[ -n "$ref" ]] || continue
      archived_refs["$ref"]="$sha"
    done < "$archive_refs"

    repo_changed=false
    while IFS=stamp="$(date -u +%Y%m%dT%H%M%SZ)-run${GITHUB_RUN_ID}-attempt${GITHUB_RUN_ATTEMPT}"
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

  # Verify the complete cloned object database before publishing refs.
  if ! git -C "$dir" fsck --full --no-reflogs > "$work/fsck-$repo.log" 2>&1; then
    echo "::error::Git object integrity check failed for $repo. No refs were pushed."
    printf -- '- FAILED: %s (git fsck)\n' "$repo" >> "$GITHUB_STEP_SUMMARY"
    failures=$((failures + 1))
    echo "::endgroup::"
    continue
  fi

  expected="$work/$repo.expected-refs"
  : > "$expected"
  while IFS= read -r ref; do
    [[ -n "$ref" ]] || continue
    short="${ref#refs/}"
    sha="$(git -C "$dir" rev-parse "$ref")"
    snapshot_ref="refs/archive/$repo/snapshots/$stamp/$short"
    if [[ "$ref" == refs/heads/* ]]; then
      stable_ref="refs/archive/$repo/heads/${ref#refs/heads/}"
    elif [[ "$ref" == refs/tags/* ]]; then
      stable_ref="refs/archive/$repo/tags/${ref#refs/tags/}"
    else
      continue
    fi
    git -C "$dir" update-ref "$snapshot_ref" "$sha"
    printf '%s %s\n' "$sha" "$stable_ref" >> "$expected"
    printf '%s %s\n' "$sha" "$snapshot_ref" >> "$expected"
  done < <(git -C "$dir" for-each-ref --format='%(refname)' refs/heads refs/tags)

  expected_count="$(wc -l < "$expected" | tr -d '[:space:]')"
  if (( expected_count == 0 )); then
    echo "::error::No source branches or tags were found for $repo. Nothing will be marked backed up."
    printf -- '- FAILED: %s (no source refs)\n' "$repo" >> "$GITHUB_STEP_SUMMARY"
    failures=$((failures + 1))
    echo "::endgroup::"
    continue
  fi

  # Stable refs may advance; this run's timestamped snapshots are never force
  # pushed. Deleted source refs are not pruned from the recovery archive.
  git -C "$dir" remote add archive "https://github.com/conz20/Brightdesk-Archives.git"
  if ! GIT_ASKPASS="$work/archive-askpass.sh" GIT_TERMINAL_PROMPT=0 \
    git -C "$dir" push --quiet archive \
      "+refs/heads/*:refs/archive/$repo/heads/*" \
      "+refs/tags/*:refs/archive/$repo/tags/*" \
      "refs/archive/$repo/snapshots/$stamp/*:refs/archive/$repo/snapshots/$stamp/*"; then
    echo "::error::Archive push failed for $repo. Existing archive refs were not intentionally deleted."
    printf -- '- FAILED: %s (push)\n' "$repo" >> "$GITHUB_STEP_SUMMARY"
    failures=$((failures + 1))
    echo "::endgroup::"
    continue
  fi

  # Verify every ref written by this run by exact name and object SHA. Do not
  # compare total namespace counts: earlier snapshots are intentionally kept.
  actual="$work/$repo.actual-refs"
  if ! GIT_ASKPASS="$work/archive-askpass.sh" GIT_TERMINAL_PROMPT=0 \
    git -C "$dir" ls-remote --refs archive "refs/archive/$repo/*" > "$actual"; then
    echo "::error::Could not read back archived refs for $repo."
    printf -- '- FAILED: %s (remote verification read)\n' "$repo" >> "$GITHUB_STEP_SUMMARY"
    failures=$((failures + 1))
    echo "::endgroup::"
    continue
  fi

  verify_failed=0
  while read -r expected_sha expected_ref; do
    [[ -n "$expected_ref" ]] || continue
    actual_sha="$(awk -v target="$expected_ref" '$2 == target { print $1; exit }' "$actual")"
    if [[ "$actual_sha" != "$expected_sha" ]]; then
      echo "::error::Archived ref verification failed for $repo: $expected_ref"
      verify_failed=1
    fi
  done < "$expected"

  if (( verify_failed > 0 )); then
    printf -- '- FAILED: %s (remote ref SHA mismatch)\n' "$repo" >> "$GITHUB_STEP_SUMMARY"
    failures=$((failures + 1))
    echo "::endgroup::"
    continue
  fi

  printf -- '- OK: %s (%s refs verified by exact SHA)\n' "$repo" "$expected_count" >> "$GITHUB_STEP_SUMMARY"
  succeeded=$((succeeded + 1))
  echo "::endgroup::"
done

{
  echo
  echo "- Repositories passed: $succeeded / 27"
  echo "- Repositories failed: $failures"
  echo "- Snapshot namespace: $stamp"
} >> "$GITHUB_STEP_SUMMARY"

if (( failures > 0 )); then
  echo "::error::$failures repository backup(s) failed. This run is not a complete portfolio backup."
  exit 1
fi

echo "All 27 source repositories (13 public and 14 private) were mirrored and every current-run archive ref was verified by exact SHA."
\\t' read -r sha source_ref; do
      [[ -n "$source_ref" ]] || continue
      case "$source_ref" in
        refs/heads/*) stable_ref="refs/archive/$repo/heads/${source_ref#refs/heads/}" ;;
        refs/tags/*) stable_ref="refs/archive/$repo/tags/${source_ref#refs/tags/}" ;;
        *) continue ;;
      esac
      if [[ "${archived_refs[$stable_ref]:-}" != "$sha" ]]; then
        repo_changed=true
        break
      fi
    done < "$source_refs"
    unset archived_refs

    if [[ "$repo_changed" == "true" ]]; then
      changed_lookup["$repo"]=true
      changed_repos+=("$repo")
      printf -- '- CHANGED: %s (source refs differ from archive)\\n' "$repo" >> "$GITHUB_STEP_SUMMARY"
    else
      printf -- '- UNCHANGED: %s (no clone or snapshot needed)\\n' "$repo" >> "$GITHUB_STEP_SUMMARY"
    fi
  done

  if (( scan_failures > 0 )); then
    echo "::endgroup::"
    echo "::error::$scan_failures repository ref check(s) failed. No repositories were cloned or reported unchanged for a complete run."
    exit 1
  fi

  if (( ${#changed_repos[@]} == 0 )); then
    echo "No source changes detected; no clones, pushes or new snapshots created."
    printf '\\n- Repositories checked: 27\\n- Repositories changed: 0\\n- Git clone and snapshot work: skipped (no changes)\\n' >> "$GITHUB_STEP_SUMMARY"
    echo "::endgroup::"
    exit 0
  fi

  echo "Changed repositories: ${changed_repos[*]}"
  echo "::endgroup::"
fi

# Include the workflow run and retry number so concurrent/manual reruns never
# reuse a snapshot namespace. Earlier snapshots remain immutable.
stamp="$(date -u +%Y%m%dT%H%M%SZ)-run${GITHUB_RUN_ID}-attempt${GITHUB_RUN_ATTEMPT}"
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

  # Verify the complete cloned object database before publishing refs.
  if ! git -C "$dir" fsck --full --no-reflogs > "$work/fsck-$repo.log" 2>&1; then
    echo "::error::Git object integrity check failed for $repo. No refs were pushed."
    printf -- '- FAILED: %s (git fsck)\n' "$repo" >> "$GITHUB_STEP_SUMMARY"
    failures=$((failures + 1))
    echo "::endgroup::"
    continue
  fi

  expected="$work/$repo.expected-refs"
  : > "$expected"
  while IFS= read -r ref; do
    [[ -n "$ref" ]] || continue
    short="${ref#refs/}"
    sha="$(git -C "$dir" rev-parse "$ref")"
    snapshot_ref="refs/archive/$repo/snapshots/$stamp/$short"
    if [[ "$ref" == refs/heads/* ]]; then
      stable_ref="refs/archive/$repo/heads/${ref#refs/heads/}"
    elif [[ "$ref" == refs/tags/* ]]; then
      stable_ref="refs/archive/$repo/tags/${ref#refs/tags/}"
    else
      continue
    fi
    git -C "$dir" update-ref "$snapshot_ref" "$sha"
    printf '%s %s\n' "$sha" "$stable_ref" >> "$expected"
    printf '%s %s\n' "$sha" "$snapshot_ref" >> "$expected"
  done < <(git -C "$dir" for-each-ref --format='%(refname)' refs/heads refs/tags)

  expected_count="$(wc -l < "$expected" | tr -d '[:space:]')"
  if (( expected_count == 0 )); then
    echo "::error::No source branches or tags were found for $repo. Nothing will be marked backed up."
    printf -- '- FAILED: %s (no source refs)\n' "$repo" >> "$GITHUB_STEP_SUMMARY"
    failures=$((failures + 1))
    echo "::endgroup::"
    continue
  fi

  # Stable refs may advance; this run's timestamped snapshots are never force
  # pushed. Deleted source refs are not pruned from the recovery archive.
  git -C "$dir" remote add archive "https://github.com/conz20/Brightdesk-Archives.git"
  if ! GIT_ASKPASS="$work/archive-askpass.sh" GIT_TERMINAL_PROMPT=0 \
    git -C "$dir" push --quiet archive \
      "+refs/heads/*:refs/archive/$repo/heads/*" \
      "+refs/tags/*:refs/archive/$repo/tags/*" \
      "refs/archive/$repo/snapshots/$stamp/*:refs/archive/$repo/snapshots/$stamp/*"; then
    echo "::error::Archive push failed for $repo. Existing archive refs were not intentionally deleted."
    printf -- '- FAILED: %s (push)\n' "$repo" >> "$GITHUB_STEP_SUMMARY"
    failures=$((failures + 1))
    echo "::endgroup::"
    continue
  fi

  # Verify every ref written by this run by exact name and object SHA. Do not
  # compare total namespace counts: earlier snapshots are intentionally kept.
  actual="$work/$repo.actual-refs"
  if ! GIT_ASKPASS="$work/archive-askpass.sh" GIT_TERMINAL_PROMPT=0 \
    git -C "$dir" ls-remote --refs archive "refs/archive/$repo/*" > "$actual"; then
    echo "::error::Could not read back archived refs for $repo."
    printf -- '- FAILED: %s (remote verification read)\n' "$repo" >> "$GITHUB_STEP_SUMMARY"
    failures=$((failures + 1))
    echo "::endgroup::"
    continue
  fi

  verify_failed=0
  while read -r expected_sha expected_ref; do
    [[ -n "$expected_ref" ]] || continue
    actual_sha="$(awk -v target="$expected_ref" '$2 == target { print $1; exit }' "$actual")"
    if [[ "$actual_sha" != "$expected_sha" ]]; then
      echo "::error::Archived ref verification failed for $repo: $expected_ref"
      verify_failed=1
    fi
  done < "$expected"

  if (( verify_failed > 0 )); then
    printf -- '- FAILED: %s (remote ref SHA mismatch)\n' "$repo" >> "$GITHUB_STEP_SUMMARY"
    failures=$((failures + 1))
    echo "::endgroup::"
    continue
  fi

  printf -- '- OK: %s (%s refs verified by exact SHA)\n' "$repo" "$expected_count" >> "$GITHUB_STEP_SUMMARY"
  succeeded=$((succeeded + 1))
  echo "::endgroup::"
done

{
  echo
  echo "- Repositories passed: $succeeded / 27"
  echo "- Repositories failed: $failures"
  echo "- Snapshot namespace: $stamp"
} >> "$GITHUB_STEP_SUMMARY"

if (( failures > 0 )); then
  echo "::error::$failures repository backup(s) failed. This run is not a complete portfolio backup."
  exit 1
fi

echo "All 27 source repositories (13 public and 14 private) were mirrored and every current-run archive ref was verified by exact SHA."
