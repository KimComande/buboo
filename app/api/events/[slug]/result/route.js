import { getParticipantResultFromStore } from "@/store.js";
import { errorJson, json, readJson } from "@/http/apiResponse.js";

export const runtime = "nodejs";

export async function POST(request, context) {
  try {
    const { slug } = await context.params;
    const body = await readJson(request);
    return json(await getParticipantResultFromStore(slug, body));
  } catch (error) {
    return errorJson(error);
  }
}
