import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

test("the built portal keeps the platform document-upload contract", async () => {
  const [uploader, config, clientFiles] = await Promise.all([
    readFile(
      new URL("../app/components/document-upload.tsx", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../next.config.ts", import.meta.url), "utf8"),
    readdir(new URL("../dist/client/", import.meta.url), { recursive: true }),
  ]);

  assert.match(uploader, /const maximumFileBytes = 10 \* 1024 \* 1024;/);
  assert.match(config, /bodySizeLimit:\s*"12mb"/);

  // Vinext 0.2 tree-shakes the Server Action runtime (and its old
  // __MAX_ACTION_BODY_SIZE global) when this app has no Server Actions. The
  // browser upload is a direct API request, so assert the emitted client
  // chunk instead of coupling this contract to that implementation detail.
  const uploadBundle = clientFiles.find((file) =>
    /(?:^|[\\/])document-upload-[^\\/]+\.js$/.test(file),
  );
  assert.ok(uploadBundle, "the document-upload client bundle was not built");
  const clientDirectory = new URL("../dist/client/", import.meta.url);
  const builtUploader = await readFile(
    new URL(uploadBundle.replaceAll("\\", "/"), clientDirectory),
    "utf8",
  );
  assert.match(
    builtUploader,
    /10485760/,
    "the production client must retain the 10 MiB document guard",
  );
});
