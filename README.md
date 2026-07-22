# مرصد تسعة Pro

استوديو عربي لتشغيل **9 وكلاء ذكاء اصطناعي متخصصين** في تحليل الموجز، البحث، استراتيجية المنتج، ذاكرة العلامة، تجربة المستخدم، الواجهة، الكفاءة، الجودة والنقد المنافس. بعد انتهاء الجولة يدمج المنسق النتائج ويولّد معاينة موقع RTL متجاوبة وقابلة للمشاركة.

## الوظائف

- تسجيل دخول عبر Google وApple وX.
- مشاريع منفصلة لكل مستخدم.
- 9 وكلاء يعملون في 3 موجات.
- تحديث مباشر عبر WebSocket.
- حفظ ذاكرة القرارات المعتمدة.
- تفسير درجة الجودة والثقة.
- استكمال الدمج عند توقف مرحلة 95% دون إعادة الوكلاء.
- توليد لوحة اتجاه بصري.
- توليد موقع HTML كامل للعميل ورابط عام.
- تصدير تقرير Markdown.
- حماية ملكية المشاريع ومسارات التخزين.

## البنية

```text
src/
  App.tsx             تحديد صفحة الاستوديو أو المعاينة العامة
  Studio.tsx          الواجهة ورحلة المستخدم وإدارة المشاريع
  PreviewPage.tsx     عرض معاينات العملاء داخل إطار آمن
  index.css           الهوية البصرية والاستجابة
backend/
  app-routes.ts       API المشاريع والتشغيل والقرارات والمعاينات
  design-agents.ts    تعريف الوكلاء والمخططات والدمج والدرجة
  site-preview.ts     توليد HTML وتعقيمه والمعاينة الاحتياطية
  realtime-*.ts       الاشتراكات والتحديث المباشر
  index.ts            نقطة دخول الخادم
```

## التشغيل

هذه النسخة هي **سورس AppDeploy الكامل**. الوحدتان `@appdeploy/client` و`@appdeploy/sdk` توفرهما منصة AppDeploy أثناء النشر؛ لذلك رفع المشروع إلى GitHub يحفظ المصدر والإصدارات، لكن تشغيل الخلفية على Vercel مباشرة يحتاج ترحيل خدمات:

- Authentication
- Database
- Storage
- WebSocket
- AI generation/scraping/image generation

راجع [DEPLOYMENT.md](./DEPLOYMENT.md).

### فحص الواجهة محليًا

```bash
npm install
npm run typecheck
```

تشغيل `npm run dev` خارج AppDeploy يحتاج موائمًا محليًا لـ `@appdeploy/client` أو ربط المشروع بمنصة AppDeploy.

## رفعه إلى GitHub

```bash
git init
git add .
git commit -m "Initial release: Marsad Tisaa Pro"
git branch -M main
git remote add origin https://github.com/USERNAME/REPOSITORY.git
git push -u origin main
```

## النسخة الحية المرجعية

- AppDeploy app id: `441a4987f6936b832e`
- Source snapshot: `1784740090380`

لا تضع مفاتيح أو رموز تحقق داخل المستودع. استخدم مدير الأسرار في منصة النشر.

## التحديثات المستقبلية دون رفع ZIP

بعد الرفع الأول وربط GitHub بـVercel، استخدم نظام التحديث المرفق:

```bash
npm run release -- "وصف التحديث"
```

ينشئ نسخة احتياطية، يشغّل الفحوصات، يرفع التغيير إلى GitHub، ثم يلتقطه Vercel تلقائيًا. راجع [UPDATE_SYSTEM.md](./UPDATE_SYSTEM.md).
