// Reviews are shown only once real, authorised testimonials exist. Until then
// this section renders nothing: no fictitious social proof on the public site.
const APPROVED_TESTIMONIALS: Array<{ author: string; text: string; consentedAt: string }> = [];

export function Testimonials() {
  if (APPROVED_TESTIMONIALS.length === 0) return null;
  return (
    <section className="py-16">
      <div className="container-page">
        <h2 className="font-display text-[2rem]">Ils nous ont fait confiance</h2>
        <ul className="mt-8 grid gap-6 md:grid-cols-2">
          {APPROVED_TESTIMONIALS.map((t) => (
            <li key={t.author} className="label-card p-6">
              <p className="text-ink-700">{t.text}</p>
              <p className="mt-3 text-sm font-semibold text-sage-800">{t.author}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
