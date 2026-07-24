import type { DesignDNA, PreviewContent, Theme } from '../types.ts';
import { esc } from '../render/render-section.ts';

export const FAQ_VARIANTS = ['accordion', 'list'] as const;

// The 'accordion' variant uses native <details>/<summary> — interactive with NO JavaScript.
export function renderFaq(variant: string, c: PreviewContent, _t: Theme, _dna: DesignDNA): string {
  const faqs = c.faqs.slice(0, 6);
  if (!faqs.length) return '';
  const head = `<div class="section-head"><span class="kicker">FAQ</span><h2>أسئلة يطرحها زوّارك.</h2></div>`;
  if (variant === 'list') {
    const rows = faqs.map(f => `<div class="qa"><b>${esc(f.q)}</b><p>${esc(f.a)}</p></div>`).join('');
    return `<section class="section faq faq--list"><div class="wrap">${head}<div class="qalist">${rows}</div></div></section>`;
  }
  const rows = faqs.map(f => `<details class="qitem"><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('');
  return `<section class="section faq faq--accordion"><div class="wrap">${head}<div class="qacc">${rows}</div></div></section>`;
}
