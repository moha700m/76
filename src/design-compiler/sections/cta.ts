import type { DesignDNA, PreviewContent, Theme } from '../types.ts';
import { esc, button } from '../render/render-section.ts';

export const CTA_VARIANTS = ['banner', 'split'] as const;

export function renderCta(variant: string, c: PreviewContent, _t: Theme, _dna: DesignDNA): string {
  const cta = button(c.primaryCta, '#top');
  if (variant === 'split') {
    return `<section class="cta cta--split" id="start"><div class="wrap ctabox ctabox--split"><div class="ctatext"><h2>${esc(c.ctaTitle)}</h2><p>${esc(c.ctaBody)}</p></div>${cta}</div></section>`;
  }
  return `<section class="cta cta--banner" id="start"><div class="wrap ctabox"><div class="ctatext"><h2>${esc(c.ctaTitle)}</h2><p>${esc(c.ctaBody)}</p></div>${cta}</div></section>`;
}
