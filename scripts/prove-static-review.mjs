import { spawn } from "node:child_process";
import { writeFile, readFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const out = path.resolve(process.argv[2] ?? ".responsive-screenshots/review-static-proof");
await mkdir(out, { recursive: true });
const hook = path.join(out, "deny-db.mjs");
const evidence = path.join(out, "db-counter.json");
await writeFile(hook, `import fs from 'node:fs';
const file=process.env.OFF1_DB_COUNTER;
let state={active:true,negativeControl:false,reads:0};
const original=globalThis.fetch;
globalThis.fetch=async(input,...args)=>{const url=String(input?.url??input);if(/supabase\\.|\\/rest\\/v1\\//.test(url)){state.reads++;fs.writeFileSync(file,JSON.stringify(state));throw new Error('OFF1 forbidden request-path DB read');}return original(input,...args);};
try{await fetch('https://negative.invalid/rest/v1/test');}catch{state.negativeControl=state.reads===1;}
state.reads=0;fs.writeFileSync(file,JSON.stringify(state));
`);
const server = spawn(process.execPath, ["--import", pathToFileURL(hook).href, "node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "3121"], { env: { ...process.env, OFF1_DB_COUNTER: evidence }, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
let logs = "";
server.stdout.on("data", (data) => { logs += data; });
server.stderr.on("data", (data) => { logs += data; });
try {
  const rows = [];
  for (let index = 0; index < 100 && !logs.includes("Ready"); index++) await new Promise((resolve) => setTimeout(resolve, 100));
  assert(logs.includes("Ready"), "proof server ready");
  for (const route of ["/2026", "/2026/rotations", "/2026"]) {
    const response = await fetch("http://127.0.0.1:3121" + route);
    const text = await response.text();
    assert.equal(response.status, 200);
    assert(text.includes("2026"));
    rows.push({ route, status: response.status, cache: response.headers.get("x-nextjs-cache") });
  }
  const counter = JSON.parse(await readFile(evidence, "utf8"));
  assert(counter.active && counter.negativeControl);
  assert.equal(counter.reads, 0);
  await writeFile(path.join(out, "static-proof.json"), JSON.stringify({ counter, rows }, null, 2));
  console.log("Cold server static archive proof PASS: negative control works; three archive requests, zero DB calls.");
} finally { server.kill(); await writeFile(path.join(out, "server.log"), logs); }
