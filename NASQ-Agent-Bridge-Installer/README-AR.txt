NASQ Agent Bridge Installer

1) تأكد في GitHub Desktop أن الفرع الحالي هو:
   agent/sync-appdeploy-live-fix
2) تأكد أنه لا توجد تغييرات محلية غير محفوظة.
3) ضع مجلد NASQ-Agent-Bridge-Installer كاملًا داخل جذر مستودع 76 بجانب .git.
4) شغّل INSTALL-NASQ-AGENT-BRIDGE.cmd.
5) سيقوم المثبت تلقائيًا بـ:
   - إنشاء نسخة احتياطية في Documents\NASQ-backups
   - إضافة Vercel Agent Bridge الآمن
   - إضافة اختبارات الوحدة
   - ربط مصدر AppDeploy بالجسر
   - تشغيل npm run check
   - عمل Commit وPush إلى نفس الفرع
6) لا تعمل Merge. انتظر فحص Vercel Preview.

لا تضع أي مفتاح أو سر داخل الملفات أو المحادثة.
