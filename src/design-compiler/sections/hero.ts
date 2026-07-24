import type { DesignDNA, PreviewContent, Theme } from '../types.ts';
import { esc, button, chip } from '../render/render-section.ts';

export const HERO_VARIANTS = ['split', 'centered', 'minimal', 'showcase'] as const;

export function renderHero(variant: string, c: PreviewContent, _t: Theme, dna: DesignDNA): string {
  const actions = `<div class="actions">${button(c.primaryCta, '#start')}${button(c.secondaryCta, '#offer', 'ghost')}</div>`;
  const tag = `<span class="tag">${esc(c.tagline)}</span>`;
  const title = `<h1>${esc(c.heroTitle)}</h1>`;
  const body = `<p class="lead">${esc(c.heroBody)}</p>`;
  const panel = `<div class="visual"><div class="panel"><small>${esc(dna.tone)}</small><strong>${esc(c.brandName)}</strong><p>مصمم لـ ${esc(dna.audience)}</p></div></div>`;

  if (variant === 'centered') {
    return section(`<div class="wrap hero-centered">${tag}${title}${body}${actions}</div>`, 'hero--centered');
  }
  if (variant === 'minimal') {
    return section(`<div class="wrap hero-minimal">${title}${body}${actions}</div>`, 'hero--minimal');
  }
  if (variant === 'showcase') {
    return section(`<div class="wrap hero-grid">${panel}<div class="hero-copy">${tag}${title}${body}${actions}</div></div>`, 'hero--showcase');
  }
  // default: split (copy + visual)
  return section(`<div class="wrap hero-grid"><div class="hero-copy">${tag}${title}${body}${actions}</div>${panel}</div>`, 'hero--split');
}

function section(inner: string, mod: string): string {
  return `<section class="hero ${mod}" id="top">${inner}</section>`;
}
