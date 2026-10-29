import type { Metadata } from "next";
import Link from "next/link";
import { COURSE_LOOK, RecipeCover, minutes, totalTime } from "@/components/recipe-art";
import { countView, getShare } from "@/lib/shares";

// A recipe someone chose to share outside their family. Public, read-only,
// a frozen copy: no family names beyond what the card says, no voices, no
// photos of people. The quiet invitation at the end is the whole growth loop.

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { token: string } }): Promise<Metadata> {
  const share = await getShare(params.token);
  if (!share) return { title: "Aangan", robots: { index: false } };
  const r = share.snapshot;
  return {
    title: `${r.title} · from ${r.from}'s kitchen`,
    description: r.memory || `A family recipe from ${r.from}, shared on Aangan.`,
    robots: { index: false, follow: false },
    openGraph: { title: `${r.title}, from ${r.from}'s kitchen`, description: r.memory || "A family recipe, shared on Aangan." },
  };
}

export default async function SharedRecipe({ params }: { params: { token: string } }) {
  const share = await getShare(params.token);
  if (!share) {
    return (
      <div className="pt-20 text-center">
        <p className="m-0 text-[22px] font-semibold">This recipe is no longer shared</p>
        <p className="mx-auto mt-2 max-w-[300px] text-[15px] text-ink-soft">The family that shared it has taken it back. Recipes stay with the people who make them.</p>
      </div>
    );
  }
  await countView(params.token);
  const r = share.snapshot;
  const look = COURSE_LOOK[r.course];
  const stats = [
    ["Prep", minutes(r.prepMins)],
    ["Cook", minutes(r.cookMins)],
    ["Serves", r.serves],
  ].filter(([, v]) => v);
  return (
    <article className="pb-10 pt-2">
      <RecipeCover recipe={r} className="h-[220px] rounded-hero" />
      <p className="m-0 mt-5 text-[13px] font-semibold uppercase tracking-[0.08em]" style={{ color: look.ink }}>
        {look.label}
        {totalTime(r) ? ` · ${totalTime(r)}` : ""}
      </p>
      <h1 className="m-0 mt-1 text-[30px] leading-[1.08]">{r.title}</h1>
      <p className="m-0 mt-2 text-[15px] text-ink-soft">From {r.from}&rsquo;s kitchen</p>
      {r.memory && <p className="voice m-0 mt-4 text-[19px] leading-snug">&ldquo;{r.memory}&rdquo;</p>}
      {stats.length > 0 && (
        <dl className="m-0 mt-5 grid divide-x divide-[var(--line)] rounded-card bg-surface py-3" style={{ gridTemplateColumns: `repeat(${stats.length}, 1fr)` }}>
          {stats.map(([k, v]) => (
            <div key={k} className="px-2 text-center">
              <dt className="text-[12px] font-medium text-ink-soft">{k}</dt>
              <dd className="m-0 mt-0.5 text-[16px] font-semibold">{v}</dd>
            </div>
          ))}
        </dl>
      )}
      {r.prepWork.length > 0 && (
        <>
          <h2 className="mb-3 mt-8 text-[20px]">Before you start</h2>
          <ul className="m-0 list-disc space-y-1.5 pl-5 text-[16px]">
            {r.prepWork.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </>
      )}
      <h2 className="mb-3 mt-8 text-[20px]">Ingredients</h2>
      <ul className="m-0 list-none divide-y divide-[var(--line)] rounded-card bg-surface p-0 px-4">
        {r.ingredients.map((i, n) => (
          <li key={n} className="flex items-baseline justify-between gap-3 py-3">
            <span className="text-[16px] font-semibold">{i.item}</span>
            <span className="text-right">
              {i.said && <span className="voice block text-[16px]">{i.said}</span>}
              {i.approx && <span className="tnum block text-[13px] text-ink-faint">{i.approx}</span>}
            </span>
          </li>
        ))}
      </ul>
      <h2 className="mb-3 mt-8 text-[20px]">Method</h2>
      <ol className="m-0 list-none space-y-5 p-0">
        {r.steps.map((st, n) => (
          <li key={n} className="flex gap-3.5">
            <span className="tnum grid h-8 w-8 shrink-0 place-items-center rounded-full text-[14px] font-bold text-white" style={{ background: look.ink }}>
              {n + 1}
            </span>
            <div className="pt-1">
              <p className="m-0 text-[17px] leading-snug">{st.text}</p>
              {st.tip && <p className="voice m-0 mt-1.5 text-[17px] text-[#8a4b00]">&ldquo;{st.tip}&rdquo; — {r.from}</p>}
            </div>
          </li>
        ))}
      </ol>
      {r.outcome && (
        <div className="mt-8 rounded-card p-4" style={{ background: look.bg }}>
          <p className="m-0 text-[13px] font-semibold uppercase tracking-[0.06em]" style={{ color: look.ink }}>
            How you know it&rsquo;s right
          </p>
          <p className="m-0 mt-1 text-[17px] leading-snug">{r.outcome}</p>
        </div>
      )}
      <aside className="mt-10 rounded-hero bg-[linear-gradient(135deg,#1c1712,#3a2a1c)] p-6 text-white">
        <p className="m-0 text-[20px] font-semibold leading-snug">Whose cooking do you miss?</p>
        <p className="m-0 mt-1.5 text-[15px] text-white/80">Aangan keeps your family&rsquo;s recipes in the voices that taught them, private to your family.</p>
        <Link href="/create" className="press mt-4 flex h-12 items-center justify-center rounded-full bg-white text-[16px] font-semibold text-ink no-underline">
          Start your family&rsquo;s kitchen
        </Link>
      </aside>
    </article>
  );
}
