import { updateMember } from "@/appLogic.js";
import { mutateDb } from "@/store.js";
import { isAdminAuthenticated } from "@/http/adminAuth.js";
import { errorJson, json, readJson } from "@/http/apiResponse.js";

export const runtime = "nodejs";

export async function POST(request, context) {
  if (!isAdminAuthenticated(request)) return json({ error: "admin_auth_required" }, 401);
  try {
    const { memberId } = await context.params;
    const body = await readJson(request);
    const member = await mutateDb((db) => updateMember(db, memberId, body));
    return json({ member });
  } catch (error) {
    return errorJson(error);
  }
}
