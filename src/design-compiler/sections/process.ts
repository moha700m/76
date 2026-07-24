import type { DesignDNA, PreviewContent, Theme } from '../types.ts';
import { esc } from '../render/render-section.ts';

export const PROCESS_VARIANTS = ['timeline', 'steps'] as const;

export function renderProcess(variant: string, c: PreviewContent, _t: Theme, _dna: DesignDNA): string {
  const steps = c.steps.slice(0, 4);
  if (!steps.length) return '';
  const head = `<div class="section-head"><span class="kicker">HOW IT WORKS</span><h2>من الفهم إلى الإجراء.</h2></div>`;
  if (variant === 'steps') {
    const cards = steps.map((s, i) => `<article class="pcard"><span class="pnum">${i + 1}</span><h3>${esc(s.title)}</h3><p>${esc(s.desc)}</p></article>`).join('');
    return `<section class="section process process--steps"><div class="wrap">${head}<div class="pcards">${cards}</div></div></section>`;
  }
  const rows = steps.map((s, i) => `<li class="pstep"><span class="pdot">${i + 1}</span><div><b>${esc(s.title)}</b><small>${esc(s.desc)}</small></div></li>`).join('');
  return `<section class="section process process--timeline"><div class="wrap">${head}<ol class="ptimeline">${rows}</ol></div></section>`;
}
