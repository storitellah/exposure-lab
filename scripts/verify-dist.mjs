/**
 * Deployment smoke test.
 *
 * Serves dist/ the way a static host does — applying `_headers` (so the real
 * Content-Security-Policy is in force) and the `_redirects` rules in order —
 * then loads the app in a browser and checks it actually mounts.
 *
 * This exists because `vite preview` applies neither file, so a
 * headers/routing problem can pass every local test and still ship a blank
 * page. The specific failure it guards against: the single-page-app catch-all
 * answering a request for /assets/index-<hash>.js with index.html, after
 * which the browser refuses to execute HTML as a module script and the page
 * renders white.
 *
 *   npm run verify:dist
 */
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const PORT = 8791;

if (!existsSync(join(dist, 'index.html'))) {
  console.error('verify-dist: dist/ not found — run `npm run build` first.');
  process.exit(1);
}

/* ---------- parse _headers ---------- */
const headerRules = [];
if (existsSync(join(dist, '_headers'))) {
  let current = null;
  for (const line of readFileSync(join(dist, '_headers'), 'utf8').split('\n')) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    if (!/^\s/.test(line)) {
      current = { pattern: line.trim(), headers: [] };
      headerRules.push(current);
    } else if (current) {
      const i = line.indexOf(':');
      current.headers.push([line.slice(0, i).trim(), line.slice(i + 1).trim()]);
    }
  }
}

/* ---------- parse _redirects ---------- */
const redirects = [];
if (existsSync(join(dist, '_redirects'))) {
  for (const line of readFileSync(join(dist, '_redirects'), 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const [from, to, status] = t.split(/\s+/);
    redirects.push({ from, to, status: Number(status ?? 200) });
  }
}

const matchPattern = (pattern, path) =>
  pattern.endsWith('/*') ? path.startsWith(pattern.slice(0, -1)) : pattern === path;

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.txt': 'text/plain',
  '.xml': 'application/xml', '.woff2': 'font/woff2', '.woff': 'font/woff',
};

/** Resolve a request path to a file, following _redirects rewrites in order. */
function resolveFile(path) {
  const direct = join(dist, path);
  if (existsSync(direct) && statSync(direct).isFile()) return direct;
  const asDir = join(direct, 'index.html');
  if (existsSync(asDir)) return asDir;

  for (const rule of redirects) {
    if (!matchPattern(rule.from, path)) continue;
    let target = rule.to;
    if (rule.from.endsWith('/*') && target.includes(':splat')) {
      target = target.replace(':splat', path.slice(rule.from.length - 1));
    }
    const file = join(dist, target);
    if (existsSync(file) && statSync(file).isFile()) return file;
    return null; // rule matched but the target does not exist → honest 404
  }
  return null;
}

const server = createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const file = resolveFile(path);
  for (const rule of headerRules) {
    if (matchPattern(rule.pattern, path)) for (const [k, v] of rule.headers) res.setHeader(k, v);
  }
  if (!file) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/plain');
    res.end('Not found');
    return;
  }
  res.setHeader('Content-Type', TYPES[extname(file)] ?? 'application/octet-stream');
  res.end(readFileSync(file));
});

await new Promise((r) => server.listen(PORT, r));

const failures = [];
const browser = await chromium.launch();

/* ---------- 1. assets must be served as scripts, never as HTML ---------- */
const indexHtml = readFileSync(join(dist, 'index.html'), 'utf8');
const scriptSrc = indexHtml.match(/<script[^>]+src="([^"]+)"/)?.[1];
const styleSrc = indexHtml.match(/<link rel="stylesheet"[^>]+href="([^"]+)"/)?.[1];

if (!scriptSrc) {
  failures.push('index.html has no module script tag');
} else {
  const res = await fetch(`http://localhost:${PORT}${scriptSrc}`);
  const type = res.headers.get('content-type') ?? '';
  if (!res.ok) failures.push(`entry script ${scriptSrc} returned HTTP ${res.status}`);
  if (type.includes('text/html')) {
    failures.push(`entry script ${scriptSrc} is served as "${type}" instead of JavaScript.`);
  }
}

/*
 * The check above assumes the host serves a matching static asset before
 * consulting _redirects. Not every host does, and the ordering is exactly
 * what decides whether a blank page ships. So verify the pessimistic case
 * too: if _redirects were evaluated FIRST, would each built asset still
 * resolve to itself rather than to index.html?
 */
for (const assetPath of [scriptSrc, styleSrc, '/sw.js', '/manifest.webmanifest'].filter(Boolean)) {
  const rule = redirects.find((r) => matchPattern(r.from, assetPath));
  if (!rule) continue; // no rule can touch it — safe
  const target = rule.from.endsWith('/*') && rule.to.includes(':splat')
    ? rule.to.replace(':splat', assetPath.slice(rule.from.length - 1))
    : rule.to;
  if (target !== assetPath) {
    failures.push(
      `_redirects rule "${rule.from} -> ${rule.to}" would rewrite ${assetPath} to ${target}. ` +
      'On a host that evaluates redirects before static assets, the browser then ' +
      'receives HTML where it expected a module script and the page renders blank. ' +
      'Add a passthrough rule for this path above the catch-all.',
    );
  }
}

/* ---------- 2. every route must actually mount the app ---------- */
const routes = ['/', '/simulator', '/learn', '/learn/what-is-exposure', '/video', '/challenges'];
for (const route of routes) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`http://localhost:${PORT}${route}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);

  const mounted = await page.evaluate(
    () => !!document.querySelector('.app-shell') && !document.querySelector('.boot-fallback'),
  );
  if (!mounted) failures.push(`${route}: app did not mount (boot fallback still on screen)`);
  for (const e of errors) failures.push(`${route}: ${e}`);
  await page.close();
}

await browser.close();
server.close();

if (failures.length) {
  console.error('verify-dist FAILED:');
  for (const f of failures) console.error(`  • ${f}`);
  process.exit(1);
}
console.log(`verify-dist: OK — assets served correctly and all ${routes.length} routes mount.`);
