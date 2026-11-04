import {spawnSync} from 'node:child_process';
const checks=['check-dated-hero-attribution.mjs','check-settled-media.mjs','check-highlight-backfill.mjs','check-canonical-highlight-detail.mjs','check-home-ranked-contract.mjs','check-home-best-starts-contract.mjs','check-starts-page-contract.mjs','check-read-path-cache-contract.mjs','check-offseason-visuals.mjs'];
for(const file of checks){console.log(`CHECK ${file}`);const result=spawnSync(process.execPath,[`scripts/${file}`],{stdio:'inherit'});if(result.status!==0)process.exit(result.status??1);}
console.log(`PASS ${checks.length} OFF-1.3.1 verification suites`);
