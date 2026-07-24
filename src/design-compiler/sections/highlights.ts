import type { DesignDNA, PreviewContent, Theme } from '../types.ts';
import { esc } from '../render/render-section.ts';

export const HIGHLIGHTS_VARIANTS = ['band', 'cards'] as const;

export function renderHighlights(variant: string, c: PreviewContent, _t: Theme, _dna: DesignDNA): string {
  const items = c.highlights.slice(0, 4);
  if (!items.length) return '';
  if (variant === 'cards') {
    const cards = items.map(h => `<div class="hi-card"><span class="hi-dot"></span><b>${esc(h)}</b></div>`).join('');
    return `<section class="hlband hlband--cards"><div class="wrap hi-cards">${cards}</div></section>`;
  }
  const strip = items.map(h => `<span class="hi-item">${esc(h)}</span>`).join('<span class="hi-sep">•</span>');
  return `<section class="hlband hlband--band"><div class="wrap hi-strip">${strip}</div></section>`;
}
