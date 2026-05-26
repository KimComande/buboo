import { submitSurveyToStore } from "@/store.js";
import { errorJson, json, readJson } from "@/http/apiResponse.js";

export const runtime = "nodejs";

export async function POST(request, context) {
  try {
    const { slug } = await context.params;
    const body = await readJson(request);
    const submission = await submitSurveyToStore(slug, body);
    return json({ submission });
  } catch (error) {
    return errorJson(error);
  }
}
