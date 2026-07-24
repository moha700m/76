import type { DesignDNA, PreviewContent, Theme } from '../types.ts';
import { esc } from '../render/render-section.ts';

export const TESTIMONIALS_VARIANTS = ['duo', 'stacked'] as const;

export function renderTestimonials(variant: string, c: PreviewContent, _t: Theme, _dna: DesignDNA): string {
  const items = c.testimonials.slice(0, 4);
  if (!items.length) return '';
  const head = `<div class="section-head"><span class="kicker">VOICES</span><h2>ماذا يقول جمهورك.</h2></div>`;
  const cards = items.map(q => `<figure class="quote"><blockquote>${esc(q.quote)}</blockquote><figcaption>${esc(q.author)}</figcaption></figure>`).join('');
  const mod = variant === 'stacked' ? 'quotes--stacked' : 'quotes--duo';
  return `<section class="section quotes ${mod}"><div class="wrap">${head}<div class="qgrid">${cards}</div></div></section>`;
}
