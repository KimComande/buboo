import { getAdminDashboard } from "@/appLogic.js";
import { readDb } from "@/store.js";
import { isAdminAuthenticated } from "@/http/adminAuth.js";
import { errorJson, json } from "@/http/apiResponse.js";

export const runtime = "nodejs";

export async function GET(request, context) {
  if (!isAdminAuthenticated(request)) return json({ error: "admin_auth_required" }, 401);
  try {
    const { slug } = await context.params;
    const db = await readDb();
    return json(getAdminDashboard(db, slug));
  } catch (error) {
    return errorJson(error);
  }
}
