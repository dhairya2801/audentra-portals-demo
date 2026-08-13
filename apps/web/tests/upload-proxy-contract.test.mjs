import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the built portal proxy carries the platform document-upload contract", async () => {
  const [server, uploader] = await Promise.all([
    readFile(new URL("../dist/server/index.js", import.meta.url), "utf8"),
    readFile(
      new URL("../app/components/document-upload.tsx", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(uploader, /const maximumFileBytes = 10 \* 1024 \* 1024;/);
  assert.match(
    server,
    /var __MAX_ACTION_BODY_SIZE = 12582912;/,
    "Vinext must allow a 10 MiB file plus multipart framing through the API rewrite",
  );
});
