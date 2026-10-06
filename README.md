# راشد | RASHID

**راشد** منصة حوار إسلامي موثّق قائمة على الأدلة، ومصممة بالعربية أولاً مع دعم الإنجليزية.

تهدف المنصة إلى مساعدة المستخدم على فهم الإسلام من خلال حوار منظم يمكن تتبع أدلته، مع دعم مناقشة الشبهات، والمناظرة المنظمة، وعرض الخلاف العلمي، والإحالة إلى المختص عند الحاجة.

> المشروع قيد التطوير ضمن نسخة MVP للهاكاثون.

## فكرة المشروع

راشد ليس مجرد Chatbot، ولا محرك فتاوى.

يعتمد المشروع على **Evidence-Linked Dialogue Architecture**، بحيث يتتبع النظام جانبين معاً:

1. **Dialogue State | حالة الحوار:** أين وصل النقاش؟ وما النقاط المحسومة والمفتوحة؟
2. **Evidence Graph | شبكة الأدلة:** ما الدليل المرتبط بكل ادعاء؟ وما علاقة الأدلة بالآراء والمصادر؟

المسار الأساسي المقترح:

```text
سؤال المستخدم
→ Adaptive Router
→ Retrieval
→ Evidence Pack
→ Atomic Claims
→ Claim-Evidence Gate
→ Dialogue Planner
→ Writer
→ Final Verification
→ تحديث حالة الحوار
→ الإجابة المنظمة
```

## مبادئ أساسية

- المحتوى الديني النهائي يعتمد فقط على المصادر المعتمدة في التحدي.
- لا يظهر ادعاء ديني مهم دون دليل مرتبط به.
- راشد لا يصدر فتوى شخصية مستقلة.
- المسائل الخلافية تعرض بوضوح دون إخفاء الخلاف.
- عند نقص الأدلة أو خروج السؤال عن الحدود، يستخدم النظام الامتناع أو الإحالة.
- الواجهة عربية أولاً وRTL، مع دعم الإنجليزية.
- راشد يدعم الحوار والمناظرة المنظمة، وليس مجرد سؤال وجواب.

## التقنيات الحالية

- Next.js 15
- React 19
- TypeScript
- Tailwind CSS
- Zod
- GitHub
- Render

ستضاف بقية الأدوات عند الحاجة، وليس لمجرد وجودها في الخطة.

## هيكل المشروع

```text
src/
├── app/
├── components/
├── lib/
│   ├── ai/
│   ├── rag/
│   ├── graphs/
│   └── schemas/
├── prompts/
└── types/

data/
├── raw/
├── normalized/
├── processed/
├── embeddings/
├── mock/
└── tests/

scripts/
docs/
public/
└── brand/
```

## التشغيل محلياً

بعد Clone للمستودع:

```bash
npm install
npm run dev
```

ثم افتح:

```text
http://localhost:3000
```

إذا كان المنفذ 3000 مستخدماً، يمكن تشغيل نسخة الإنتاج على منفذ آخر:

```bash
npm start -- -p 3001
```

## متغيرات البيئة

انسخ:

`.env.example`

إلى ملف محلي باسم:

`.env.local`

ثم أضف القيم الحقيقية محلياً.

**لا ترفع `.env.local` إلى GitHub.**

## طريقة عمل الفريق

- `main`: النسخة المستقرة.
- `dev`: فرع الدمج والتطوير المشترك.
- `feature/*`: فروع المهام المنفصلة.

المسار المعتاد:

```text
main
└── dev
    ├── feature/router
    ├── feature/retrieval
    ├── feature/gui
    └── ...
```

كل Feature تختبر محلياً، ثم ترفع عبر Pull Request إلى `dev`. بعد اكتمال نسخة مستقرة واختبارها، تدمج `dev` في `main`.

## الاختبار الحالي

تم التحقق من الأساس الحالي بنجاح عبر:

```bash
npm install
npm run dev
npm run build
```

قبل دمج أي تغيير كبير، يجب ألا يكسر:

```bash
npm run build
```

## النشر

المسار المقترح للهاكاثون هو ربط المستودع بخدمة **Render Web Service**.

Build Command:

```bash
npm install && npm run build
```

Start Command:

```bash
npm start
```

لا نعتمد على Render Blueprint دون مراجعة إعداداته أولاً.

## حالة البيانات

لم نثبت بعد استراتيجية إدخال corpus الديني النهائي.

لذلك مجلدات البيانات موجودة حالياً كهيكل فقط، ولن نضيف مصادر دينية إلى النظام حتى يعتمد الفريق طريقة الجمع، والتوحيد، والتتبع، والتحقق.

## وثائق المشروع

راجع مجلد `docs/` من أجل:

- `ARCHITECTURE.md`
- `SOURCES.md`
- `SYSTEM_INSTRUCTIONS.md`
- `TESTING.md`

---

# English Summary

**RASHID** is an Arabic-first, evidence-based Islamic dialogue platform for guided learning, structured debate, source inspection, scholarly disagreement handling, and safe referral.

The project uses an **Evidence-Linked Dialogue Architecture** that connects dialogue state with evidence-backed claims.

RASHID is not a generic chatbot or a fatwa engine. Religious claims must be grounded in the approved challenge corpus, and personalized rulings must follow the referral path.

## Local Setup

```bash
npm install
npm run dev
```

## Branches

- `main`: stable version
- `dev`: integration branch
- `feature/*`: isolated feature work

## Deployment

The current deployment target is Render Web Service using:

```bash
npm install && npm run build
npm start
```
