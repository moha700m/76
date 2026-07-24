import test from 'node:test';
import assert from 'node:assert/strict';
import { compilePage, chooseVariant } from '../../src/design-compiler/compiler.ts';
import { deriveDesignDNA, sectionsForIndustry } from '../../src/design-compiler/design-dna.ts';
import { renderPreviewFromProject } from '../../src/design-compiler/render/render-page.ts';
import { HERO_VARIANTS } from '../../src/design-compiler/sections/hero.ts';
import { THEMES } from '../../src/design-compiler/presets/themes.ts';

const coffee = { name: 'أثر القهوة', brief: 'متجر قهوة مختصة سعودي', audience: 'محبو القهوة', goal: 'زيادة الطلبات', style: 'ورقي دافئ عاجي وبني زيتوني' };
const startupTech = { name: 'Nova', brief: 'منصة تقنية داكنة', audience: 'شركات', goal: 'حجوزات', style: 'تقني داكن سماوي بنفسجي نيون' };
const clinic = { name: 'عيادة', brief: 'عيادة أسنان طبية', audience: 'مرضى', goal: 'حجز موعد', style: 'مؤسسي رسمي نظيف' };
const luxury = { name: 'دار', brief: 'عقار فاخر', audience: 'مستثمرون', goal: 'حجز معاينة', style: 'فاخر ذهبي أسود' };

test('twelve theme presets exist', () => {
  const ids = Object.keys(THEMES).sort();
  assert.deepEqual(ids, ['beauty-soft','bold-landing','clean-corporate','creative-studio','editorial-light','fintech-trust','luxury-dark','modern-startup','nature-fresh','royal-emerald','vibrant-pop','warm-local-business'].sort());
});

test('theme selection follows tone derived from style', () => {
  assert.equal(compilePage(coffee).theme.id, 'warm-local-business');
  assert.equal(compilePage(startupTech).theme.id, 'modern-startup');
  assert.equal(compilePage(clinic).theme.id, 'fintech-trust');
  assert.equal(compilePage(luxury).theme.id, 'royal-emerald');
});

test('section selection: proof industries include testimonials, generic stays lean', () => {
  assert.ok(sectionsForIndustry('coffee').includes('testimonials'));
  assert.ok(!sectionsForIndustry('generic').includes('testimonials'));
  // every plan always has hero, cta and footer
  for (const ind of ['coffee','generic','clinic','retail']) {
    const s = sectionsForIndustry(ind);
    assert.ok(s.includes('hero') && s.includes('cta') && s.includes('footer'));
  }
});

test('compilePage returns a coherent page config', () => {
  const page = compilePage(coffee);
  assert.equal(page.meta.dir, 'rtl');
  assert.equal(page.sections[0].kind, 'hero');
  assert.equal(page.sections[page.sections.length - 1].kind, 'footer');
  assert.ok(HERO_VARIANTS.includes(page.sections[0].variant));
});

test('output differs by project type (theme + html)', () => {
  const a = renderPreviewFromProject(coffee);
  const b = renderPreviewFromProject(startupTech);
  assert.notEqual(a, b);
  assert.notEqual(compilePage(coffee).theme.id, compilePage(startupTech).theme.id);
});

test('preview is not broken: valid RTL html, mobile viewport, no scripts', () => {
  const html = renderPreviewFromProject(clinic);
  assert.ok(html.startsWith('<!doctype html'), 'has doctype');
  assert.ok(/<html[^>]*dir="rtl"/i.test(html), 'RTL direction');
  assert.ok(/<\/html>/i.test(html), 'closed html');
  assert.ok(/width=device-width/i.test(html), 'mobile viewport');
  assert.equal(/<script/i.test(html), false, 'no script tags');
  assert.ok(html.length > 1200, 'non-trivial output');
});

test('variant selection is deterministic for the same DNA', () => {
  const dna = deriveDesignDNA(coffee);
  assert.equal(chooseVariant('hero', dna), chooseVariant('hero', dna));
  assert.equal(compilePage(coffee).sections[0].variant, compilePage(coffee).sections[0].variant);
});

test('user content is HTML-escaped (no injection)', () => {
  const evil = { name: '<script>alert(1)</script>', brief: 'x', audience: 'y', goal: 'z', style: 'حديث' };
  const html = renderPreviewFromProject(evil);
  assert.equal(/<script/i.test(html), false, 'raw script must not appear');
  assert.ok(html.includes('&lt;script&gt;'), 'name is escaped');
});

test('saved synthesis palette overrides theme colors', () => {
  const withPalette = { ...coffee, synthesis: { designSystem: { palette: ['#111111','#222222','#333333','#444444','#555555'] } } };
  const page = compilePage(withPalette);
  assert.equal(page.theme.colors.bg, '#111111');
  assert.equal(page.theme.colors.accent, '#444444');
});
