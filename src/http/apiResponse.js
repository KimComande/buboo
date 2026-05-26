import { AppError } from "../appLogic.js";

export async function readJson(request) {
  const text = await request.text();
  if (!text) return {};
  return JSON.parse(text);
}

export function json(payload, status = 200, headers = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...headers,
    },
  });
}

export function errorJson(error) {
  if (error instanceof AppError) {
    return json({ error: error.reason }, error.statusCode);
  }
  console.error(error);
  return json({ error: "internal_server_error" }, 500);
}
