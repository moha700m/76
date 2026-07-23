# مراجعة أمان حزمة أوتوبايلوت نَسَق — OpenAI Codex

هذه النسخة تستخدم OpenAI Codex فقط، ولا تحتوي أي أسرار مضمّنة.

## قبل التفعيل

1. أضف `OPENAI_API_KEY` في **GitHub Actions Secrets**. وجود المفتاح في Vercel وحده لا يجعله متاحاً لـGitHub Actions.
2. `TELEGRAM_BOT_TOKEN` و`TELEGRAM_CHAT_ID` اختياريان؛ عند غيابهما تُتخطى الإشعارات.
3. أضف `PRODUCTION_URL` في GitHub Actions Variables.
4. لا تحتاج تطبيق AI إضافياً في GitHub ولا صلاحية `id-token: write`.
5. شغّل `Autopilot daily` يدوياً أول مرة وراجع أول PR قبل ترك auto-merge مفعلاً.

## تصميم الأمان

- `openai/codex-action@v1` يعمل بـ`safety-strategy: drop-sudo` و`sandbox: workspace-write`.
- Job التوليد بصلاحية `contents: read` فقط، ولا يحصل على GitHub token للكتابة.
- Codex يسلّم Patch محدود الحجم؛ Runner ثانٍ نظيف يطبقه ويفحصه ويشغّل الاختبارات ثم يفتح PR.
- أسرار Telegram تعمل في Runner ثالث مستقل ومن نسخة `main`/base الموثوقة.
- لا تعديل لـ`.github/` أو `AGENTS.md` أو `update.config.json` أو `.env*` أو `scripts/notify.sh` أو ملفات package.
- لا ملفات ثنائية أو symlinks أو submodules في PR الآلي.
- لا WebSearch/curl/wget ولا نشر اجتماعي فعلي ولا تغيير `approvedAt`.
- لا دمج من fork؛ فقط فروع `auto/` داخل المستودع نفسه.

## السر المطلوب

```text
OPENAI_API_KEY
```

أضفه في:

```text
GitHub → Settings → Secrets and variables → Actions → New repository secret
```

لا ترسل قيمة المفتاح في المحادثة ولا تضعه في ملف `.env` داخل المستودع.
