import { readPublicEvent } from "@/store.js";
import { errorJson, json } from "@/http/apiResponse.js";

export const runtime = "nodejs";

export async function GET(_request, context) {
  try {
    const { slug } = await context.params;
    return json(await readPublicEvent(slug));
  } catch (error) {
    return errorJson(error);
  }
}
