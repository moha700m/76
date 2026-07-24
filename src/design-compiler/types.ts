// Design Compiler V1 — shared types (erasable TypeScript only: no enums/namespaces).

export type Industry =
  | 'coffee' | 'nursery' | 'maintenance' | 'retail'
  | 'clinic' | 'realestate' | 'restaurant' | 'agency' | 'generic';

export type Tone = 'luxury' | 'modern' | 'corporate' | 'bold' | 'warm' | 'creative';
export type ColorMood = 'dark' | 'light' | 'warm' | 'vibrant' | 'muted';
export type SectionKind = 'hero' | 'services' | 'testimonials' | 'cta' | 'footer';

export type ThemeId =
  | 'luxury-dark' | 'modern-startup' | 'clean-corporate'
  | 'bold-landing' | 'warm-local-business' | 'creative-studio';

export interface DesignDNA {
  industry: Industry;
  audience: string;
  tone: Tone;
  goal: string;
  colorMood: ColorMood;
  sectionsNeeded: SectionKind[];
  rtl: boolean;
}

export interface ThemeColors {
  bg: string; surface: string; text: string; muted: string;
  accent: string; accent2: string; line: string;
}

export interface Theme {
  id: ThemeId;
  name: string;
  tone: Tone;
  colorMood: ColorMood;
  colors: ThemeColors;
  headingFont: string;
  bodyFont: string;
  radius: string;
}

// Normalized content the sections render. Derived from the project brief and (when present)
// the saved council synthesis — never fabricated beyond what the project provides.
export interface PreviewContent {
  brandName: string;
  tagline: string;
  heroTitle: string;
  heroBody: string;
  primaryCta: string;
  secondaryCta: string;
  services: Array<{ title: string; body: string }>;
  testimonials: Array<{ quote: string; author: string }>;
  ctaTitle: string;
  ctaBody: string;
  footerLine: string;
  navigation: string[];
}

export interface SectionConfig {
  kind: SectionKind;
  variant: string;
}

export interface PageConfig {
  dna: DesignDNA;
  theme: Theme;
  content: PreviewContent;
  sections: SectionConfig[];
  meta: { title: string; brandName: string; lang: string; dir: 'rtl' | 'ltr' };
}

// Minimal shape the compiler accepts (a subset of the backend SitePreviewProject).
export interface PreviewProject {
  name: string;
  brief: string;
  audience: string;
  goal: string;
  style: string;
  synthesis?: Record<string, unknown> | null;
}
