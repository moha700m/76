// Assembles a PageConfig into a complete, safe, RTL, mobile-first HTML preview page.
import type { PageConfig, PreviewProject } from '../types.ts';
import { esc, renderSection } from './render-section.ts';
import { compilePage } from '../compiler.ts';

function themeStyle(page: PageConfig): string {
  const c = page.theme.colors;
  return `:root{--bg:${c.bg};--surface:${c.surface};--text:${c.text};--muted:${c.muted};--accent:${c.accent};--accent2:${c.accent2};--line:${c.line};--radius:${page.theme.radius}}`;
}

const BASE_CSS = `*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--bg);color:var(--text);font-family:Tahoma,'Noto Sans Arabic',sans-serif;line-height:1.8}a{color:inherit;text-decoration:none}h1,h2,h3{font-family:'Cairo',sans-serif;line-height:1.2}.wrap{width:min(1120px,calc(100% - 32px));margin:auto}
.nav{position:sticky;top:0;z-index:10;background:color-mix(in srgb,var(--bg) 88%,transparent);backdrop-filter:blur(14px);border-bottom:1px solid var(--line)}.navin{min-height:66px;display:flex;align-items:center;justify-content:space-between;gap:16px}.brand{font-size:20px;font-weight:800}.navlinks{display:flex;gap:18px;color:var(--muted);font-size:13px}
.btn{display:inline-flex;align-items:center;justify-content:center;padding:12px 20px;border-radius:999px;background:var(--accent);color:var(--surface);font-weight:800}.ghost{display:inline-flex;padding:11px 19px;border:1px solid var(--line);border-radius:999px;background:var(--surface);font-weight:700}.actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:26px}
.tag{display:inline-flex;padding:7px 12px;border:1px solid var(--line);border-radius:999px;color:var(--accent);background:var(--surface);font-size:12px;font-weight:700}.lead{color:var(--muted);max-width:680px}
.hero{padding:84px 0 66px}.hero h1{font-size:clamp(40px,7vw,74px);margin:18px 0;letter-spacing:-1px}.hero-grid{display:grid;grid-template-columns:1.05fr .95fr;gap:48px;align-items:center}.hero--showcase .hero-grid{grid-template-columns:.95fr 1.05fr}.hero-centered{text-align:center;max-width:820px;margin:auto}.hero-centered .actions{justify-content:center}.hero--minimal{padding-top:110px}.hero-minimal{max-width:760px}
.visual{position:relative;min-height:340px;border:1px solid var(--line);border-radius:var(--radius);background:linear-gradient(145deg,var(--surface),color-mix(in srgb,var(--accent) 12%,var(--surface)));overflow:hidden}.panel{position:absolute;inset:44px 30px;border:1px solid var(--line);border-radius:var(--radius);background:color-mix(in srgb,var(--surface) 86%,transparent);padding:26px;display:flex;flex-direction:column;justify-content:space-between}.panel strong{font-size:26px}.panel small{color:var(--muted)}
.section{padding:80px 0;border-top:1px solid var(--line)}.section-head{max-width:720px;margin-bottom:30px}.kicker{font-size:11px;letter-spacing:.16em;color:var(--accent);font-weight:800}.section h2{font-size:clamp(28px,5vw,48px);margin:8px 0}
.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.card{padding:24px;border:1px solid var(--line);border-radius:var(--radius);background:var(--surface);transition:.2s}.card:hover{transform:translateY(-4px);border-color:var(--accent)}.card h3{margin:22px 0 8px;font-size:20px}.card p{color:var(--muted);margin:0}.cnum,.snum{color:var(--accent);font-weight:800;font-size:12px}.cards--accent .card{background:linear-gradient(160deg,color-mix(in srgb,var(--accent) 12%,var(--surface)),var(--surface))}
.slist{display:grid;gap:10px}.srow{display:flex;align-items:center;gap:16px;border:1px solid var(--line);border-radius:var(--radius);background:var(--surface);padding:16px}.srow small{display:block;color:var(--muted)}
.qgrid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.quotes--stacked .qgrid{grid-template-columns:1fr}.quote{margin:0;padding:24px;border:1px solid var(--line);border-radius:var(--radius);background:var(--surface)}.quote blockquote{margin:0 0 12px;font-size:18px}.quote figcaption{color:var(--muted);font-size:13px}
.cta{padding:70px 0}.ctabox{padding:40px;border-radius:var(--radius);background:linear-gradient(120deg,var(--accent),var(--accent2));color:var(--surface);display:flex;justify-content:space-between;align-items:center;gap:24px}.ctabox--split{align-items:flex-start;flex-direction:column}.ctabox h2{margin:0 0 6px;font-size:32px}.ctabox p{margin:0;opacity:.9}.ctabox .btn{background:var(--surface);color:var(--text)}
.footer{padding:26px 0;border-top:1px solid var(--line);color:var(--muted);font-size:13px}.footin{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap}
@media(max-width:820px){.hero-grid,.hero--showcase .hero-grid{grid-template-columns:1fr}.cards{grid-template-columns:1fr}.qgrid,.quotes--stacked .qgrid{grid-template-columns:1fr}.navlinks{display:none}.ctabox{display:block}.ctabox .btn{margin-top:18px}.visual{min-height:280px}}
@media(max-width:480px){.wrap{width:min(100% - 22px,1120px)}.hero{padding-top:60px}.hero h1{font-size:38px}.actions a{width:100%}.ctabox{padding:26px}.ctabox h2{font-size:26px}}`;

export function renderPage(page: PageConfig): string {
  const nav = `<nav class="nav"><div class="wrap navin"><a class="brand" href="#top">${esc(page.content.brandName)}</a><div class="navlinks">${page.content.navigation.map(n => `<a href="#offer">${esc(n)}</a>`).join('')}</div><a class="btn" href="#start">${esc(page.content.primaryCta)}</a></div></nav>`;
  const body = page.sections.map(cfg => renderSection(cfg, page.content, page.theme, page.dna)).join('');
  const main = `<main>${body}</main>`;
  const fontLink = `<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Cairo:wght@600;700;800&family=Noto+Sans+Arabic:wght@400;500;600&display=swap" rel="stylesheet">`;
  return `<!doctype html><html lang="${page.meta.lang}" dir="${page.meta.dir}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(page.meta.title)}</title>${fontLink}<style>${themeStyle(page)}${BASE_CSS}</style></head><body>${nav}${main}</body></html>`;
}

// Facade used by the backend site-preview: project -> compiled, rendered HTML.
export function renderPreviewFromProject(project: PreviewProject): string {
  return renderPage(compilePage(project));
}
