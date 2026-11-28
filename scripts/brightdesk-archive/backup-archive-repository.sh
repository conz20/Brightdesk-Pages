#!/usr/bin/env bash
set -Eeuo pipefail

: "${RUNNER_TEMP:?RUNNER_TEMP is required}"
: "${GITHUB_STEP_SUMMARY:?GITHUB_STEP_SUMMARY is required}"
: "${GITHUB_RUN_ID:?GITHUB_RUN_ID is required}"
: "${GITHUB_RUN_ATTEMPT:?GITHUB_RUN_ATTEMPT is required}"
: "${ARCHIVE_WRITE_TOKEN:?BRIGHTDESK_ARCHIVE_WRITE_TOKEN is required}"
: "${ARCHIVE_RECOVERY_WRITE_TOKEN:?BRIGHTDESK_ARCHIVE_RECOVERY_WRITE_TOKEN is required}"

readonly ARCHIVE_URL="https://github.com/conz20/Brightdesk-Archives.git"
readonly RECOVERY_REPOSITORY="conz20/Brightdesk-Release-Tools"
readonly API_BASE="https://api.github.com"
readonly MAX_RELEASE_ASSET_BYTES=2147483647

work="$RUNNER_TEMP/brightdesk-archive-self-recovery"
rm -rf "$work"
mkdir -p "$work"
trap 'rm -rf "$work"' EXIT

# The archive token is only used to read Brightdesk-Archives. The second
# credential only creates a private recovery release in Brightdesk-Release-Tools.
cat > "$work/archive-askpass.sh" <<'ASKPASS'
#!/bin/sh
case "$1" in
  *Username*) printf '%s\n' 'x-access-token' ;;
  *Password*) printf '%s\n' "$ARCHIVE_WRITE_TOKEN" ;;
  *) exit 1 ;;
esac
ASKPASS
chmod 700 "$work/archive-askpass.sh"

stamp="$(date -u +%Y%m%dT%H%M%SZ)-run${GITHUB_RUN_ID}-attempt${GITHUB_RUN_ATTEMPT}"
bundle="$work/Brightdesk-Archives.bundle"
checksum="$work/Brightdesk-Archives.bundle.sha256"
manifest="$work/Brightdesk-Archives.recovery.json"
restore_bundle="$work/Brightdesk-Archives.roundtrip.bundle"
archive_dir="$work/archive.git"
restore_dir="$work/restore.git"

echo "::group::Clone and validate the complete private archive"
if ! GIT_ASKPASS="$work/archive-askpass.sh" GIT_TERMINAL_PROMPT=0 \
  git clone --mirror --quiet "$ARCHIVE_URL" "$archive_dir"; then
  echo "::error::Could not read Brightdesk-Archives. No recovery asset was created."
  exit 1
fi

if ! git -C "$archive_dir" fsck --full --no-reflogs > "$work/archive-fsck.log" 2>&1; then
  echo "::error::Brightdesk-Archives failed git fsck. No recovery asset was created."
  exit 1
fi

git -C "$archive_dir" for-each-ref --format='%(objectname) %(refname)' | sort > "$work/expected-refs.txt"
ref_count="$(wc -l < "$work/expected-refs.txt" | tr -d '[:space:]')"
if (( ref_count == 0 )); then
  echo "::error::Brightdesk-Archives has no refs. No recovery asset was created."
  exit 1
fi

if ! git -C "$archive_dir" bundle create "$bundle" --all; then
  echo "::error::Could not create the complete Git bundle for Brightdesk-Archives."
  exit 1
fi
if ! git bundle verify "$bundle" > "$work/bundle-verify.log" 2>&1; then
  echo "::error::The generated Brightdesk-Archives Git bundle did not pass verification."
  exit 1
fi

bundle_bytes="$(stat -c '%s' "$bundle")"
if (( bundle_bytes <= 0 || bundle_bytes > MAX_RELEASE_ASSET_BYTES )); then
  echo "::error::The archive bundle is empty or exceeds GitHub's under-2-GiB per-file release-asset limit. No asset was uploaded."
  exit 1
fi

