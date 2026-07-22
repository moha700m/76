# Pending uploads

كل ملف JSON هنا يمثل قطعة محتوى واحدة. النظام لا ينشر محتوى فعليًا إلا عند تحقق الشروط التالية:

1. `status` يساوي `pending` أو `partial` أو `failed`.
2. وقت `scheduledAt` حلّ.
3. الحقل `approvedAt` يحتوي تاريخ موافقة صريح.
4. `SOCIAL_PUBLISH_MODE=live` داخل Vercel وGitHub Variable.
5. مفاتيح المنصات المطلوبة موجودة.

وضع `dry-run` يفحص المحتوى والمنصات دون نشر عام. بعد كل نشر، GitHub Action يحدّث `results` داخل الملف ويعمل commit لمنع تكرار النشر.

## المحتوى الجاهز حاليًا

- `marsad-nine-agents-001.json`
- `marsad-idea-to-link-002.json`
- `marsad-site-conversion-003.json`

كل ملف يحتوي العنوان والوصف والوسوم والسيناريو الصوتي واللقطات وCTA. الصور العمودية الجاهزة موجودة داخل `assets/` بمقاس 1080×1920.

الفيديوهات نفسها غير مرفوعة؛ استبدل `videoUrl` برابط HTTPS مباشر من نطاق موثّق قبل الاعتماد.

## إنشاء محتوى جديد

انسخ أحد ملفات JSON الحالية وغيّر:

- `id`: معرف فريد.
- `scheduledAt`: تاريخ ISO مع المنطقة الزمنية.
- `videoUrl`: رابط HTTPS مباشر للفيديو، ويجب أن يكون متاحًا للمنصات.
- `platforms`: المنصات المطلوبة.
- `approvedAt`: اتركه `null` إلى أن تعتمد المحتوى.
- `thumbnailPath`: مسار الصورة المصغرة داخل المشروع.
- `script`: الهوك واللقطات والتعليق الصوتي وCTA.

TikTok Direct Post يحتاج أيضًا `platformSettings.tiktok.userApproved=true`، ويجب أن يكون تطبيق TikTok مدققًا للنشر العام.
