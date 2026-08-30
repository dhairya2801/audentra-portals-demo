import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("Morning Brew external context uses the credentialed asynchronous platform boundary", async () => {
  const [client, contracts] = await Promise.all([
    source("../app/lib/api-client.ts"),
    source("../../../packages/contracts/src/index.ts"),
  ]);

  assert.match(client, /export function getStaffMorningBrewExternalContext/);
  assert.match(client, /export function triggerStaffMorningBrewExternalContext/);
  assert.match(client, /"\/v1\/staff\/morning-brew\/external-context"/);
  assert.match(client, /method: "GET"/);
  assert.match(client, /method: "POST"/);
  assert.match(client, /headers: staffHeaders/);
  assert.match(client, /notifyStudentRecordChanged: false/);
  assert.doesNotMatch(client, /NEXT_PUBLIC_[A-Z_]*(SEARCH|YOU|API_KEY)/);

  assert.match(contracts, /export type StaffMorningBrewExternalContextStatus/);
  assert.match(contracts, /"pending"/);
  assert.match(contracts, /"running"/);
  assert.match(contracts, /"unavailable"/);
  assert.match(contracts, /export interface StaffMorningBrewExternalContext/);
  assert.match(contracts, /provider: "you\.com" \| null/);
  assert.match(contracts, /results: StaffWebSearchResult\[\]/);
  assert.match(contracts, /thumbnailUrl: string \| null/);
  assert.match(contracts, /stale: boolean/);
});

