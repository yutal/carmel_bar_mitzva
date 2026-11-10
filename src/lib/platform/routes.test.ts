import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";

const appDir = path.resolve(process.cwd(), "src/app");

function routeFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? routeFiles(full) : e.name === "route.ts" ? [full] : [];
  });
}

test("every admin API route goes through a permission wrapper", () => {
  const files = routeFiles(path.join(appDir, "api/admin"));
  assert.ok(files.length > 10);
  for (const file of files) {
    const src = fs.readFileSync(file, "utf8");
    const handlers = src.match(/export (async function|const) (GET|POST|PUT|PATCH|DELETE)\b.*/g) ?? [];
    assert.ok(handlers.length, `${file} exports no handler`);
    for (const h of handlers) {
      assert.match(h, /= (eventAdminRoute|ownerRoute|signedInRoute)\(/, `${path.relative(appDir, file)}: "${h}" skips the permission wrapper`);
    }
  }
});

test("every guest API route under /api/e/[slug] runs inside its event", () => {
  for (const file of routeFiles(path.join(appDir, "api/e"))) {
    const src = fs.readFileSync(file, "utf8");
    for (const h of src.match(/export (async function|const) (GET|POST|PUT|PATCH|DELETE)\b.*/g) ?? []) {
      assert.match(h, /= publicEventRoute\(/, `${path.relative(appDir, file)}: "${h}" is outside publicEventRoute`);
    }
  }
});

test("every guest API route states its entry rule", () => {
  for (const file of routeFiles(path.join(appDir, "api/e"))) {
    const src = fs.readFileSync(file, "utf8");
    assert.match(src, /\{ entry: "(guest|screen|none)" \}\);\s*$/, `${path.relative(appDir, file)} does not say who may call it (entry: guest | screen | none)`);
  }
});

test("only the logo is open without a QR entry", () => {
  const open = routeFiles(path.join(appDir, "api/e")).filter((f) => /entry: "none"/.test(fs.readFileSync(f, "utf8")));
  assert.deepEqual(open.map((f) => path.relative(appDir, f).replaceAll(path.sep, "/")), ["api/e/[slug]/logo/route.ts"]);
});
