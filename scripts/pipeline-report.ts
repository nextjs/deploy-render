import fs from "node:fs";
import path from "node:path";
export type ReportCase = { name: string; question: string; expected: string; outcome: "running" | "passed" | "failed"; events: Array<{ stage: string; data: unknown }> };
function escape(value: string): string {
  return value.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
function clean(value: unknown, secrets: string[]): unknown {
  if (typeof value === "string") {
    let text = value.replace(/\u001b\[[0-9;]*m/g, "");
    for (const secret of secrets) if (secret) text = text.split(secret).join("[REDACTED]");
    return text;
  }
  if (Array.isArray(value)) return value.map(v => clean(v, secrets));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k,v]) => [k, clean(v, secrets)]));
  return value;
}
function render(value: unknown): string {
  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value);
      if (parsed && typeof parsed === "object") return render(parsed);
    } catch { /* Plain prose. */ }
    return `<div class="value" dir="auto">${escape(value)}</div>`;
  }
  if (Array.isArray(value)) return `<div class="array">${value.map(v => `<div class="item">${render(v)}</div>`).join("")}</div>`;
  if (value && typeof value === "object") return `<div class="object">${Object.entries(value).map(([key,v]) => `<div class="entry"><div class="key" dir="ltr">${escape(key)}</div>${render(v)}</div>`).join("")}</div>`;
  return `<span dir="ltr">${escape(String(value))}</span>`;
}
export class PipelineReport {
  readonly htmlPath: string;
  readonly jsonPath: string;
  readonly data = {
    startedAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    status: "running", fatalError: null as string | null,
    events: [] as Array<{ stage: string; data: unknown }>, cases: [] as ReportCase[],
  };
  private current?: ReportCase;
  constructor(directory = "test-results", private secrets: string[] = []) {
    this.htmlPath = path.resolve(directory, "pipeline-live.html");
    this.jsonPath = path.resolve(directory, "pipeline-live.json");
  }
  startCase(name: string, question: string, expected: string) {
    this.current = { name, question, expected, outcome: "running", events: [] };
    this.data.cases.push(this.current); this.save();
  }
  record(stage: string, data: unknown) {
    const event = { stage, data: clean(data, this.secrets) };
    (this.current?.events ?? this.data.events).push(event);
    if (this.current && (stage === "PASS" || stage === "FAIL")) this.current.outcome = stage === "PASS" ? "passed" : "failed";
    this.save();
  }
  finish(status: string, error?: string) {
    this.data.status = status;
    this.data.fatalError = error ? String(clean(error, this.secrets)) : null;
    this.save();
  }
  save() {
    this.data.updatedAt = new Date().toISOString();
    const passed = this.data.cases.filter(c => c.outcome === "passed").length;
    const labels = { running: "قيد الاختبار", passed: "نجح الفحص الآلي", failed: "فشل الفحص الآلي" };
    const details = (events: ReportCase["events"]) => events.map(e => `<details><summary dir="ltr">${escape(e.stage)}</summary>${render(e.data)}</details>`).join("");
    const body = `<h1>نتائج اختبار راشد</h1><p>نجح ${passed} من ${this.data.cases.length} حالات بدأت. حالة التشغيل: <b dir="ltr">${escape(this.data.status)}</b></p><p class="note">النجاح الآلي لا يثبت صحة المحتوى. راجعي دعم الأدلة، واللغة، والتقييمات، ومدى إجابة السؤال.</p>${this.data.fatalError ? `<section class="note"><h2>خطأ أوقف التشغيل</h2>${render(this.data.fatalError)}</section>` : ""}<details><summary>الإعداد وبداية التشغيل</summary>${details(this.data.events)}</details>${this.data.cases.map(c => {
      const final = c.events.find(e => e.stage === "final-response")?.data as { message?: string; status?: string } | undefined;
      const failure = c.events.find(e => e.stage === "FAIL");
      return `<section><h2 dir="auto">${escape(c.name)}</h2><p>${labels[c.outcome]}</p><h3>السؤال</h3>${render(c.question)}<p>الحالة المتوقعة: <b dir="ltr">${escape(c.expected)}</b> | الحالة الفعلية: <b dir="ltr">${escape(final?.status ?? "لم يصل إلى الرد النهائي")}</b></p><h3>الرد النهائي</h3>${render(final?.message ?? "لم ينتج ردًا نهائيًا")}${failure ? `<h3>سبب الفشل</h3>${render(failure.data)}` : ""}<h3>تفاصيل المراحل والمصادر</h3>${details(c.events)}</section>`;
    }).join("")}`;
    const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>نتائج اختبار راشد</title><style>body{font-family:Tahoma,Arial,sans-serif;max-width:1100px;margin:30px auto;padding:0 20px;background:#f4f6f9;color:#182536;line-height:1.9}section,details{background:white;border:1px solid #dbe1e8;border-radius:8px;padding:16px;margin:12px 0}summary{cursor:pointer;font-weight:bold}.value{white-space:pre-wrap;overflow-wrap:anywhere;unicode-bidi:plaintext}.key{font-size:13px;color:#476587;font-weight:bold}.entry{border-bottom:1px solid #eee;padding:8px}.item{border:1px solid #ddd;padding:8px;margin:8px}.note{background:#fff1d6;padding:16px}h1,h2,h3{line-height:1.5}</style></head><body>${body}</body></html>`;
    fs.mkdirSync(path.dirname(this.htmlPath), { recursive: true });
    fs.writeFileSync(this.jsonPath, JSON.stringify(clean(this.data, this.secrets), null, 2), "utf8");
    fs.writeFileSync(this.htmlPath, html, "utf8");
  }
}