test("Morning Brew renders a compact external-news rail with a worker-backed refresh action", async () => {
  const [morningBrew, dashboard, context, sources, styles] = await Promise.all([
    source("../app/staff/morning-brew/morning-brew.tsx"),
    source("../app/staff/morning-brew/dashboard.tsx"),
    source("../app/staff/morning-brew/web-search.tsx"),
    source("../app/components/staff-web-sources.tsx"),
    source("../app/globals.css"),
  ]);

  assert.match(morningBrew, /externalContext=\{<MorningBrewExternalContext\s*\/>\}/);
  assert.match(morningBrew, /hidden=\{mode !== "briefing" \|\| detail !== null\}/);
  assert.match(morningBrew, /externalContext=\{/);
  assert.match(morningBrew, /externalContext=\{[\s\S]*MorningBrewExternalContext/);
  assert.match(dashboard, /externalContext/);
  const coverage = dashboard.indexOf('<section className="brew-coverage"');
  const externalContextSlot = dashboard.indexOf("externalContext", coverage);
  const colophon = dashboard.indexOf('<footer className="brew-colophon">');
  assert.ok(coverage >= 0, "the dashboard must retain its coverage section");
  assert.ok(externalContextSlot >= 0, "the dashboard must render the external-news slot");
  assert.ok(colophon >= 0, "the dashboard must retain its edition colophon");
  assert.ok(
    externalContextSlot < colophon,
    "Higher Ed News must render before the final edition colophon",
  );
  assert.match(context, /triggerStaffMorningBrewExternalContext/);
  assert.match(context, /getStaffMorningBrewExternalContext/);
  assert.match(context, /POLL_INTERVAL_MS/);
  assert.match(context, /context\.status === "pending"/);
  assert.match(context, /context\.status === "running"/);
  assert.match(context, /Higher Ed News/);
  assert.match(context, /Curated for you/);
  assert.match(context, /Refresh Higher Ed News/);
  assert.match(context, /variant="rail"/);
  assert.doesNotMatch(context, /<form/);
  assert.doesNotMatch(context, /type="search"/);
  assert.doesNotMatch(context, /Search the web/);
  assert.doesNotMatch(context, /onSubmit/);

  assert.match(sources, /variant = "stack"/);
  assert.match(sources, /staff-web-sources--rail/);
  assert.match(sources, /staff-web-source__media/);
  assert.match(sources, /safeExternalThumbnailUrl/);
  assert.match(sources, /referrerPolicy="no-referrer"/);
  assert.match(sources, /loading="lazy"/);
  assert.match(sources, /target="_blank"/);
  assert.match(sources, /rel="noopener noreferrer"/);
  assert.match(sources, /safeExternalWebUrl/);
  assert.doesNotMatch(`${context}\n${sources}`, /dangerouslySetInnerHTML/);
  assert.match(styles, /\.brew-news-rail/);
  assert.match(styles, /\.brew-news-rail__refresh/);
  assert.match(styles, /\.staff-web-sources--rail/);
  assert.match(styles, /\.staff-web-source__thumbnail/);
  assert.match(styles, /grid-template-columns: 4\.45rem minmax\(0, 1fr\)/);
  assert.match(styles, /scroll-snap-type: x proximity/);
});

test("Staff Edward renders web source blocks as escaped text and safe links", async () => {
  const [assistant, brewEdward, sources] = await Promise.all([
    source("../app/components/staff-edward-assistant.tsx"),
    source("../app/staff/morning-brew/edward-panel.tsx"),
    source("../app/components/staff-web-sources.tsx"),
  ]);

  for (const surface of [assistant, brewEdward]) {
    assert.match(surface, /block\.type === "web_sources"/);
    assert.match(surface, /<StaffWebSourceList/);
    assert.doesNotMatch(surface, /dangerouslySetInnerHTML/);
  }
  assert.doesNotMatch(sources, /dangerouslySetInnerHTML/);
});

test("external result links reject non-web protocols", async () => {
  const utilities = await source("../app/lib/staff-web-search.ts");
  const compiled = ts.transpileModule(utilities, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`;
  const { safeExternalThumbnailUrl, safeExternalWebUrl, webPublishedDate } = await import(moduleUrl);

  assert.equal(safeExternalWebUrl("javascript:alert(1)"), null);
  assert.equal(safeExternalWebUrl("data:text/html,unsafe"), null);
  assert.equal(safeExternalWebUrl("not a URL"), null);
  assert.equal(safeExternalWebUrl("https://example.edu/story"), "https://example.edu/story");
  assert.equal(safeExternalThumbnailUrl("javascript:alert(1)"), null);
  assert.equal(safeExternalThumbnailUrl("http://example.edu/image.jpg"), null);
  assert.equal(safeExternalThumbnailUrl("https://example.edu/image.jpg"), "https://example.edu/image.jpg");
  assert.equal(webPublishedDate("not-a-date"), null);
  assert.equal(webPublishedDate(null), null);
});

test("Playwright external-context acceptance stays strict UI-only", async () => {
  const browserJourney = await source(
    "../../../tools/browser-e2e/specs/staff-web-search-ui.spec.ts",
  );

  assert.match(browserJourney, /page\.goto\("\/staff"\)/);
  assert.match(browserJourney, /getByRole\("tab", \{ name: "Create account" \}\)/);
  assert.match(
    browserJourney,
    /EXTERNAL_CONTEXT_PATH = "\/v1\/staff\/morning-brew\/external-context"/,
  );
  assert.match(browserJourney, /page\.on\("request"/);
  assert.match(browserJourney, /Curated for you/);
  assert.match(browserJourney, /data-external-context-status/);
  assert.match(browserJourney, /before completing Morning Brew setup/);
  assert.match(browserJourney, /Refresh Higher Ed News/);
  assert.match(browserJourney, /second external-context trigger/);
  assert.match(browserJourney, /E2E_REQUIRE_WEB_SEARCH_READY/);
  assert.doesNotMatch(browserJourney, /Search the web/);
  assert.doesNotMatch(browserJourney, /PUBLIC_MORNING_BREW_QUERY/);

  assert.doesNotMatch(browserJourney, /page\.request\b/);
  assert.doesNotMatch(browserJourney, /\bAPIRequestContext\b/);
  assert.doesNotMatch(browserJourney, /\.route\s*\(/);
  assert.doesNotMatch(browserJourney, /\brouteFromHAR\b/);
  assert.doesNotMatch(browserJourney, /\baddCookies\b/);
  assert.doesNotMatch(browserJourney, /\bstorageState\b/);
  assert.doesNotMatch(browserJourney, /\blocalStorage\b/);
  assert.doesNotMatch(browserJourney, /\bsessionStorage\b/);
  assert.doesNotMatch(browserJourney, /demo-session/);
  assert.doesNotMatch(browserJourney, /signInDemoStaff/);
  assert.doesNotMatch(browserJourney, /process\.env\.(?:YDC|YOU|YOU_COM)/);
});
