import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import { loadLocalEnv } from "../../src/config/env.js";

test("loadLocalEnv reads dotenv files without overwriting existing env values", async () => {
  const filePath = path.join(process.cwd(), "_codex_runtime", `env-test-${Date.now()}.env`);
  const previousExisting = process.env.EXISTING_SECRET;
  const previousNew = process.env.NEW_SECRET;
  process.env.EXISTING_SECRET = "already-set";
  delete process.env.NEW_SECRET;

  try {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, [
      "# ignored",
      "EXISTING_SECRET=file-value",
      "NEW_SECRET=saved-value",
      "INVALID_LINE",
      "",
    ].join("\n"), "utf8");

    const result = loadLocalEnv(filePath);

    assert.deepEqual(result, {
      loaded: true,
      keys: ["EXISTING_SECRET", "NEW_SECRET"],
    });
    assert.equal(process.env.EXISTING_SECRET, "already-set");
    assert.equal(process.env.NEW_SECRET, "saved-value");
    assert.equal(JSON.stringify(result).includes("saved-value"), false);
  } finally {
    if (previousExisting === undefined) {
      delete process.env.EXISTING_SECRET;
    } else {
      process.env.EXISTING_SECRET = previousExisting;
    }
    if (previousNew === undefined) {
      delete process.env.NEW_SECRET;
    } else {
      process.env.NEW_SECRET = previousNew;
    }
    await fs.rm(filePath, { force: true });
  }
});

test("loadLocalEnv returns an empty result when the file is missing", () => {
  const result = loadLocalEnv(path.join(process.cwd(), "_codex_runtime", "missing.env"));

  assert.deepEqual(result, { loaded: false, keys: [] });
});
