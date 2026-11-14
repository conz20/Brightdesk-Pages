import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const workflowPath = fileURLToPath(
  new URL("../.github/workflows/desktop-installers.yml", import.meta.url),
);
const workflow = await readFile(workflowPath, "utf8");

test("Pages installer workflow uses main and version-tag push filters", () => {
  const pushStart = workflow.indexOf("\n  push:\n");
  const permissionsStart = workflow.indexOf("\npermissions:\n", pushStart);
  const push = workflow.slice(pushStart, permissionsStart);
  assert.match(push, /branches: \[main\]/);
  assert.match(push, /tags: \['v\*'\]/);
  assert.doesNotMatch(workflow, /workflow_dispatch:/);
});

test("Pages installer builds use only private native platform runners", () => {
  assert.match(workflow, /runner: \["self-hosted", "Windows", "X64"\]/);
  assert.match(workflow, /runner: \["self-hosted", "macOS", "ARM64"\]/);
  assert.match(workflow, /runner: \["self-hosted", "Linux", "X64"\]/);
  assert.doesNotMatch(workflow, /windows-latest|macos-latest|ubuntu-latest/);
  assert.match(workflow, /github\.event\.pull_request\.head\.repo\.full_name == github\.repository/);
});

test("Pages release assets attach to a draft and publish only after all three platforms pass", () => {
  const prepare = workflow.slice(workflow.indexOf("  prepare-release:"), workflow.indexOf("  release-assets:"));
  const assets = workflow.slice(workflow.indexOf("  release-assets:"), workflow.indexOf("  publish-release:"));
  const publish = workflow.slice(workflow.indexOf("  publish-release:"));
  assert.ok(prepare.includes('EXPECTED_TAG="v$VERSION"'));
  assert.ok(prepare.includes("draft: true"));
  assert.match(assets, /release\/apps\/pages\/\*\*/);
  assert.ok(assets.includes("fail_on_unmatched_files: true"));
  assert.ok(assets.includes("draft: true"));
  assert.ok(publish.includes("needs: release-assets"));
  assert.ok(publish.includes("draft: false"));
  assert.doesNotMatch(workflow, /actions\/(?:upload|download)-artifact/);
  assert.ok(workflow.includes("softprops/action-gh-release@8a0cd651e5b2365bd640854a3fa5dfc70e4875f3 # v3.0.4"));
});
