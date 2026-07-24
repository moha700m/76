// Design Compiler V1: DesignDNA -> theme + section plan + per-section variant -> unified PageConfig.
import type { DesignDNA, PageConfig, PreviewProject, SectionConfig, SectionKind } from './types.ts';
import { buildContent, deriveDesignDNA, hashString } from './design-dna.ts';
import { applyPalette, pickTheme } from './presets/themes.ts';
import { HERO_VARIANTS } from './sections/hero.ts';
import { SERVICES_VARIANTS } from './sections/services.ts';
import { TESTIMONIALS_VARIANTS } from './sections/testimonials.ts';
import { CTA_VARIANTS } from './sections/cta.ts';
import { FOOTER_VARIANTS } from './sections/footer.ts';

const VARIANTS: Record<SectionKind, readonly string[]> = {
  hero: HERO_VARIANTS,
  services: SERVICES_VARIANTS,
  testimonials: TESTIMONIALS_VARIANTS,
  cta: CTA_VARIANTS,
  footer: FOOTER_VARIANTS
};

// Deterministic: the same DNA always yields the same variant, different projects diverge.
export function chooseVariant(kind: SectionKind, dna: DesignDNA): string {
  const list = VARIANTS[kind];
  const seed = hashString(`${dna.industry}|${dna.tone}|${dna.colorMood}|${dna.goal}|${kind}`);
  return list[seed % list.length];
}

function paletteFromSynthesis(project: PreviewProject): string[] {
  const s = (project.synthesis || {}) as Record<string, unknown>;
  const ds = (s.designSystem && typeof s.designSystem === 'object' ? s.designSystem : {}) as Record<string, unknown>;
  return Array.isArray(ds.palette) ? ds.palette.filter(x => typeof x === 'string') as string[] : [];
}

export function compilePage(project: PreviewProject): PageConfig {
  const dna = deriveDesignDNA(project);
  const content = buildContent(project, dna);
  let theme = pickTheme(dna);
  const palette = paletteFromSynthesis(project);
  if (palette.length >= 5) theme = applyPalette(theme, palette);

  const sections: SectionConfig[] = dna.sectionsNeeded.map(kind => ({ kind, variant: chooseVariant(kind, dna) }));

  return {
    dna,
    theme,
    content,
    sections,
    meta: {
      title: content.brandName,
      brandName: content.brandName,
      lang: 'ar',
      dir: dna.rtl ? 'rtl' : 'ltr'
    }
  };
}
