import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";

const service = await read("src/lib/data/daily-social-post-service.ts");
const card = await read("src/lib/daily-social-card.tsx");
const admin = await read("src/app/admin/daily-post/page.tsx");
const igRoute = await read("src/app/social/start-of-day/[date]/instagram/route.tsx");
const xRoute = await read("src/app/social/start-of-day/[date]/x/route.tsx");
const apiRoute = await read("src/app/api/social/start-of-day/route.ts");
const cronRoute = await read("src/app/api/cron/daily-social/route.ts");
const vercel = JSON.parse(await read("vercel.json"));
const packageJson = JSON.parse(await read("package.json"));

assert.match(service, /type StartOfDay = \{[\s\S]*gamePk: number;[\s\S]*pitcherId: number;[\s\S]*homeAway: "home" \| "away";[\s\S]*gsPlus: number;[\s\S]*headshotUrl: string;/, "StartOfDay type must expose the required social payload fields.");
assert.match(service, /completion\.totalStarts === 0/, "Resolver must cleanly no-op off days.");
assert.match(service, /!completion\.isFinal/, "Resolver must wait until the full slate is final.");
assert.match(service, /start\.source\?\.line !== "fixture"/, "Resolver must filter out fixture placeholder lines.");
assert.match(service, /import \{ isRankedRegularStart \} from "@\/lib\/start-classification";/, "Resolver must use ranked-start eligibility for Start of the Day.");
assert.match(service, /start\.source\?\.line !== "fixture" && isRankedRegularStart\(start\)/, "Resolver must require the shared 2.0 IP ranked-start floor.");
assert.match(service, /tiedStarts\.length > 1/, "Resolver must skip shared top GS+ ties in v1.");
assert.match(service, /renderUrls: \{[\s\S]*instagram: absoluteUrl\(dailySocialImagePath\(date, "instagram"\)\),[\s\S]*x: absoluteUrl\(dailySocialImagePath\(date, "x"\)\),[\s\S]*\}/, "Resolver must publish stable absolute URLs for both crops.");
assert.match(service, /x: `\$\{start\.name\}: Start of the Day\.[\s\S]*\$\{start\.gsPlus\} GS\+\.`/, "X copy must be generated link-free from real start data.");
assert.match(service, /rankingsUrl = absoluteUrl\(`\/starts\/\$\{start\.date\}`\)/, "Rankings URL must be available separately for the X reply.");

assert.match(card, /instagram: \{ width: 1080, height: 1350 \}/, "Instagram render must be 1080x1350.");
assert.match(card, /x: \{ width: 1600, height: 900 \}/, "X render must be 1600x900.");
assert.match(card, /Today(?:'|&apos;)s best start/, "Card eyebrow must use a finished-state label.");
assert.match(card, /Start of the Day/, "Card must retain the Start of the Day subtitle.");
assert.match(card, /Toe the Slab/, "Card must lock the Toe the Slab masthead at the top.");
assert.doesNotMatch(card, /View game log/i, "Social card must not render the removed game-log button.");
assert.doesNotMatch(card, /league avg/i, "Social card must not render the removed league-average line.");

assert.match(igRoute, /variant="instagram"/, "Instagram route must render the portrait variant.");
assert.match(xRoute, /variant="x"/, "X route must render the widescreen variant.");
assert.match(apiRoute, /getDailySocialPostDraft/, "API route must expose the shared daily social resolver.");
assert.match(cronRoute, /addDays\(getHomeSlateDate\(\), -1\)/, "Cron route must target the prior day's completed slate.");
assert.match(cronRoute, /CRON_SECRET/, "Cron route must share the existing cron authorization pattern.");
assert.match(cronRoute, /revalidatePath\(dailySocialImagePath\(date, "instagram"\)\)/, "Cron route must revalidate the Instagram render path.");
assert.match(cronRoute, /revalidatePath\(dailySocialImagePath\(date, "x"\)\)/, "Cron route must revalidate the X render path.");
assert.match(admin, /DAILY_POST_ADMIN_TOKEN/, "Admin page must be token-gated when configured.");
assert.match(admin, /draft\.start\.renderUrls\.instagram/, "Admin page must preview the Instagram render.");
assert.match(admin, /draft\.start\.renderUrls\.x/, "Admin page must preview the X render.");
assert.match(admin, /draft\.copy\.instagram/, "Admin page must show the Instagram caption.");
assert.match(admin, /draft\.copy\.x/, "Admin page must show the X caption.");

assert.equal(packageJson.scripts["check:daily-social"], "node scripts/check-daily-social-contract.mjs", "package.json must expose check:daily-social.");
assert.ok(vercel.crons.some((cron) => cron.path === "/api/cron/daily-social" && cron.schedule === "0 13 * * *"), "Vercel must schedule daily social resolution at 13:00 UTC.");

console.log("Daily social post contract passed.");

async function read(file) {
  return readFile(new URL(`../${file}`, import.meta.url), "utf8");
}
