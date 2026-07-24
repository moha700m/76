// Assembles a PageConfig into a complete, safe, RTL, mobile-first HTML preview page.
import type { PageConfig, PreviewProject } from '../types.ts';
import { esc, renderSection } from './render-section.ts';
import { compilePage } from '../compiler.ts';

function themeStyle(page: PageConfig): string {
  const c = page.theme.colors;
  return `:root{--bg:${c.bg};--surface:${c.surface};--text:${c.text};--muted:${c.muted};--accent:${c.accent};--accent2:${c.accent2};--line:${c.line};--radius:${page.theme.radius};--head:${page.theme.headingFont};--body:${page.theme.bodyFont}}`;
}

const BASE_CSS = `
*{box-sizing:border-box}html{scroll-behavior:smooth;-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--text);font-family:var(--body),Tahoma,'Noto Sans Arabic',sans-serif;line-height:1.85;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
a{color:inherit;text-decoration:none}img{max-width:100%}
h1,h2,h3{font-family:var(--head),'Cairo',sans-serif;line-height:1.18;letter-spacing:-.02em;margin:0}
.wrap{width:min(1140px,calc(100% - 34px));margin:auto}
.kicker{font-size:11px;letter-spacing:.18em;color:var(--accent);font-weight:800;text-transform:uppercase}
.section-head{max-width:720px;margin-bottom:34px}.section h2{font-size:clamp(28px,4.6vw,46px);margin:10px 0}.lead{color:var(--muted);max-width:680px;font-size:17px}
.btn{display:inline-flex;align-items:center;justify-content:center;padding:13px 24px;border-radius:999px;background:linear-gradient(135deg,var(--accent),var(--accent2));color:#fff;font-weight:800;border:0;box-shadow:0 10px 26px -10px color-mix(in srgb,var(--accent) 70%,transparent);transition:transform .2s ease,box-shadow .2s ease}
.btn:hover{transform:translateY(-2px);box-shadow:0 16px 34px -10px color-mix(in srgb,var(--accent) 75%,transparent)}
.ghost{display:inline-flex;align-items:center;padding:12px 22px;border:1px solid var(--line);border-radius:999px;background:color-mix(in srgb,var(--surface) 70%,transparent);font-weight:700;transition:border-color .2s,transform .2s}.ghost:hover{border-color:var(--accent);transform:translateY(-2px)}
.actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:28px}
.chip,.tag{display:inline-flex;align-items:center;gap:8px;padding:7px 14px;border:1px solid var(--line);border-radius:999px;color:var(--accent);background:color-mix(in srgb,var(--accent) 8%,var(--surface));font-size:12px;font-weight:700}
/* NAV */
.nav{position:sticky;top:0;z-index:20;background:color-mix(in srgb,var(--bg) 82%,transparent);backdrop-filter:blur(16px);border-bottom:1px solid var(--line)}
.navin{min-height:68px;display:flex;align-items:center;justify-content:space-between;gap:16px}.brand{font-size:20px;font-weight:800;font-family:var(--head),'Cairo',sans-serif}.navlinks{display:flex;gap:20px;color:var(--muted);font-size:13.5px}.navlinks a:hover{color:var(--text)}
/* HERO */
.hero{position:relative;padding:96px 0 78px;overflow:hidden}
.hero::before{content:'';position:absolute;inset:-20% -10% auto -10%;height:520px;background:radial-gradient(60% 60% at 78% 15%,color-mix(in srgb,var(--accent) 26%,transparent),transparent 70%),radial-gradient(50% 50% at 12% 20%,color-mix(in srgb,var(--accent2) 22%,transparent),transparent 70%);pointer-events:none;z-index:0}
.hero .wrap{position:relative;z-index:1}
.hero h1{font-size:clamp(40px,7vw,76px);margin:18px 0}.hero-copy .lead{font-size:19px}
.hero-grid{display:grid;grid-template-columns:1.05fr .95fr;gap:52px;align-items:center}.hero--showcase .hero-grid{grid-template-columns:.95fr 1.05fr}
.hero-centered{text-align:center;max-width:840px;margin:auto}.hero-centered .actions{justify-content:center}.hero--minimal{padding-top:120px}.hero-minimal{max-width:780px}
.visual{position:relative;min-height:360px;border:1px solid var(--line);border-radius:calc(var(--radius) + 8px);background:linear-gradient(150deg,color-mix(in srgb,var(--accent) 16%,var(--surface)),var(--surface));overflow:hidden;box-shadow:0 40px 90px -40px color-mix(in srgb,var(--text) 40%,transparent)}
.visual::after{content:'';position:absolute;width:240px;height:240px;border-radius:46% 54% 60% 40%;background:linear-gradient(135deg,var(--accent),var(--accent2));opacity:.35;bottom:-60px;left:-40px;filter:blur(2px)}
.panel{position:absolute;inset:42px 30px;border:1px solid var(--line);border-radius:var(--radius);background:color-mix(in srgb,var(--surface) 88%,transparent);padding:26px;display:flex;flex-direction:column;justify-content:space-between;z-index:1}.panel strong{font-size:26px}.panel small{color:var(--muted)}
/* HIGHLIGHTS */
.hlband{padding:22px 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line);background:color-mix(in srgb,var(--accent) 5%,var(--bg))}
.hi-strip{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:14px;color:var(--muted);font-weight:700}.hi-sep{color:var(--accent)}
.hi-cards{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.hi-card{display:flex;align-items:center;gap:10px;padding:16px;border:1px solid var(--line);border-radius:var(--radius);background:var(--surface);font-weight:700}.hi-dot{width:10px;height:10px;border-radius:50%;background:linear-gradient(135deg,var(--accent),var(--accent2));flex:0 0 auto}
/* SECTION shell */
.section{padding:82px 0;border-top:1px solid var(--line)}
/* SERVICES */
.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}.card{padding:26px;border:1px solid var(--line);border-radius:var(--radius);background:var(--surface);box-shadow:0 1px 0 color-mix(in srgb,var(--text) 6%,transparent);transition:transform .22s,box-shadow .22s,border-color .22s}.card:hover{transform:translateY(-6px);border-color:var(--accent);box-shadow:0 24px 50px -30px color-mix(in srgb,var(--accent) 70%,transparent)}
.card h3{margin:22px 0 8px;font-size:21px}.card p{color:var(--muted);margin:0}.cnum,.snum{color:var(--accent);font-weight:800;font-size:12px;letter-spacing:.1em}
.cards--accent .card{background:linear-gradient(165deg,color-mix(in srgb,var(--accent) 13%,var(--surface)),var(--surface))}
.slist{display:grid;gap:10px}.srow{display:flex;align-items:center;gap:16px;border:1px solid var(--line);border-radius:var(--radius);background:var(--surface);padding:18px;transition:border-color .2s}.srow:hover{border-color:var(--accent)}.srow small{display:block;color:var(--muted)}
/* GALLERY */
.tiles{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.gal--mosaic .tiles>*:nth-child(1){grid-column:span 2}.gal--mosaic .tiles>*:nth-child(4){grid-row:span 2}
.tile{position:relative;min-height:150px;margin:0;border-radius:var(--radius);border:1px solid var(--line);overflow:hidden;display:flex;align-items:flex-end;padding:14px;color:#fff}
.tile figcaption{position:relative;z-index:1;font-weight:800;font-size:14px;text-shadow:0 1px 6px rgba(0,0,0,.35)}
.tile::before{content:'';position:absolute;inset:0;background:linear-gradient(150deg,var(--accent),var(--accent2));opacity:.9}
.tile-2::before{background:linear-gradient(150deg,var(--accent2),var(--accent))}.tile-3::before{background:linear-gradient(120deg,var(--accent),color-mix(in srgb,var(--accent2) 60%,#000))}.tile-4::before{background:linear-gradient(200deg,var(--accent2),color-mix(in srgb,var(--accent) 60%,#000))}.tile-5::before{background:linear-gradient(160deg,color-mix(in srgb,var(--accent) 70%,#000),var(--accent2))}
/* PROCESS */
.pcards{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}.pcard{padding:22px;border:1px solid var(--line);border-radius:var(--radius);background:var(--surface)}.pnum{display:grid;place-items:center;width:38px;height:38px;border-radius:12px;background:linear-gradient(135deg,var(--accent),var(--accent2));color:#fff;font-weight:800}.pcard h3{margin:16px 0 6px;font-size:18px}.pcard p{color:var(--muted);margin:0;font-size:14px}
.ptimeline{list-style:none;margin:0;padding:0;display:grid;gap:12px}.pstep{display:flex;gap:16px;align-items:center;border:1px solid var(--line);border-radius:var(--radius);background:var(--surface);padding:16px}.pdot{display:grid;place-items:center;flex:0 0 40px;height:40px;border-radius:50%;background:color-mix(in srgb,var(--accent) 16%,var(--surface));color:var(--accent);font-weight:800}.pstep small{display:block;color:var(--muted)}
/* TESTIMONIALS */
.qgrid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.quotes--stacked .qgrid{grid-template-columns:1fr}.quote{margin:0;padding:26px;border:1px solid var(--line);border-radius:var(--radius);background:var(--surface)}.quote blockquote{margin:0 0 12px;font-size:18px}.quote figcaption{color:var(--muted);font-size:13px}
/* FAQ */
.qalist{display:grid;gap:12px}.qa{padding:20px;border:1px solid var(--line);border-radius:var(--radius);background:var(--surface)}.qa p{color:var(--muted);margin:8px 0 0}
.qacc{display:grid;gap:10px}.qitem{border:1px solid var(--line);border-radius:var(--radius);background:var(--surface);padding:6px 18px}.qitem summary{cursor:pointer;font-weight:800;padding:14px 0;list-style:none}.qitem summary::-webkit-details-marker{display:none}.qitem summary::after{content:'+';float:left;color:var(--accent);font-weight:800}.qitem[open] summary::after{content:'−'}.qitem p{color:var(--muted);margin:0 0 14px}
/* CTA */
.cta{padding:74px 0}.ctabox{padding:44px;border-radius:calc(var(--radius) + 6px);background:linear-gradient(120deg,var(--accent),var(--accent2));color:#fff;display:flex;justify-content:space-between;align-items:center;gap:24px;box-shadow:0 30px 70px -30px color-mix(in srgb,var(--accent) 80%,transparent)}.ctabox--split{align-items:flex-start;flex-direction:column}.ctabox h2{margin:0 0 6px;font-size:34px}.ctabox p{margin:0;opacity:.92}.ctabox .btn{background:#fff;color:var(--text);box-shadow:none}
/* FOOTER */
.footer{padding:30px 0;border-top:1px solid var(--line);color:var(--muted);font-size:13px}.footin{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap}
/* MOTION (respect reduced-motion) */
@media(prefers-reduced-motion:no-preference){
  @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
  main>section{animation:fadeUp .6s ease both}
  main>section:nth-child(2){animation-delay:.05s}main>section:nth-child(3){animation-delay:.1s}main>section:nth-child(4){animation-delay:.15s}main>section:nth-child(n+5){animation-delay:.2s}
}
/* RESPONSIVE */
@media(max-width:860px){.hero-grid,.hero--showcase .hero-grid{grid-template-columns:1fr}.cards,.pcards,.hi-cards,.tiles{grid-template-columns:1fr 1fr}.qgrid,.quotes--stacked .qgrid{grid-template-columns:1fr}.navlinks{display:none}.ctabox{display:block}.ctabox .btn{margin-top:18px}.visual{min-height:300px}.gal--mosaic .tiles>*{grid-column:auto;grid-row:auto}}
@media(max-width:520px){.wrap{width:min(100% - 24px,1140px)}.hero{padding-top:64px}.hero h1{font-size:38px}.actions a{width:100%}.cards,.pcards,.hi-cards,.tiles{grid-template-columns:1fr}.ctabox{padding:28px}.ctabox h2{font-size:26px}.section{padding:60px 0}}
`;

export function renderPage(page: PageConfig): string {
  const nav = `<nav class="nav"><div class="wrap navin"><a class="brand" href="#top">${esc(page.content.brandName)}</a><div class="navlinks">${page.content.navigation.map(n => `<a href="#offer">${esc(n)}</a>`).join('')}</div><a class="btn" href="#start">${esc(page.content.primaryCta)}</a></div></nav>`;
  const body = page.sections.map(cfg => renderSection(cfg, page.content, page.theme, page.dna)).join('');
  const fontLink = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Cairo:wght@600;700;800;900&family=Noto+Sans+Arabic:wght@400;500;600;700&display=swap" rel="stylesheet">`;
  return `<!doctype html><html lang="${page.meta.lang}" dir="${page.meta.dir}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(page.meta.title)}</title>${fontLink}<style>${themeStyle(page)}${BASE_CSS}</style></head><body>${nav}<main id="top">${body}</main></body></html>`;
}

export function renderPreviewFromProject(project: PreviewProject): string {
  return renderPage(compilePage(project));
}
