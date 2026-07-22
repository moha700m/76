# النشر

## المسار المعتمد حاليًا: GitHub + AppDeploy

1. ارفع هذا المستودع إلى GitHub ليكون النسخة المرجعية والاحتياطية.
2. عند تعديل التطبيق استخدم ملفات `src/` و`backend/` في AppDeploy.
3. شغّل اختبارات الصفحة الرئيسية، تسجيل الدخول، تشغيل الوكلاء، الاستكمال عند 95%، المعاينة العامة والجوال.
4. احتفظ برقم الإصدار المطبق للرجوع السريع.

## Vercel

Vercel يستطيع استضافة واجهة React، لكنه لا يشغّل `@appdeploy/sdk` كما هو. ملف `vercel.json` الموجود مناسب لمسارات SPA فقط، وليس ترحيل الخلفية.

لنقل التطبيق كاملًا إلى Vercel يلزم استبدال:

- AppDeploy Auth بـ Auth.js أو Supabase Auth.
- AppDeploy DB بـ Postgres/Supabase.
- AppDeploy Storage بـ Supabase Storage أو S3.
- AppDeploy WebSocket بـ Supabase Realtime أو خدمة WebSocket.
- AppDeploy AI بـ OpenAI API في مسارات خادم Vercel.

لا تعتمد نشر Vercel كنسخة مستقلة قبل إتمام هذه الموائمات واختبار بيانات المستخدمين.
