import { existsSync, readFileSync } from "node:fs";

export function loadLocalEnv(filePath = ".env.local") {
  if (!existsSync(filePath)) return { loaded: false, keys: [] };

  const keys = [];
  const lines = readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const index = trimmed.indexOf("=");
    if (index <= 0) continue;

    const key = trimmed.slice(0, index).trim();
    const value = unquoteEnvValue(trimmed.slice(index + 1).trim());
    if (process.env[key] === undefined) process.env[key] = value;
    keys.push(key);
  }

  return { loaded: true, keys };
}

function unquoteEnvValue(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}
