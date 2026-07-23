# AUTOPILOT.md — دمج الموظف الآلي في نَسَق

> هذا الملف اسمه `AUTOPILOT.md` وليس `SETUP.md` لأن `SETUP.md` موجود عندك
> ويشرح مفاتيح النشر — لا تستبدله.

## نتيجة الفحص: ينفع الدمج، بدون تعارض

| الملف | الحالة |
|---|---|
| `AGENTS.md` | جديد ✅ |
| `AUTOPILOT.md` | جديد ✅ |
| `.agent/STATE.md` · `.agent/JOURNAL.md` | جديد ✅ |
| `scripts/notify.sh` | جديد ✅ (المجلد موجود، الملف لا) |
| `.github/workflows/autopilot.yml` | جديد ✅ |
| `.github/workflows/autopilot-merge.yml` | جديد ✅ |
| `.github/workflows/health-probe.yml` | جديد ✅ |
| ~~`ROADMAP.md`~~ | **أُلغي** — `backlog.md` عندك أفضل منه |
| ~~`SETUP.md`~~ | **أُلغي** — لا نلمس ملفك |

### تعديل واحد على ملف موجود
في `.github/workflows/failure-alert.yml` أضف السطرين تحت `workflows:`
عشان تنبيهات الفشل تشمل الأوتوبايلوت:

```yaml
      - Autopilot daily
      - Production health probe
```

## ما غيّرته عشان يناسب مشروعك بالذات

1. **`backlog.md` بدل ROADMAP.** الأوتوبايلوت يختار مهامه من ملفك،
   ويلتزم بقاعدتك: عند إنجاز مهمة يضيف مهمتين — يبقى 20 مفتوحة.
2. **فحص مزدوج.** Runner نظيف يطبّق Patch ويشغّل `content:validate` و`check`
   قبل فتح الـPR، ثم `Quality gate` يعيد الفحص على الـPR. ملف
   `autopilot-merge.yml` يفحص الحدود ويفعّل `gh pr merge --auto`.
3. **Node 22 و `npm install --ignore-scripts` و `npm run check`** — مطابق
   لـ `ci.yml` عندك، مو الأوامر العامة.
4. **`dependabot-automerge.yml` ما يتعارض** — شرطه `actor == dependabot`،
   وشرطي `head_ref` يبدأ بـ `auto/`. متنافيان.
5. **`health-probe.yml` يفحص `/api/health`** الموجود عندك فعلاً، وهو تنفيذ
   جزئي لمهمة `OBS-001` في backlog.
6. **حارس إضافي خاص بك:** أي PR يحاول يحوّل `SOCIAL_PUBLISH_MODE` إلى
   `live` يُرفض آلياً.

## القيد الكبير الذي لازم تعرفه

خلفيتك تعمل على **AppDeploy SDK**، وهي غير موجودة في CI. يعني:

- الأوتوبايلوت **يقدر** يشتغل بثقة على: `src/`, `api/`, `lib/`, `scripts/`,
  `tests/`, المحتوى، التوثيق، الأداء، SEO، والـ workflows التشغيلية.
- الأوتوبايلوت **يقدر يعدّل لكن ما يقدر يختبر**: `backend/` — ومنه
  الوكلاء التسعة نفسهم.

هذا مكتوب صراحة في `AGENTS.md` القسم 3، والموظف مُلزم يذكر في كل PR
ما لم يستطع اختباره. لكن لو تبي يشتغل على قلب المنتج بأمان، أفضل خطوة
لاحقة: adapter محلي لـ `@appdeploy/client` يخلي `backend/` قابل للاختبار.


## تعديلات الأمان في نسخة OpenAI Codex

- استخدام `actions/checkout@v6` و`actions/setup-node@v6` بدل الإصدارات غير الموجودة `v7`.
- منع الفروع الخارجية من دخول مسار الدمج التلقائي.
- منع الأوتوبايلوت من تعديل `scripts/notify.sh` أو ملفات الـworkflows ثم تشغيلها مع أسرار.
- تمرير عنوان الـPR عبر متغير بيئة لمنع حقن أوامر Shell.
- منع الشبكة داخل مهمة Codex، وعدم منحه رمز GitHub بصلاحية كتابة.
- تحديد `effort: medium` وحد أقصى 600KB للـPatch لتقليل التكلفة والانجراف.
- منع تكرار Issue فشل الإنتاج كل ثلاث ساعات.

