import { getPublicEvent } from "@/appLogic.js";
import { readDb } from "@/store.js";
import { errorJson, json } from "@/http/apiResponse.js";

export const runtime = "nodejs";

export async function GET(_request, context) {
  try {
    const { slug } = await context.params;
    const db = await readDb();
    return json(getPublicEvent(db, slug));
  } catch (error) {
    return errorJson(error);
  }
}
