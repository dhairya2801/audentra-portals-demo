import test from "node:test";
import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import { Script } from "node:vm";
import ts from "typescript";

const documentUrl = new URL(
  "../public/financial-plan/concept-4-plan-studio.html",
  import.meta.url,
);
const html = await readFile(documentUrl, "utf8");
const source = await readFile(
  new URL("../app/components/financial-plan/routes.ts", import.meta.url),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ES2022,
  },
}).outputText;
const { conceptRoutes, conceptSection, isConceptSection } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`
);

test("financial document keeps executable Concept 4 scripts and editable living rows", () => {
  assert.match(html, /data-living-id=/);
  assert.doesNotMatch(html, /<th>Cash after<\/th>/);
  assert.doesNotMatch(html, /^mountEdward\(/m);
  for (const [, script] of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g))
    assert.doesNotThrow(() => new Script(script));
});
test("the original logo and all six campus images ship with the document", async () => {
  await access(new URL("assets/audentra-logo.png", documentUrl));
  for (const name of [
    "housing-hall",
    "housing-room",
    "housing-suite",
    "dining-hall",
    "dining-meal",
    "dining-cafe",
  ]) {
    await access(new URL(`assets/img/concept4-${name}.png`, documentUrl));
  }
});
test("all concept sections round-trip through student and parent URLs", () => {
  for (const [section, route] of Object.entries(conceptRoutes)) {
    const [path, hash] = route.split("#");
    assert.equal(conceptSection(path, hash), section);
    assert.equal(conceptSection(`/parent${path}`, hash), section);
  }
  assert.equal(conceptSection("/financials", "#aid"), "aid");
  assert.equal(isConceptSection("__proto__"), false);
  assert.equal(isConceptSection("https://example.com"), false);
});
