/**
 * Post-build step: write a real HTML file for every route with that route's
 * <title>, description, canonical URL and Open Graph tags baked in.
 *
 * The app is still a single-page application — these files load exactly the
 * same bundle — but crawlers, link previews and no-JavaScript visitors get
 * correct, distinct metadata per page instead of one shared title.
 *
 * Run automatically by `npm run build`.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const seo = JSON.parse(readFileSync(join(root, 'src', 'seo.json'), 'utf8'));

if (!existsSync(join(dist, 'index.html'))) {
  console.error('prerender-meta: dist/index.html not found — run vite build first.');
  process.exit(1);
}
const template = readFileSync(join(dist, 'index.html'), 'utf8');

/** Escape text for safe use inside an HTML attribute. */
const attr = (s) =>
  s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/*
 * Lesson pages are real URLs (/learn/<id>), so give each one its own file
 * too. Every reachable path is then a static file and nothing depends on the
 * single-page-app fallback, which is one less thing to misconfigure on a
 * host — and each lesson becomes independently crawlable.
 */
const lessonSource = readFileSync(join(root, 'src', 'data', 'lessons.ts'), 'utf8');
const lessons = [...lessonSource.matchAll(
  /id: '([a-z0-9-]+)', sceneId:[\s\S]*?title: \{ en: '([^']+)'/g,
)].map((m) => ({ id: m[1], title: m[2] }));
if (lessons.length === 0) {
  console.error('prerender-meta: found no lessons — the parser needs updating.');
  process.exit(1);
}
const learnMeta = seo.routes.find((r) => r.path === '/learn');
const lessonRoutes = lessons.map(({ id, title }) => ({
  path: `/learn/${id}`,
  title: `${title} — Photography Lesson | Tatu Exposure Lab`,
  description: learnMeta?.description ?? seo.defaultDescription,
}));

const allRoutes = [...seo.routes, ...lessonRoutes];

let written = 0;
for (const route of allRoutes) {
  let html = template
    .replace(/<title>.*?<\/title>/s, `<title>${attr(route.title)}</title>`)
    .replace(
      /<meta name="description" content=".*?"\s*\/?>/s,
      `<meta name="description" content="${attr(route.description)}" />`,
    )
    .replace(
      /<meta property="og:title" content=".*?"\s*\/?>/s,
      `<meta property="og:title" content="${attr(route.title)}" />`,
    )
    .replace(
      /<meta property="og:description" content=".*?"\s*\/?>/s,
      `<meta property="og:description" content="${attr(route.description)}" />`,
    );

  // Canonical URL is relative so the build works on any domain.
  html = html.replace(
    '</head>',
    `  <link rel="canonical" href="${attr(route.path)}" />\n  </head>`,
  );

  const outPath =
    route.path === '/'
      ? join(dist, 'index.html')
      : join(dist, route.path.replace(/^\//, ''), 'index.html');
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, html);
  written++;
}

/*
 * Sitemap and robots.txt both require absolute URLs. Set SITE_URL at build
 * time to emit them (e.g. SITE_URL=https://lab.example.org npm run build);
 * without it the sitemap is skipped rather than shipped invalid.
 */
const siteUrl = (process.env.SITE_URL ?? '').replace(/\/+$/, '');
if (siteUrl) {
  const sitemap = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...allRoutes.map((r) => `  <url><loc>${attr(siteUrl + r.path)}</loc></url>`),
    '</urlset>',
  ].join('\n');
  writeFileSync(join(dist, 'sitemap.xml'), `${sitemap}\n`);
  writeFileSync(
    join(dist, 'robots.txt'),
    `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}/sitemap.xml\n`,
  );
}

console.log(
  `prerender-meta: wrote ${written} route pages` +
  (siteUrl ? ' + sitemap.xml + robots.txt' : ' (set SITE_URL to also emit sitemap.xml)'),
);
