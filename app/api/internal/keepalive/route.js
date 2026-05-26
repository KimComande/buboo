import { activeStoreName, keepAlive } from "@/store.js";
import { isBearerAuthorized } from "@/http/adminAuth.js";
import { errorJson, json } from "@/http/apiResponse.js";

export const runtime = "nodejs";

export async function GET(request) {
  if (!isBearerAuthorized(request)) return json({ error: "unauthorized" }, 401);

  try {
    if (activeStoreName() !== "postgres") {
      return json({ ok: true, store: "json", keptAlive: false });
    }

    const result = await keepAlive();
    return json({
      ok: true,
      store: "postgres",
      keptAlive: true,
      checkedAt: result.checkedAt,
    });
  } catch (error) {
    return errorJson(error);
  }
}
