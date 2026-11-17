import { NextResponse } from "next/server";
import { badRequest } from "./api-helpers";

type JsonBodyResult = { data: unknown; response?: never } | { data?: never; response: Response };

/** Read JSON once. Optional byte limits are enforced before JSON parsing. */
export async function readJsonBody(request: Request, maxBytes?: number): Promise<JsonBodyResult> {
  const tooLarge = () => ({ response: NextResponse.json({ error: "The request body is too large." }, { status: 413 }) });
  try {
    if (maxBytes === undefined) return { data: await request.json() };
    if (Number(request.headers.get("content-length")) > maxBytes) return tooLarge();
    const reader = request.body?.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    if (reader) {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > maxBytes) {
            await reader.cancel();
            return tooLarge();
          }
          chunks.push(value);
        }
      } finally { reader.releaseLock(); }
    }
    return { data: JSON.parse(Buffer.concat(chunks).toString("utf8")) };
  } catch {
    return { response: badRequest("The request body is not valid JSON.") };
  }
}
