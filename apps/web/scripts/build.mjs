import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const command = process.argv[2] ?? "build";
const cli = resolve(
  scriptDirectory,
  "../node_modules/vinext/dist/cli.js",
);
const result = spawnSync(process.execPath, [cli, command], {
  cwd: resolve(scriptDirectory, ".."),
  env: {
    ...process.env,
    WRANGLER_LOG_PATH: ".wrangler/wrangler.log",
    ...(command === "start" ? { WRANGLER_WRITE_LOGS: "false" } : {}),
  },
  stdio: "inherit",
  windowsHide: true,
});

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
