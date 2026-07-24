// Six theme presets. Each maps a tone/colorMood to a concrete palette + typography.
import type { DesignDNA, Theme, ThemeId, Tone } from '../types.ts';

export const THEMES: Record<ThemeId, Theme> = {
  'luxury-dark': {
    id: 'luxury-dark', name: 'Luxury Dark', tone: 'luxury', colorMood: 'dark',
    colors: { bg: '#0E0D0B', surface: '#1A1814', text: '#F6F0E4', muted: '#B8AB98', accent: '#B99352', accent2: '#D8C7A1', line: '#373026' },
    headingFont: "'Cairo',serif", bodyFont: "'Noto Sans Arabic',serif", radius: '18px'
  },
  'modern-startup': {
    id: 'modern-startup', name: 'Modern Startup', tone: 'modern', colorMood: 'dark',
    colors: { bg: '#05070B', surface: '#0A0E15', text: '#F7FBFF', muted: '#A8B4C3', accent: '#73E7FF', accent2: '#9D8CFF', line: '#263548' },
    headingFont: "'Cairo',sans-serif", bodyFont: "'Noto Sans Arabic',sans-serif", radius: '16px'
  },
  'clean-corporate': {
    id: 'clean-corporate', name: 'Clean Corporate', tone: 'corporate', colorMood: 'light',
    colors: { bg: '#F5F7FA', surface: '#FFFFFF', text: '#12212E', muted: '#5B6B7A', accent: '#1E5FBF', accent2: '#3FA7A0', line: '#DCE3EB' },
    headingFont: "'Cairo',sans-serif", bodyFont: "'Noto Sans Arabic',sans-serif", radius: '12px'
  },
  'bold-landing': {
    id: 'bold-landing', name: 'Bold Landing', tone: 'bold', colorMood: 'vibrant',
    colors: { bg: '#0B0B14', surface: '#15121F', text: '#FFFFFF', muted: '#B7B0C7', accent: '#FF4D6D', accent2: '#FFC24B', line: '#2A2438' },
    headingFont: "'Cairo',sans-serif", bodyFont: "'Noto Sans Arabic',sans-serif", radius: '22px'
  },
  'warm-local-business': {
    id: 'warm-local-business', name: 'Warm Local Business', tone: 'warm', colorMood: 'warm',
    colors: { bg: '#F3ECDF', surface: '#FFFAF2', text: '#3A2A20', muted: '#78695D', accent: '#6F7D45', accent2: '#B46C3B', line: '#DED2C2' },
    headingFont: "'Cairo',sans-serif", bodyFont: "'Noto Sans Arabic',sans-serif", radius: '16px'
  },
  'creative-studio': {
    id: 'creative-studio', name: 'Creative Studio', tone: 'creative', colorMood: 'vibrant',
    colors: { bg: '#0F0F12', surface: '#17171C', text: '#F4F3FF', muted: '#ADA9C0', accent: '#8B5CF6', accent2: '#22D3EE', line: '#2B2A36' },
    headingFont: "'Cairo',sans-serif", bodyFont: "'Noto Sans Arabic',sans-serif", radius: '20px'
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

export function pickThemeId(dna: DesignDNA): ThemeId {
  return TONE_TO_THEME[dna.tone] || 'modern-startup';
}

export function pickTheme(dna: DesignDNA): Theme {
  return THEMES[pickThemeId(dna)];
}

// Optional: apply a saved palette (5 hex values) from synthesis.designSystem onto a theme.
export function applyPalette(theme: Theme, palette: string[]): Theme {
  const hex = palette.filter(c => /^#[0-9a-f]{6}$/i.test(c));
  if (hex.length < 5) return theme;
  return {
    ...theme,
    colors: { ...theme.colors, bg: hex[0], surface: hex[1], text: hex[2], accent: hex[3], accent2: hex[4] }
  };
}
