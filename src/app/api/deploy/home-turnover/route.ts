import { timingSafeEqual } from "node:crypto";
import { revalidatePath } from "next/cache";
import { TTS_BUILD_SHA } from "@/lib/build-stamp";

export const dynamic = "force-dynamic";

// Deployment-only invalidation. Ordinary homepage traffic remains statically cached.
export async function POST(request: Request) {
  const secret = process.env.HOME_DEPLOY_TOKEN;
  const supplied = request.headers.get("authorization") ?? "";
  const expected = Buffer.from(`Bearer ${secret}`);
  const suppliedBytes = Buffer.from(supplied);
  if (!secret || suppliedBytes.length !== expected.length ||
      !timingSafeEqual(suppliedBytes, expected)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  if (!body || typeof body.sha !== "string" || !/^[a-f0-9]{40}$/.test(body.sha) ||
      body.sha.slice(0, 12) !== TTS_BUILD_SHA) {
    return Response.json({ error: "Deployment identity mismatch", actual: TTS_BUILD_SHA }, { status: 409 });
  }
  revalidatePath("/");
  return Response.json({ revalidated: "/", build: TTS_BUILD_SHA });
}
