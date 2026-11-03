import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import ts from "typescript";

// Publish-time tooling only. Runs the same pure TS calculations used by the app.
const modules = new Map();
export function loadProjectTs(file) {
  const absolute = path.resolve(file);
  if (modules.has(absolute)) return modules.get(absolute).exports;
  const module = { exports: {} };
  modules.set(absolute, module);
  const nativeRequire = createRequire(absolute);
  const require = (id) => {
    const base = id.startsWith("@/") ? path.resolve("src", id.slice(2)) : id.startsWith(".") ? path.resolve(path.dirname(absolute), id) : null;
    if (!base) return nativeRequire(id);
    for (const candidate of [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")]) {
      if (existsSync(candidate) && /\.tsx?$/.test(candidate)) return loadProjectTs(candidate);
    }
    return nativeRequire(base);
  };
  const source = ts.transpileModule(readFileSync(absolute, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new Function("require", "module", "exports", "__filename", "__dirname", source)(require, module, module.exports, absolute, path.dirname(absolute));
  return module.exports;
}
