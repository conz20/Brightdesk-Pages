import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const read = (file) => fs.readFileSync(path.join(process.cwd(), file), "utf8");

test("the private Printing snapshot is complete and dependency-free", () => {
  const pkg = JSON.parse(read("src/printing-package/package.json"));
  const source = JSON.parse(read("src/printing-package/UPSTREAM.json"));
  assert.equal(pkg.name, "@brightdesk/printing");
  assert.equal(pkg.version, "0.1.0");
  assert.deepEqual(pkg.dependencies || {}, {});
  assert.equal(source.sourceRepository, "conz20/Brightdesk-Printing");
  assert.equal(source.sourceCommit, "70d41095616c6d1cd3473c0ad73a6ecb5a596c05");
  for (const file of [
    "index.mjs", "index.d.ts", "src/electron-print-adapter.mjs",
    "src/printing-error.mjs", "src/validate-print-request.mjs",
    "src/ipp-printer-discovery.mjs", "src/printer-settings.mjs",
    "src/printer-capabilities.mjs",
  ]) assert.ok(fs.statSync(path.join(process.cwd(), "src/printing-package", file)).isFile(), file);
});

test("the Pages workspace shows the shared print actions", () => {
  const html = read("src/index.html");
  const app = read("src/app.js");
  assert.match(html, /id="print-button"/);
  assert.match(html, /id="printer-settings-button"/);
  assert.match(app, /window\.brightdesk\.printing\.print\(\{ printBackground: true \}\)/);
  assert.match(app, /window\.brightdesk\.printing\.openPrinterSettings\(\)/);
});
