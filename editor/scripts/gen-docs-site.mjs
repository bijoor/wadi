// Generate the browsable Docs section of the website (wadi.house/docs/) from the
// repo's markdown. Source markdown stays the single source of truth — fine-tune a
// doc by editing its .md and re-running `npm --prefix editor run gen-docs-site`.
//
//   npm --prefix editor run gen-docs-site
//
// Output: docs/docs/*.html (a themed, sidebar-navigated static site). The two
// GENERATED refs (data-model.md, conventions.md) are rendered read-only here.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, basename } from "node:path";
import { marked } from "marked";
import { gfmHeadingId, getHeadingList, resetHeadings } from "marked-gfm-heading-id";

// GitHub-compatible heading ids, so hand-authored `#anchor` links in the source
// markdown (e.g. `#5-rooms-walls--openings`) resolve to the generated ids.
marked.use({ gfm: true }, gfmHeadingId());

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "..", ".."); // editor/scripts -> repo root
const outDir = resolve(repo, "docs", "docs");

// Page order + grouping. `slug` is the output filename (README -> index).
const GROUPS = [
  {
    title: "Guide",
    pages: [
      { src: "documentation/README.md", slug: "index", nav: "Overview" },
      { src: "documentation/01-concept.md", slug: "concept", nav: "The concept" },
      { src: "documentation/02-personas.md", slug: "personas", nav: "Who it's for" },
      { src: "documentation/03-authoring.md", slug: "authoring", nav: "Authoring a house" },
      { src: "documentation/07-ai-assistants.md", slug: "ai-assistants", nav: "Using an AI assistant" },
      { src: "documentation/04-components-and-libraries.md", slug: "components", nav: "Components & libraries" },
      { src: "documentation/05-extending-the-dsl.md", slug: "extending", nav: "Extending the DSL" },
      { src: "documentation/06-the-method.md", slug: "method", nav: "The method" },
    ],
  },
  {
    title: "DSL reference",
    pages: [
      { src: "wadi-skill/architect/reference/dsl.md", slug: "dsl", nav: "DSL syntax (.wdl)" },
      { src: "wadi-skill/architect/reference/data-model.md", slug: "data-model", nav: "Data model (.wadi)" },
      { src: "wadi-skill/architect/reference/coordinate-system.md", slug: "coordinate-system", nav: "Coordinates & units" },
      { src: "wadi-skill/architect/reference/parametric-conventions.md", slug: "parametric-conventions", nav: "Parametric templates" },
      { src: "wadi-skill/architect/reference/roof-v2-guide.md", slug: "roof-v2-guide", nav: "The roof object" },
      { src: "wadi-skill/architect/reference/conventions.md", slug: "conventions", nav: "Structural conventions" },
    ],
  },
];

const allPages = GROUPS.flatMap((g) => g.pages);
// basename(.md) -> output href, so inter-doc links resolve to the generated pages.
const linkMap = new Map(allPages.map((p) => [basename(p.src), `${p.slug}.html`]));