bundle_sha256="$(sha256sum "$bundle" | awk '{print $1}')"
printf '%s  %s\n' "$bundle_sha256" "Brightdesk-Archives.bundle" > "$checksum"

git clone --mirror --quiet "$bundle" "$restore_dir"
if ! git -C "$restore_dir" fsck --full --no-reflogs > "$work/local-restore-fsck.log" 2>&1; then
  echo "::error::A local round-trip restore from the generated bundle failed git fsck."
  exit 1
fi
git -C "$restore_dir" for-each-ref --format='%(objectname) %(refname)' | sort > "$work/local-restore-refs.txt"
if ! diff -u "$work/expected-refs.txt" "$work/local-restore-refs.txt" > "$work/local-restore-refs.diff"; then
  echo "::error::The generated bundle did not restore every archive ref at its exact object SHA."
  exit 1
fi
echo "::endgroup::"

jq -n \
  --arg repository "conz20/Brightdesk-Archives" \
  --arg recovery_repository "$RECOVERY_REPOSITORY" \
  --arg created_at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --arg workflow_run_id "$GITHUB_RUN_ID" \
  --arg workflow_run_attempt "$GITHUB_RUN_ATTEMPT" \
  --arg archive_head "$(git -C "$archive_dir" rev-parse HEAD)" \
  --arg bundle_sha256 "$bundle_sha256" \
  --arg bundle_name "Brightdesk-Archives.bundle" \
  --argjson refs "$ref_count" \
  --argjson bytes "$bundle_bytes" \
  '{
    schema_version: 1,
    source_repository: $repository,
    private_recovery_repository: $recovery_repository,
    created_at_utc: $created_at,
    workflow_run_id: $workflow_run_id,
    workflow_run_attempt: $workflow_run_attempt,
    archive_head: $archive_head,
    git_ref_count: $refs,
    bundle_file: $bundle_name,
    bundle_bytes: $bytes,
    bundle_sha256: $bundle_sha256,
    verification: {
      source_git_fsck: "passed",
      bundle_verify: "passed",
      local_restore_git_fsck: "passed",
      local_restore_exact_ref_sha_comparison: "passed"
    },
    exclusions: [
      "Git LFS objects are not contained in a Git bundle and require separate handling.",
      "GitHub issues, pull requests, discussions, settings, Actions logs and release assets are not Git refs and are not contained in this bundle."
    ]
  }' > "$manifest"

release_tag="brightdesk-archive-recovery-$stamp"
release_name="Brightdesk Archive Recovery $stamp"
release_body="Private Git recovery point for conz20/Brightdesk-Archives. Contains the complete Git ref/object bundle, SHA-256 checksum and recovery manifest. The workflow verifies the source object database, bundle, uploaded asset read-back, and a restored mirror with exact ref/SHA comparison. This is GitHub-hosted recovery storage in the private Brightdesk-Release-Tools repository. Git LFS objects and GitHub metadata are tracked separately."

release_payload="$(jq -n \
  --arg tag "$release_tag" \
  --arg name "$release_name" \
  --arg body "$release_body" \
  '{tag_name:$tag, name:$name, body:$body, draft:true, prerelease:true, target_commitish:"main"}')"

echo "::group::Create a private recovery release"
release_response="$(curl --fail-with-body --silent --show-error \
  --request POST "$API_BASE/repos/$RECOVERY_REPOSITORY/releases" \
  --header "Authorization: Bearer $ARCHIVE_RECOVERY_WRITE_TOKEN" \
  --header "Accept: application/vnd.github+json" \
  --header "X-GitHub-Api-Version: 2022-11-28" \
  --header "Content-Type: application/json" \
  --data "$release_payload")"

release_id="$(jq -er '.id' <<< "$release_response")"
upload_url="$(jq -er '.upload_url' <<< "$release_response")"
upload_url="${upload_url%%\{*}"

upload_asset() {
  local file="$1"
  local asset_name="$2"
  local encoded_name
  encoded_name="$(jq -rn --arg name "$asset_name" '$name | @uri')"
  curl --fail-with-body --silent --show-error \
    --request POST "$upload_url?name=$encoded_name" \
    --header "Authorization: Bearer $ARCHIVE_RECOVERY_WRITE_TOKEN" \
    --header "Accept: application/vnd.github+json" \
    --header "X-GitHub-Api-Version: 2022-11-28" \
    --header "Content-Type: application/octet-stream" \
    --data-binary "@$file"
}

