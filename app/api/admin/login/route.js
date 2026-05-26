import { configuredAdminPath, createAdminCookie, verifyAdminPassword } from "@/http/adminAuth.js";
import { json, readJson } from "@/http/apiResponse.js";

export const runtime = "nodejs";

export async function POST(request) {
  const body = await readJson(request);
  if (!verifyAdminPassword(body.password)) {
    return json({ error: "invalid_admin_password" }, 401);
  }

  return json({ ok: true, adminPath: configuredAdminPath() }, 200, {
    "set-cookie": createAdminCookie(),
  });
}
