import { updateEventSettings } from "@/appLogic.js";
import { mutateDb } from "@/store.js";
import { isAdminAuthenticated } from "@/http/adminAuth.js";
import { errorJson, json, readJson } from "@/http/apiResponse.js";

export const runtime = "nodejs";

export async function POST(request, context) {
  if (!isAdminAuthenticated(request)) return json({ error: "admin_auth_required" }, 401);
  try {
    const { slug } = await context.params;
    const body = await readJson(request);
    const event = await mutateDb((db) => updateEventSettings(db, slug, body));
    return json({ event });
  } catch (error) {
    return errorJson(error);
  }
}