## التركيب — 5 خطوات

**1. Secrets** (`Settings → Secrets and variables → Actions`)

| الاسم | القيمة |
|---|---|
| `OPENAI_API_KEY` | مفتاح OpenAI API — نفس المفتاح المستخدم خادمياً، لكن يُضاف أيضاً في GitHub Actions Secrets |
| `TELEGRAM_BOT_TOKEN` | من @BotFather |
| `TELEGRAM_CHAT_ID` | معرّف قناتك |

وفي تبويب **Variables**: `PRODUCTION_URL` = رابط موقعك على Vercel.

**2. صلاحيات** — `Settings → Actions → General`:
- ✅ Read and write permissions
- ✅ Allow GitHub Actions to create and approve pull requests

**3. حماية `main`** — `Settings → Branches`:
- ✅ Require status checks → اختر `source-checks`
- ✅ Allow auto-merge (من `Settings → General`)
- ❌ لا تفعّل Require approvals — يوقف الأتمتة

**4. أول تشغيل يدوي** — `Actions → Autopilot daily → Run workflow`.
أول دورة راح تقضيها في قراءة `backend/design-agents.ts` وتعبئة
`.agent/STATE.md`. راجع أول PR بنفسك قبل ما تخليه يمشي لحاله.

**5. عدّل سطر واحد** في `backlog.md`: أضف قسم في أوله باسم
`## من المالك` وحط فيه اللي تبيه أول شي — هذا مدخلك للتوجيه من الجوال.

## كيف تتدخل لاحقاً

| تبغى | سوّ |
|---|---|
| توجّهه لمهمة | اكتبها في `backlog.md` تحت `## من المالك` |
| تغيّر صلاحياته | عدّل `AGENTS.md` |
| توقف كل شي | `Settings → Actions → Disable Actions` |
| ترجع نسخة | `npm run rollback -- backup-...` أو Vercel Promote |
| يشتغل أكثر من مرة يومياً | غيّر الـ cron في `autopilot.yml` |

## انتبه أول أسبوع

- **التكلفة:** كل دورة تستخدم OpenAI Codex وتقرأ جزءاً كبيراً من الكود. راقب استهلاك OpenAI أول 3 أيام، وخفّض `effort` أو عدد مرات التشغيل إذا ارتفع الاستهلاك.
- **الانجراف:** اقرأ `.agent/JOURNAL.md` مرة أسبوعياً — 3 دقايق تكفي.
- **الحرّاس مقصودة:** حد 800 سطر ومنع تعديل `.github/` و `AGENTS.md` هي
  اللي تمنعه يوسّع صلاحياته بنفسه. لا تشيلها.
- **`SHA256SUMS.txt` بيصير قديماً** بعد أول commit آلي — طبيعي، هو لقطة
  تصدير، والأوتوبايلوت ممنوع يحدّثه.


## تشغيل الأوتوبايلوت عبر OpenAI

- الموظف الآلي يعمل الآن عبر `openai/codex-action@v1` الرسمي.
- السر المطلوب في GitHub Actions هو `OPENAI_API_KEY` فقط.
- متغير Vercel لا ينتقل تلقائياً إلى GitHub؛ أضف نفس القيمة مرة واحدة في:
  `Settings → Secrets and variables → Actions → New repository secret`.
- Codex يولّد Patch في Runner بصلاحية قراءة فقط، ثم يُنقل إلى Runner نظيف
  للفحص والـcommit وفتح Pull Request. لا يحصل Codex على `GITHUB_TOKEN` للكتابة.
- أسرار تيليجرام لا تدخل Runner الخاص بـCodex؛ الإشعار يعمل في Runner مستقل
  ومن نسخة `main` الموثوقة.
- لا يحتاج الأوتوبايلوت إلى تثبيت تطبيق AI إضافي في GitHub.
