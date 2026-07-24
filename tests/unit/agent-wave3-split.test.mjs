import test from 'node:test';
import assert from 'node:assert/strict';
import {
  callOpenAISynthesis,
  callOpenAIWave3,
  validateSynthesisRequest,
  validateWave3Request
} from '../../api/_lib/nasq-wave3-split.js';

const project = {
  name: 'أثر القهوة',
  brief: 'متجر قهوة مختصة سعودي يقدم تجربة شراء واضحة ومخصصة.',
  audience: 'محبو القهوة المختصة',
  goal: 'زيادة الطلبات',
  style: 'ورقي دافئ عاجي وبني وزيتوني',
  references: [],
  evidence: [],
  memories: []
};

function prior(count) {
  return Array.from({ length: count }, (_, index) => ({
    agentId: `agent-${index}`,
    name: `وكيل ${index}`,
    summary: 'ملخص واضح',
    findings: ['نتيجة 1', 'نتيجة 2', 'نتيجة 3'],
    decisions: ['قرار 1', 'قرار 2'],
    deliverable: 'تسليم قابل للتنفيذ',
    confidence: 85
  }));
}

function jsonResponse(payload) {
  return {
    ok: true,
    status: 200,
    headers: { get: () => null },
    json: async () => ({ output_text: JSON.stringify(payload), usage: { input_tokens: 10, output_tokens: 20, total_tokens: 30 } })
  };
}

test('wave 3 requires exactly six previous outputs', () => {
  assert.throws(() => validateWave3Request({ project, previousOutputs: prior(5) }), /6/);
  const value = validateWave3Request({ project, previousOutputs: prior(6), requestId: 'wave3-test' });
  assert.equal(value.previousOutputs.length, 6);
});

test('final synthesis requires exactly nine outputs', () => {
  assert.throws(() => validateSynthesisRequest({ project, previousOutputs: prior(8) }), /9/);
  const value = validateSynthesisRequest({ project, previousOutputs: prior(9), requestId: 'synthesis-test' });
  assert.equal(value.previousOutputs.length, 9);
});

test('wave 3 returns only the final three agent outputs', async () => {
  const ids = ['efficiency-router', 'quality-evaluator', 'challenger'];
  const result = await callOpenAIWave3(validateWave3Request({ project, previousOutputs: prior(6), requestId: 'wave3-test' }), {
    apiKey: 'test-key',
    fetchImpl: async () => jsonResponse({
      outputs: ids.map(agentId => ({
        agentId,
        summary: 'تحليل محدد للمشروع',
        findings: ['نتيجة 1', 'نتيجة 2', 'نتيجة 3'],
        decisions: ['قرار 1', 'قرار 2'],
        deliverable: 'تسليم تنفيذي',
        confidence: 88
      }))
    }),
    sleepImpl: async () => {}
  });
  assert.deepEqual(result.outputs.map(item => item.agentId), ids);
  assert.equal('synthesis' in result, false);
});

test('synthesis call returns validated public content after 9/9', async () => {
  const synthesis = {
    executiveSummary: 'ملخص تنفيذي',
    positioning: 'تموضع واضح',
    designDirection: 'اتجاه بصري دافئ',
    primaryJourney: ['فهم العرض', 'استكشاف المنتجات', 'اختيار المنتج', 'إتمام الطلب'],
    pages: Array.from({ length: 4 }, (_, index) => ({ name: `صفحة ${index + 1}`, purpose: 'غرض واضح', sections: ['قسم 1', 'قسم 2', 'قسم 3'] })),
    designSystem: {
      palette: ['#F3ECDF', '#FFFAF2', '#3A2A20', '#6F7D45', '#B46C3B'],
      typography: ['عنوان عربي', 'نص عربي'],
      components: ['تنقل', 'Hero', 'بطاقات', 'خطوات', 'CTA', 'تذييل'],
      motion: ['ظهور خفيف', 'حركة وظيفية']
    },
    conversionPlan: ['إجراء واضح', 'قيمة قبل التفاصيل', 'رحلة قصيرة'],
    risks: ['نقص بعض التفاصيل', 'عدم اختراع بيانات'],
    acceptanceCriteria: ['توافق الجوال', 'تباين جيد', 'محتوى عربي', 'خمسة أقسام', 'هوية مخصصة', 'رابط يعمل'],
    nextActions: ['بناء المعاينة', 'مراجعة المحتوى', 'اعتماد النتيجة'],
    publicContent: {
      brandName: 'أثر القهوة',
      navigation: ['الرئيسية', 'المحاصيل', 'قصتنا'],
      hero: { eyebrow: 'قهوة سعودية', title: 'أثر يبدأ من الحبة', body: 'تجربة قهوة مختصة بهوية دافئة.', primaryCta: 'استكشف المحاصيل', secondaryCta: 'اعرف قصتنا' },
      visualMotif: 'ملمس ورقي دافئ',
      sections: Array.from({ length: 5 }, (_, index) => ({ kicker: `تفصيل ${index + 1}`, title: `قسم ${index + 1}`, body: 'محتوى خاص بالمشروع.', items: ['عنصر 1', 'عنصر 2'] })),
      closing: { title: 'اختر أثرك', body: 'ابدأ رحلتك مع القهوة المختصة.', cta: 'ابدأ الطلب' },
      footerLine: 'أثر القهوة'
    }
  };
  const result = await callOpenAISynthesis(validateSynthesisRequest({ project, previousOutputs: prior(9), requestId: 'synthesis-test' }), {
    apiKey: 'test-key',
    fetchImpl: async () => jsonResponse({ synthesis }),
    sleepImpl: async () => {}
  });
  assert.equal(result.synthesis.publicContent.sections.length, 5);
});
