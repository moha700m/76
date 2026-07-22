# Vercel + AppDeploy Bridge

هذا المشروع يعمل بوضع هجين:

- **Vercel:** الواجهة التسويقية، التحليلات، Speed Insights، صفحات العرض العامة.
- **AppDeploy:** تسجيل الدخول، قاعدة البيانات، WebSocket، الوكلاء التسعة، الصور، ومعاينات العملاء.

## سبب الخطأ السابق

حزم `@appdeploy/client` و`@appdeploy/sdk` تُحقن تلقائيًا داخل AppDeploy ولا تُنشر في npm. لذلك كان Vercel يفشل عند بناء الواجهة.

## الإصلاح

أثناء بناء Vercel فقط، يوجّه `vite.config.ts` استيراد `@appdeploy/client` إلى محول محلي آمن داخل:

`src/platform/appdeploy-client-vercel.ts`

المحول يسمح بعرض الصفحة والمنهجية، ويوجّه تسجيل الدخول وبدء المشاريع إلى نطاق AppDeploy الأصلي. المعاينات داخل Vercel تُعرض من AppDeploy داخل iframe دون نقل الأسرار أو منطق الوكلاء إلى المتصفح.

أثناء بناء AppDeploy لا يعمل هذا alias، وتبقى الحزمة الأصلية ووظائف المنصة كما هي.
