export default function Home() {
  return (
    <main className="min-h-screen bg-[var(--color-ivory)] text-[var(--color-text)]">
      <section className="mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center gap-6 px-6 text-center">
        <p className="text-sm font-medium tracking-wide text-[var(--color-primary)]">راشد | RASHID</p>
        <h1 className="text-4xl font-bold sm:text-5xl">منصة حوار إسلامي موثّق قائم على الأدلة</h1>
        <p className="max-w-2xl text-lg leading-8 text-slate-600">
          هذا هو الهيكل الأولي للمشروع. الواجهة والذكاء الاصطناعي وبيانات المصادر ستُبنى تدريجياً فوق عقود ثابتة وقابلة للاختبار.
        </p>
      </section>
    </main>
  );
}
