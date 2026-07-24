// Twelve theme presets + an industry/tone-aware selector.
import type { DesignDNA, Industry, Theme, ThemeId, Tone } from '../types.ts';

export const THEMES: Record<ThemeId, Theme> = {
  'luxury-dark': {
    id: 'luxury-dark', name: 'Luxury Dark', tone: 'luxury', colorMood: 'dark',
    colors: { bg: '#0E0D0B', surface: '#1A1814', text: '#F6F0E4', muted: '#B8AB98', accent: '#C6A15B', accent2: '#E4D3A6', line: '#37302699' },
    headingFont: "'Cairo',serif", bodyFont: "'Noto Sans Arabic',serif", radius: '18px'
  },
  'modern-startup': {
    id: 'modern-startup', name: 'Modern Startup', tone: 'modern', colorMood: 'dark',
    colors: { bg: '#05070B', surface: '#0B111B', text: '#F7FBFF', muted: '#A8B4C3', accent: '#5EE0FF', accent2: '#9D8CFF', line: '#26354866' },
    headingFont: "'Cairo',sans-serif", bodyFont: "'Noto Sans Arabic',sans-serif", radius: '16px'
  },
  'clean-corporate': {
    id: 'clean-corporate', name: 'Clean Corporate', tone: 'corporate', colorMood: 'light',
    colors: { bg: '#F5F7FA', surface: '#FFFFFF', text: '#12212E', muted: '#5B6B7A', accent: '#1E5FBF', accent2: '#3FA7A0', line: '#DCE3EB' },
    headingFont: "'Cairo',sans-serif", bodyFont: "'Noto Sans Arabic',sans-serif", radius: '14px'
  },
  'bold-landing': {
    id: 'bold-landing', name: 'Bold Landing', tone: 'bold', colorMood: 'vibrant',
    colors: { bg: '#0B0B14', surface: '#161222', text: '#FFFFFF', muted: '#B7B0C7', accent: '#FF4D6D', accent2: '#FFC24B', line: '#2A243866' },
    headingFont: "'Cairo',sans-serif", bodyFont: "'Noto Sans Arabic',sans-serif", radius: '22px'
  },
  'warm-local-business': {
    id: 'warm-local-business', name: 'Warm Local Business', tone: 'warm', colorMood: 'warm',
    colors: { bg: '#F3ECDF', surface: '#FFFAF2', text: '#3A2A20', muted: '#78695D', accent: '#B46C3B', accent2: '#6F7D45', line: '#DED2C2' },
    headingFont: "'Cairo',sans-serif", bodyFont: "'Noto Sans Arabic',sans-serif", radius: '16px'
  },
  'creative-studio': {
    id: 'creative-studio', name: 'Creative Studio', tone: 'creative', colorMood: 'vibrant',
    colors: { bg: '#0F0F12', surface: '#18181F', text: '#F4F3FF', muted: '#ADA9C0', accent: '#8B5CF6', accent2: '#22D3EE', line: '#2B2A3666' },
    headingFont: "'Cairo',sans-serif", bodyFont: "'Noto Sans Arabic',sans-serif", radius: '20px'
  },
  'fintech-trust': {
    id: 'fintech-trust', name: 'Fintech Trust', tone: 'corporate', colorMood: 'light',
    colors: { bg: '#F4F7FB', surface: '#FFFFFF', text: '#0C1A2B', muted: '#586A80', accent: '#1B7A6B', accent2: '#2563EB', line: '#DEE7F0' },
    headingFont: "'Cairo',sans-serif", bodyFont: "'Noto Sans Arabic',sans-serif", radius: '14px'
  },
  'beauty-soft': {
    id: 'beauty-soft', name: 'Beauty Soft', tone: 'warm', colorMood: 'light',
    colors: { bg: '#FBF3F2', surface: '#FFFFFF', text: '#3A2530', muted: '#8B6B77', accent: '#C86B8B', accent2: '#E0A85C', line: '#F0DDDF' },
    headingFont: "'Cairo',serif", bodyFont: "'Noto Sans Arabic',sans-serif", radius: '22px'
  },
  'editorial-light': {
    id: 'editorial-light', name: 'Editorial Light', tone: 'creative', colorMood: 'light',
    colors: { bg: '#FAF9F6', surface: '#FFFFFF', text: '#161514', muted: '#6B6862', accent: '#111111', accent2: '#C0592B', line: '#E7E4DD' },
    headingFont: "'Cairo',serif", bodyFont: "'Noto Sans Arabic',serif", radius: '10px'
  },
  'vibrant-pop': {
    id: 'vibrant-pop', name: 'Vibrant Pop', tone: 'bold', colorMood: 'vibrant',
    colors: { bg: '#FFF7EC', surface: '#FFFFFF', text: '#221A2E', muted: '#6E6480', accent: '#7C3AED', accent2: '#FF7A59', line: '#F0E6DB' },
    headingFont: "'Cairo',sans-serif", bodyFont: "'Noto Sans Arabic',sans-serif", radius: '24px'
  },
  'nature-fresh': {
    id: 'nature-fresh', name: 'Nature Fresh', tone: 'warm', colorMood: 'light',
    colors: { bg: '#F1F6EF', surface: '#FFFFFF', text: '#1E2A22', muted: '#5C6E60', accent: '#2F8F5B', accent2: '#B98A34', line: '#DBE7DA' },
    headingFont: "'Cairo',sans-serif", bodyFont: "'Noto Sans Arabic',sans-serif", radius: '18px'
  },
  'royal-emerald': {
    id: 'royal-emerald', name: 'Royal Emerald', tone: 'luxury', colorMood: 'dark',
    colors: { bg: '#07120E', surface: '#0E1F18', text: '#EEF6F0', muted: '#9CB7A8', accent: '#39B98A', accent2: '#D4AF5A', line: '#1C332999' },
    headingFont: "'Cairo',serif", bodyFont: "'Noto Sans Arabic',serif", radius: '18px'
  }
};

const TONE_TO_THEME: Record<Tone, ThemeId> = {
  luxury: 'luxury-dark',
  modern: 'modern-startup',
  corporate: 'clean-corporate',
  bold: 'bold-landing',
  warm: 'warm-local-business',
  creative: 'creative-studio'
};

// Industry preference takes priority so different sectors feel distinct even at the same tone.
const INDUSTRY_TO_THEME: Partial<Record<Industry, ThemeId>> = {
  coffee: 'warm-local-business',
  nursery: 'beauty-soft',
  maintenance: 'fintech-trust',
  retail: 'vibrant-pop',
  clinic: 'fintech-trust',
  realestate: 'royal-emerald',
  restaurant: 'bold-landing',
  agency: 'editorial-light'
};

export function pickThemeId(dna: DesignDNA): ThemeId {
  // Luxury/creative tones keep their signature look; otherwise industry preference wins, then tone.
  if (dna.tone === 'luxury') return dna.industry === 'realestate' ? 'royal-emerald' : 'luxury-dark';
  if (dna.tone === 'creative') return 'creative-studio';
  return INDUSTRY_TO_THEME[dna.industry] || TONE_TO_THEME[dna.tone] || 'modern-startup';
}

export function pickTheme(dna: DesignDNA): Theme {
  return THEMES[pickThemeId(dna)];
}

export function applyPalette(theme: Theme, palette: string[]): Theme {
  const hex = palette.filter(c => /^#[0-9a-f]{6}$/i.test(c));
  if (hex.length < 5) return theme;
  return { ...theme, colors: { ...theme.colors, bg: hex[0], surface: hex[1], text: hex[2], accent: hex[3], accent2: hex[4] } };
}
