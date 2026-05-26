import { viewContact } from "@/appLogic.js";
import { mutateDb } from "@/store.js";
import { errorJson, json, readJson } from "@/http/apiResponse.js";

export const runtime = "nodejs";

export async function POST(request, context) {
  try {
    const { slug } = await context.params;
    const body = await readJson(request);
    const target = await mutateDb((db) => viewContact(db, slug, {
      ...body,
      ipAddress: request.headers.get("x-forwarded-for") ?? "",
      userAgent: request.headers.get("user-agent") ?? "",
    }));
    return json(target);
  } catch (error) {
    return errorJson(error);
  }
}
