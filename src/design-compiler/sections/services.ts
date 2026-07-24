import type { DesignDNA, PreviewContent, Theme } from '../types.ts';
import { esc } from '../render/render-section.ts';

export const SERVICES_VARIANTS = ['grid', 'list', 'cards-accent'] as const;

export function renderServices(variant: string, c: PreviewContent, _t: Theme, _dna: DesignDNA): string {
  const head = `<div class="section-head"><span class="kicker">SOLUTION</span><h2>أقسام تخدم قرار الزائر.</h2><p class="lead">محتوى مرتبط مباشرة بالفكرة، دون قالب عام.</p></div>`;
  const items = c.services.slice(0, 6);

  if (variant === 'list') {
    const rows = items.map((s, i) => `<div class="srow"><span class="snum">0${i + 1}</span><div><b>${esc(s.title)}</b><small>${esc(s.body)}</small></div></div>`).join('');
    return `<section class="section services services--list" id="offer"><div class="wrap">${head}<div class="slist">${rows}</div></div></section>`;
  }
  const accent = variant === 'cards-accent' ? ' cards--accent' : '';
  const cards = items.map((s, i) => `<article class="card"><span class="cnum">0${i + 1}</span><h3>${esc(s.title)}</h3><p>${esc(s.body)}</p></article>`).join('');
  return `<section class="section services services--${variant}" id="offer"><div class="wrap">${head}<div class="cards${accent}">${cards}</div></div></section>`;
}
