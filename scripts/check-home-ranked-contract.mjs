import { readFile } from "node:fs/promises";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const rankedRoute = await readFile("src/app/api/home/ranked/route.ts", "utf8");
const homeDeferredSections = await readFile("src/components/home-deferred-sections.tsx", "utf8");

assert(
  rankedRoute.includes('import { resolveTopPerformerImage } from "@/lib/data/top-performer-image-service";'),
  "home ranked API must use the top performer image resolver",
);

assert(
  rankedRoute.includes("const topPerformerImage = await resolveTopPerformerImage(topPerformerState?.start ?? null, null);"),
  "home ranked API must resolve an image for the selected top performer",
);

assert(
  rankedRoute.includes("topPerformer: topPerformerState ? { ...topPerformerState, image: topPerformerImage } : null"),
  "home ranked API must include image in the topPerformer payload",
);

assert(
  homeDeferredSections.includes("image: TopPerformerImage | null;"),
  "home ranked client response type must include topPerformer.image",
);

assert(
  homeDeferredSections.includes("image={ranked.topPerformer.image}"),
  "home deferred top performer card must pass through the ranked API image",
);

assert(
  !homeDeferredSections.includes("image={null}"),
  "home deferred top performer card must not hardcode a null image",
);

console.log("home ranked contract ok: top performer image resolves in the API and is passed to the homepage card");
