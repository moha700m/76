// Industry-specific hints that steer section content and hero angle.
import type { Industry, Tone } from '../types.ts';

export interface IndustryRule {
  preferredTone: Tone;
  heroAngle: string;
  proof: boolean; // whether testimonials/proof section is meaningful
}

export const INDUSTRY_RULES: Record<Industry, IndustryRule> = {
  coffee: { preferredTone: 'warm', heroAngle: 'تجربة قهوة مختصة بهوية دافئة', proof: true },
  nursery: { preferredTone: 'warm', heroAngle: 'بيئة آمنة وبرامج تناسب طفلك', proof: true },
  maintenance: { preferredTone: 'corporate', heroAngle: 'خدمة صيانة موثوقة وسريعة', proof: true },
  retail: { preferredTone: 'modern', heroAngle: 'متجر واضح يقودك للشراء بثقة', proof: true },
  clinic: { preferredTone: 'corporate', heroAngle: 'رعاية طبية موثوقة وحجز سهل', proof: true },
  realestate: { preferredTone: 'luxury', heroAngle: 'وحدات مختارة وتجربة عرض راقية', proof: true },
  restaurant: { preferredTone: 'bold', heroAngle: 'تجربة طعام تفتح الشهية للحجز', proof: true },
  agency: { preferredTone: 'creative', heroAngle: 'استوديو يحوّل الفكرة إلى نتيجة', proof: true },
  generic: { preferredTone: 'modern', heroAngle: 'تجربة واضحة تقود جمهورك للإجراء', proof: false }
};

export function ruleFor(industry: Industry): IndustryRule {
  return INDUSTRY_RULES[industry] || INDUSTRY_RULES.generic;
}
