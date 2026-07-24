import type { DesignDNA, PreviewContent, Theme } from '../types.ts';
import { esc } from '../render/render-section.ts';

export const FOOTER_VARIANTS = ['simple'] as const;

export function renderFooter(_variant: string, c: PreviewContent, _t: Theme, _dna: DesignDNA): string {
  return `<footer class="footer"><div class="wrap footin"><span>${esc(c.brandName)}</span><span>معاينة متجاوبة مولّدة من موجز المشروع عبر Design Compiler V1.</span></div></footer>`;
}