// Rewrite a markdown link target: a known doc basename -> its .html (keep #anchor);
// an in-page `#anchor` or a bare .md we don't publish is left as-is.
function rewriteHref(href) {
  if (!href || href.startsWith("#") || /^[a-z]+:/i.test(href)) return href; // in-page / external
  const m = /^([^#]*?)(#.*)?$/.exec(href);
  const path = m[1] || "";
  const hash = m[2] || "";
  const base = basename(path);
  if (linkMap.has(base)) return linkMap.get(base) + hash;
  return href;
}

// Render a page: GitHub-slugged heading ids (via the extension), doc-link
// rewriting as a post-process (composes cleanly with the extension), and an
// "on this page" list taken from the extension's heading list so it always
// matches the rendered ids.
function renderPage(md) {
  resetHeadings();
  let html = marked.parse(md);
  html = html.replace(/href="([^"]+)"/g, (_m, h) => `href="${rewriteHref(h)}"`);
  const toc = getHeadingList()
    .filter((h) => h.level === 2)
    .map((h) => ({ id: h.id, text: h.text.replace(/<[^>]+>/g, "").replace(/`/g, "") }));
  return { html, toc };
}

function sidebar(currentSlug) {
  return GROUPS.map((g) => {
    const links = g.pages
      .map((p) => {
        const cls = p.slug === currentSlug ? ' class="active"' : "";
        return `<a${cls} href="${p.slug}.html">${p.nav}</a>`;
      })
      .join("\n");
    return `<div class="grp"><div class="grp-t">${g.title}</div>${links}</div>`;
  }).join("\n");
}

function page({ slug, title, body, toc }) {
  const onThisPage =
    toc.length > 1
      ? `<nav class="toc"><div class="toc-t">On this page</div>${toc
          .map((t) => `<a href="#${t.id}">${t.text}</a>`)
          .join("")}</nav>`
      : "";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title} · Wadi Docs</title>
<link rel="icon" href="/favicon.svg" />
<style>${CSS}</style>
</head>
<body>
<header class="top">
  <a class="brand" href="/">Wadi</a>
  <span class="crumb">Docs</span>
  <nav class="top-links">
    <a href="/app/">Open the app</a>
    <a href="/dsl/">DSL playground</a>
    <a href="https://github.com/bijoor/wadi">GitHub</a>
  </nav>
  <button class="menu" aria-label="Toggle navigation" onclick="document.body.classList.toggle('nav-open')">☰</button>
</header>
<div class="shell">
  <aside class="side">${sidebar(slug)}</aside>
  <main class="content">
    ${onThisPage}
    <article class="md">${body}</article>
  </main>
</div>
<script>
  // Respect the site theme toggle if present; default follows the OS.
  try { const t = localStorage.getItem('wadi-theme'); if (t) document.documentElement.setAttribute('data-theme', t); } catch (e) {}
  document.querySelectorAll('.side a, .toc a').forEach(a => a.addEventListener('click', () => document.body.classList.remove('nav-open')));
</script>
</body>
</html>
`;
}

const CSS = `
:root{--bg:#faf7f2;--surface:#fff;--text:#23201c;--muted:#6d655b;--border:#e7ded1;--accent:#c2683a;--accent-soft:#f4e5da;--code:#f3ede4;--radius:14px}
:root[data-theme="dark"],:root:not([data-theme="light"]){}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--bg:#16130f;--surface:#1f1b16;--text:#f3ede4;--muted:#a89c8c;--border:#322b23;--accent:#e08a54;--accent-soft:#2c2118;--code:#241f19}}
:root[data-theme="dark"]{--bg:#16130f;--surface:#1f1b16;--text:#f3ede4;--muted:#a89c8c;--border:#322b23;--accent:#e08a54;--accent-soft:#2c2118;--code:#241f19}
*{box-sizing:border-box}
html,body{margin:0}
body{background:var(--bg);color:var(--text);font:16px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
a{color:var(--accent);text-decoration:none}
a:hover{text-decoration:underline}
.top{position:sticky;top:0;z-index:20;display:flex;align-items:center;gap:14px;padding:12px 20px;background:color-mix(in srgb,var(--bg) 88%,transparent);backdrop-filter:blur(8px);border-bottom:1px solid var(--border)}
.brand{font-weight:700;color:var(--text)}
.crumb{color:var(--muted);font-weight:600}
.top-links{margin-left:auto;display:flex;gap:16px;font-size:.92rem}
.top-links a{color:var(--muted)}
.menu{display:none;background:transparent;border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:1rem;padding:4px 10px;cursor:pointer}
.shell{display:grid;grid-template-columns:280px minmax(0,1fr);max-width:1180px;margin:0 auto;gap:0}
.side{position:sticky;top:57px;align-self:start;height:calc(100vh - 57px);overflow:auto;padding:24px 18px 60px;border-right:1px solid var(--border)}
.grp{margin-bottom:22px}
.grp-t{font-size:.72rem;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);font-weight:700;margin:0 8px 8px}
.side a{display:block;padding:6px 10px;border-radius:8px;color:var(--text);font-size:.93rem}
.side a:hover{background:var(--surface);text-decoration:none}
.side a.active{background:var(--accent-soft);color:var(--accent);font-weight:600}
.content{min-width:0;padding:34px 40px 90px;max-width:860px}
.toc{float:right;margin:0 0 18px 26px;max-width:230px;padding:12px 14px;background:var(--surface);border:1px solid var(--border);border-radius:12px;font-size:.86rem}
.toc-t{font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;font-size:.68rem;margin-bottom:6px}
.toc a{display:block;padding:2px 0;color:var(--muted)}
.toc a:hover{color:var(--accent)}
.md{overflow-wrap:break-word}
.md h1{font-size:2rem;line-height:1.2;margin:.2em 0 .5em}
.md h2{font-size:1.4rem;margin:1.8em 0 .5em;padding-top:.4em;border-top:1px solid var(--border)}
.md h3{font-size:1.12rem;margin:1.4em 0 .4em}
.md h2:first-of-type{border-top:none}
.md p,.md li{color:var(--text)}
.md code{background:var(--code);border:1px solid var(--border);border-radius:6px;padding:.08em .38em;font-size:.88em;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
.md pre{background:var(--code);border:1px solid var(--border);border-radius:12px;padding:14px 16px;overflow:auto}
.md pre code{background:none;border:none;padding:0;font-size:.86em}
.md blockquote{margin:1em 0;padding:.4em 1em;border-left:3px solid var(--accent);background:var(--accent-soft);border-radius:0 8px 8px 0;color:var(--text)}
.md table{border-collapse:collapse;width:100%;display:block;overflow-x:auto;margin:1em 0;font-size:.92rem}
.md th,.md td{border:1px solid var(--border);padding:7px 11px;text-align:left;vertical-align:top}
.md th{background:var(--surface)}
.md hr{border:none;border-top:1px solid var(--border);margin:2em 0}
.md img{max-width:100%}
@media (max-width:860px){
  .shell{grid-template-columns:1fr}
  .menu{display:block}
  .top-links{display:none}
  .side{position:fixed;top:57px;left:0;width:280px;background:var(--bg);transform:translateX(-102%);transition:transform .2s;z-index:15}
  body.nav-open .side{transform:none}
  .content{padding:24px 20px 80px}
  .toc{float:none;margin:0 0 20px;max-width:none}
}
`;

mkdirSync(outDir, { recursive: true });
let n = 0;
for (const p of allPages) {
  const md = readFileSync(resolve(repo, p.src), "utf8");
  const titleMatch = /^#\s+(.+)$/m.exec(md);
  const title = titleMatch ? titleMatch[1].replace(/`/g, "").replace(/[*_]/g, "") : p.nav;
  const { html: body, toc } = renderPage(md);
  const html = page({ slug: p.slug, title, body, toc });
  writeFileSync(resolve(outDir, `${p.slug}.html`), html);
  n++;
}
console.log(`wrote ${n} doc pages -> docs/docs/`);
