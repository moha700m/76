// Shared, safe render primitives used by every section (leaf module — no section imports).
import type { SectionConfig, Theme, PreviewContent, DesignDNA } from '../types.ts';
import { renderHero } from '../sections/hero.ts';
import { renderServices } from '../sections/services.ts';
import { renderTestimonials } from '../sections/testimonials.ts';
import { renderCta } from '../sections/cta.ts';
import { renderFooter } from '../sections/footer.ts';
import { renderHighlights } from '../sections/highlights.ts';
import { renderGallery } from '../sections/gallery.ts';
import { renderProcess } from '../sections/process.ts';
import { renderFaq } from '../sections/faq.ts';

export function esc(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, ch =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[ch] || ch));
}

export function button(label: string, href: string, kind: 'primary' | 'ghost' = 'primary'): string {
  const cls = kind === 'primary' ? 'btn' : 'ghost';
  return `<a class="${cls}" href="${esc(href)}">${esc(label)}</a>`;
}

export function chip(text: string): string {
  return `<span class="chip">${esc(text)}</span>`;
}

// Dispatch one section config to its section renderer.
export function renderSection(cfg: SectionConfig, content: PreviewContent, theme: Theme, dna: DesignDNA): string {
  switch (cfg.kind) {
    case 'hero': return renderHero(cfg.variant, content, theme, dna);
    case 'highlights': return renderHighlights(cfg.variant, content, theme, dna);
    case 'gallery': return renderGallery(cfg.variant, content, theme, dna);
    case 'process': return renderProcess(cfg.variant, content, theme, dna);
    case 'faq': return renderFaq(cfg.variant, content, theme, dna);
    case 'services': return renderServices(cfg.variant, content, theme, dna);
    case 'testimonials': return renderTestimonials(cfg.variant, content, theme, dna);
    case 'cta': return renderCta(cfg.variant, content, theme, dna);
    case 'footer': return renderFooter(cfg.variant, content, theme, dna);
    default: return '';
  }
}
