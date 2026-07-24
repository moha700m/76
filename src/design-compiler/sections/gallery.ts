import type { DesignDNA, PreviewContent, Theme } from '../types.ts';
import { esc } from '../render/render-section.ts';

export const GALLERY_VARIANTS = ['mosaic', 'grid'] as const;

// Decorative, gradient-based tiles (no external images, no fabricated content) labeled by section.
export function renderGallery(variant: string, c: PreviewContent, _t: Theme, _dna: DesignDNA): string {
  const labels = c.gallery.slice(0, 6);
  if (!labels.length) return '';
  const head = `<div class="section-head"><span class="kicker">SHOWCASE</span><h2>لمحة عن شكل التجربة.</h2></div>`;
  const tiles = labels.map((l, i) => `<figure class="tile tile-${(i % 5) + 1}"><figcaption>${esc(l)}</figcaption></figure>`).join('');
  const mod = variant === 'grid' ? 'gal--grid' : 'gal--mosaic';
  return `<section class="section gallery ${mod}"><div class="wrap">${head}<div class="tiles">${tiles}</div></div></section>`;
}
