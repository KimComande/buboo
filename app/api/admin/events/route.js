import { createEvent } from "@/appLogic.js";
import { mutateDb } from "@/store.js";
import { isAdminAuthenticated } from "@/http/adminAuth.js";
import { errorJson, json, readJson } from "@/http/apiResponse.js";

export const runtime = "nodejs";

export async function POST(request) {
  if (!isAdminAuthenticated(request)) return json({ error: "admin_auth_required" }, 401);
  try {
    const body = await readJson(request);
    const event = await mutateDb((db) => createEvent(db, body));
    return json({ event });
  } catch (error) {
    return errorJson(error);
  }
}
