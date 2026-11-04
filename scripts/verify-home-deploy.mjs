import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export function verifyHtml(html, sha, offseason = false) {
  assert.match(sha, /^[a-f0-9]{40}$/, 'Expected full deployed commit SHA is required');
  const build = html.match(/<meta\s+name="tts-build"\s+content="([^"]+)"/i)?.[1];
  assert(build?.startsWith(`${sha.slice(0, 12)}-`), `STALE HOMEPAGE: expected ${sha.slice(0, 12)}, received ${build ?? 'missing marker'}`);
  if (offseason) {
    assert(!html.includes('Warming up'), 'Old skeleton in raw HTML');
    const h1 = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1].replace(/<[^>]*>/g, '').replace(/<!--.*?-->/g, '');
    assert.equal(h1, '2026 Season in Review');
    const nav = html.match(/<nav\b[^>]*aria-label="Primary"[^>]*>([\s\S]*?)<\/nav>/i)?.[1];
    assert.equal((nav?.match(/<a\s/g) ?? []).length, 4, 'Expected four primary nav items');
  }
  return { build, offseason };
}

export async function verifyHome(base, sha, out, offseason = false) {
  const url = new URL(base);
  assert(url.pathname === '/' && !url.search && !url.hash, 'Only plain homepage URL allowed');
  await mkdir(out, { recursive: true });
  // No cache mode override, cache-buster, or request Cache-Control header.
  const response = await fetch(url, { redirect: 'manual' });
  const html = await response.text();
  await writeFile(`${out}/home.html`, html);
  await writeFile(`${out}/headers.txt`, `GET ${url}\nHTTP ${response.status}\n${[...response.headers].map(([k,v])=>`${k}: ${v}`).join('\n')}\n`);
  assert.equal(response.status, 200, 'Plain homepage must return 200 without redirects');
  const result = { url: url.href, status: response.status, ...verifyHtml(html, sha, offseason) };
  await writeFile(`${out}/result.json`, JSON.stringify(result, null, 2));
  console.log('PASS plain homepage deployment identity', JSON.stringify(result));
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [base, sha, out = 'outputs/home-deploy'] = process.argv.slice(2);
  await verifyHome(base, sha, out, process.argv.includes('--offseason'));
}