bundle_upload="$(upload_asset "$bundle" "Brightdesk-Archives.bundle")"
checksum_upload="$(upload_asset "$checksum" "Brightdesk-Archives.bundle.sha256")"
manifest_upload="$(upload_asset "$manifest" "Brightdesk-Archives.recovery.json")"

bundle_asset_id="$(jq -er '.id' <<< "$bundle_upload")"
checksum_asset_id="$(jq -er '.id' <<< "$checksum_upload")"
manifest_asset_id="$(jq -er '.id' <<< "$manifest_upload")"

# Read the uploaded bundle back from the private release and prove that its
# checksum, bundle structure, object database, refs and SHAs survived upload.
curl --fail-with-body --silent --show-error --location \
  --header "Authorization: Bearer $ARCHIVE_RECOVERY_WRITE_TOKEN" \
  --header "Accept: application/octet-stream" \
  --header "X-GitHub-Api-Version: 2022-11-28" \
  "$API_BASE/repos/$RECOVERY_REPOSITORY/releases/assets/$bundle_asset_id" \
  --output "$restore_bundle"

uploaded_sha256="$(sha256sum "$restore_bundle" | awk '{print $1}')"
if [[ "$uploaded_sha256" != "$bundle_sha256" ]]; then
  echo "::error::Private release asset read-back SHA-256 did not match the original archive bundle."
  exit 1
fi
if ! git bundle verify "$restore_bundle" > "$work/remote-bundle-verify.log" 2>&1; then
  echo "::error::The private release asset read-back is not a valid Git bundle."
  exit 1
fi

rm -rf "$restore_dir"
git clone --mirror --quiet "$restore_bundle" "$restore_dir"
if ! git -C "$restore_dir" fsck --full --no-reflogs > "$work/remote-restore-fsck.log" 2>&1; then
  echo "::error::The Git bundle downloaded from the private recovery release failed git fsck."
  exit 1
fi
git -C "$restore_dir" for-each-ref --format='%(objectname) %(refname)' | sort > "$work/remote-restore-refs.txt"
if ! diff -u "$work/expected-refs.txt" "$work/remote-restore-refs.txt" > "$work/remote-restore-refs.diff"; then
  echo "::error::The private release asset did not restore every archive ref at its exact object SHA."
  exit 1
fi

release_final="$(curl --fail-with-body --silent --show-error \
  --request PATCH "$API_BASE/repos/$RECOVERY_REPOSITORY/releases/$release_id" \
  --header "Authorization: Bearer $ARCHIVE_RECOVERY_WRITE_TOKEN" \
  --header "Accept: application/vnd.github+json" \
  --header "X-GitHub-Api-Version: 2022-11-28" \
  --header "Content-Type: application/json" \
  --data '{"draft":false,"prerelease":true}')"

if [[ "$(jq -r '.draft' <<< "$release_final")" != "false" ]]; then
  echo "::error::The verified private recovery release could not be published."
  exit 1
fi
echo "::endgroup::"

{
  echo "## Brightdesk archive self-recovery"
  echo
  echo "- Private destination: `$RECOVERY_REPOSITORY`"
  echo "- Recovery release tag: `$release_tag`"
  echo "- Git refs restored and SHA-verified: $ref_count"
  echo "- Bundle size: $bundle_bytes bytes"
  echo "- Bundle SHA-256: `$bundle_sha256`"
  echo "- Uploaded asset IDs: bundle $bundle_asset_id; checksum $checksum_asset_id; manifest $manifest_asset_id"
  echo "- Uploaded bundle read-back: **passed**"
  echo "- Remote bundle verification and exact-ref restore: **passed**"
  echo "- Release status: published as a private prerelease"
  echo
  echo "Git LFS objects and GitHub metadata remain separate backup work."
} >> "$GITHUB_STEP_SUMMARY"

echo "Brightdesk-Archives has a verified private GitHub recovery copy in Brightdesk-Release-Tools."
