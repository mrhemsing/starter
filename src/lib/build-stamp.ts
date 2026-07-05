import { execSync } from "node:child_process";

const BUILD_SHA_LENGTH = 12;

export const TTS_BUILD_SHA = (
  process.env.VERCEL_GIT_COMMIT_SHA
    ?? process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA
    ?? readLocalGitSha()
    ?? "local"
).slice(0, BUILD_SHA_LENGTH);

export const TTS_BUILD_TIME = process.env.TTS_BUILD_TIME ?? process.env.NEXT_PUBLIC_TTS_BUILD_TIME ?? new Date().toISOString();
export const TTS_BUILD_STAMP = `${TTS_BUILD_SHA}-${TTS_BUILD_TIME}`;

function readLocalGitSha() {
  try {
    return execSync("git rev-parse HEAD", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}
