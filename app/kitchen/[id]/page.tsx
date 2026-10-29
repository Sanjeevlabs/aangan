"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { usePlayer } from "@/components/player";
import { useShell } from "@/components/shell";
import { ActionMenu, Avatar, Button, EmptyLine, Icon, Monogram, MuseMark, Photo, PlayButton, RoomHeader, SectionTitle } from "@/components/ui/kit";
import { canChange } from "@/lib/permissions";
import { useViewer } from "@/components/viewer";
import type { Attempt, Recipe } from "@/lib/kinds";
import { language } from "@/lib/languages";
import { resolveMediaUrl } from "@/lib/media-session";
import { callName, memberPhoto } from "@/lib/people";
import { useFamilyCards } from "@/lib/use-family";
import { ago, postJson, useJson } from "@/lib/use-json";

interface Payload {
  recipe: Recipe;
  original: Recipe;
  translated: boolean;
  attempts: Attempt[];
}

export default function RecipePage() {
  const { id } = useParams<{ id: string }>();
  const { viewer, members, displayLang } = useViewer();
  const { refreshKey } = useShell();
  const { cards } = useFamilyCards(refreshKey);
  const { play, current, isPlaying, toggle } = usePlayer();
  const { data, failed, reload } = useJson<Payload>(`/api/kitchen/${encodeURIComponent(id)}?lang=${encodeURIComponent(displayLang)}`);
  const [showOriginal, setShowOriginal] = useState(false);
  const [editing, setEditing] = useState(false);
  const router = useRouter();

  if (failed) {
    return (
      <div>
        <RoomHeader title="Recipe" />
        <EmptyLine>This recipe isn&rsquo;t in your family&rsquo;s Kitchen.</EmptyLine>
      </div>
    );
  }
  if (!data) {
    return (
      <div>
        <RoomHeader title="" />
        <div className="skeleton h-[300px] rounded-hero" aria-busy="true" aria-label="Loading recipe" />
      </div>
    );
  }

  const r = showOriginal ? data.original : data.recipe;
  const cook = members.find((m) => m.id === r.cookId);
  const voice = (cards ?? []).find((c) => c.id === r.voiceCardId);
  const active = voice && current?.id === voice.id;
  const cookPhoto = memberPhoto(cook);

  const menu = [
    ...(canChange(viewer, data.original.cookId, "edit") ? [{ label: "Edit recipe", onSelect: () => setEditing(true) }] : []),
    ...(canChange(viewer, data.original.cookId, "delete")
      ? [
          {
            label: "Delete recipe",
            danger: true,
            confirm: "Delete this recipe and everyone's attempts? The voice note stays in Memory Lane.",
            onSelect: async () => {
              await postJson("/api/kitchen", { action: "delete-recipe", recipeId: data.original.id });
              router.replace("/kitchen");
            },
          },
        ]
      : []),
  ];

  if (editing) return <RecipeEditor recipe={data.original} onDone={async () => { setEditing(false); await reload(); }} />;

  return (
    <div>
      <RoomHeader title={r.title} subtitle={r.serves ? `Serves ${r.serves}` : `${callName(cook)}'s recipe`} action={<ActionMenu actions={menu} label="Recipe options" />} />

      <div className="relative h-[300px] overflow-hidden rounded-hero bg-[#3a2a1c]" style={{ boxShadow: "0 24px 50px -22px rgba(120,70,20,.6)" }}>
        {cookPhoto ? <Photo src={cookPhoto} alt={callName(cook)} sizes="440px" priority position="center 25%" /> : <div className="absolute inset-0"><Monogram name={callName(cook)} size={300} /></div>}
        <div className="glass absolute inset-x-2.5 bottom-2.5 rounded-[22px] p-4">
          {r.memory && <p className="voice m-0 mb-3 text-[19px] leading-snug text-white">“{r.memory}”</p>}
          {voice ? (
            <div className="flex items-center gap-3">
              <PlayButton playing={Boolean(active && isPlaying)} onClick={() => (active ? toggle() : play(voice))} label={`Hear ${callName(cook)} teach it`} />
              <span className="text-[15px] font-semibold text-white">Hear {callName(cook)} teach it</span>
            </div>
          ) : (
            <p className="m-0 text-[15px] font-semibold text-white">From {callName(cook)}&rsquo;s hands</p>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 px-1">
        {data.original.madeBy === "muse" && <MuseMark>written from {callName(cook)}&rsquo;s voice note</MuseMark>}
        {data.translated && (
          <button type="button" onClick={() => setShowOriginal((v) => !v)} className="text-[12px] font-medium text-ink-soft underline underline-offset-2">
            {showOriginal ? `Show in ${language(displayLang).native}` : `Translated by Muse · show ${language(data.original.lang).native}`}
          </button>
        )}
      </div>

      <section aria-label="Ingredients">
        <SectionTitle>What goes in</SectionTitle>
        <ul className="m-0 list-none divide-y divide-[var(--line)] rounded-card bg-surface p-0 px-4">
          {r.ingredients.map((i, n) => (
            <li key={n} className="flex items-baseline justify-between gap-3 py-3">
              <span className="text-[16px] font-semibold">{i.item}</span>
              <span className="text-right">
                {i.said && <span className="voice block text-[16px]">{i.said}</span>}
                {i.approx && <span className="tnum block text-[13px] text-ink-faint">≈ {i.approx.replace(/^about\s+/i, "")}</span>}
              </span>
            </li>
          ))}
        </ul>
        <p className="m-0 mt-2 px-1 text-[12px] text-ink-faint">Amounts are as {callName(cook)} said them. The ≈ is a rough guide for kitchens abroad.</p>
      </section>

      <section aria-label="Steps">
        <SectionTitle>How {callName(cook)} makes it</SectionTitle>
        <ol className="m-0 list-none space-y-4 p-0">
          {r.steps.map((s, n) => (
            <li key={n} className="flex gap-3">
              <span className="tnum grid h-8 w-8 shrink-0 place-items-center rounded-full bg-black text-[14px] font-bold text-white">{n + 1}</span>
              <div className="pt-1">
                <p className="m-0 text-[17px] leading-snug">{s.text}</p>
                {s.tip && (
                  <p className="voice m-0 mt-1.5 text-[17px] text-[#8a4b00]">
                    “{s.tip}” <span className="not-italic text-[13px] text-ink-faint">— {callName(cook)}</span>
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
      </section>

      <Link href={`/gather?reason=cook&recipe=${encodeURIComponent(data.original.id)}`} className="press mt-8 flex h-[52px] items-center justify-center gap-2 rounded-full bg-surface text-[16px] font-semibold text-ink no-underline">
        <Icon name="door" size={18} />
        Cook this together, live
      </Link>

      <Cooked recipe={data.original} attempts={data.attempts} cookName={callName(cook)} onChange={() => void reload()} viewerId={viewer.id} />
    </div>
  );
}

function Cooked({ recipe, attempts, cookName, onChange, viewerId }: { recipe: Recipe; attempts: Attempt[]; cookName: string; onChange: () => void; viewerId: string }) {
  const { members } = useViewer();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState<{ ref: string; url: string | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const isCook = recipe.cookId === viewerId;

  const pick = async (file: File) => {
    setBusy(true);
    try {
      const { processHomeImage } = await import("@/lib/media-client");
      const out = await processHomeImage(file);
      setPhoto({ ref: out.mediaRef, url: out.url });
    } catch {
      /* unreadable: keep going without a photo */
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-label="Cooked by the family">
      <SectionTitle>Cooked by the family</SectionTitle>
      {attempts.length === 0 && <p className="m-0 mb-3 text-[15px] text-ink-soft">Nobody has cooked it yet. {isCook ? "When they do, you can bless it." : `${cookName} would love to see yours.`}</p>}
      <ul className="m-0 list-none space-y-3 p-0">
        {attempts.map((a) => {
          const who = members.find((m) => m.id === a.memberId);
          const src = a.photoRef ? (resolveMediaUrl(a.photoRef) ?? a.photoRef) : null;
          const blessed = a.blessedBy.map((id) => members.find((m) => m.id === id)).filter(Boolean);
          const canBless = a.memberId !== viewerId && !a.blessedBy.includes(viewerId);
          const blessedByMe = a.blessedBy.includes(viewerId);
          const me = members.find((m) => m.id === viewerId);
          return (
            <li key={a.id} className="overflow-hidden rounded-card bg-surface">
              {src && (
                <div className="relative h-[200px]">
                  <Photo src={src} alt={`${callName(who)}'s ${recipe.title}`} sizes="440px" />
                </div>
              )}
              <div className="p-4">
                <div className="flex items-center gap-2.5">
                  <Avatar src={memberPhoto(who)} name={callName(who)} size={32} />
                  <span className="text-[15px] font-semibold">{a.memberId === viewerId ? "You" : callName(who)}</span>
                  <span className="text-[13px] text-ink-faint">{ago(a.createdAt)}</span>
                  <span className="flex-1" />
                  {canChange(me, a.memberId) && (
                    <ActionMenu
                      label="Attempt options"
                      actions={[{ label: "Delete", danger: true, confirm: "Delete this attempt?", onSelect: async () => { await postJson("/api/kitchen", { action: "delete-attempt", attemptId: a.id }); onChange(); } }]}
                    />
                  )}
                </div>
                {a.note && <p className="voice m-0 mt-2 text-[17px] leading-snug">“{a.note}”</p>}
                <div className="mt-3 flex items-center justify-between gap-2">
                  <span className="text-[13px] text-ink-soft">{blessed.length ? `${blessed.map((m) => callName(m)).join(", ")} blessed this` : ""}</span>
                  {blessedByMe && (
                    <button type="button" onClick={async () => { await postJson("/api/kitchen", { action: "unbless", attemptId: a.id }); onChange(); }} className="press flex h-10 items-center gap-1.5 rounded-full bg-[#fff6e6] px-4 text-[14px] font-semibold text-[#8a4b00]">
                      <Icon name="bless" size={16} />
                      Blessed
                    </button>
                  )}
                  {canBless && (
                    <button
                      type="button"
                      onClick={async () => {
                        await postJson("/api/kitchen", { action: "bless", attemptId: a.id });
                        onChange();
                      }}
                      className="press flex h-10 items-center gap-1.5 rounded-full bg-white px-4 text-[14px] font-semibold"
                    >
                      <Icon name="bless" size={16} />
                      Bless
                    </button>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {!isCook && (
        <div className="mt-4">
          {!open ? (
            <Button className="w-full" onClick={() => setOpen(true)}>
              <Icon name="pot" size={18} />I made this
            </Button>
          ) : (
            <div className="rounded-card bg-surface p-4">
              <p className="m-0 text-[17px] font-semibold">How did it turn out?</p>
              <button type="button" onClick={() => fileRef.current?.click()} className="press mt-3 flex h-[120px] w-full items-center justify-center overflow-hidden rounded-[18px] bg-white text-[15px] font-medium text-ink-soft">
                {photo?.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photo.url} alt="Your dish" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex items-center gap-2">
                    <Icon name="camera" size={20} />
                    {busy ? "Preparing photo…" : "Add a photo of your plate"}
                  </span>
                )}
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && void pick(e.target.files[0])} />
              <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={240} placeholder={`A line for ${cookName}`} className="mt-3 h-[52px] w-full rounded-full bg-white px-5 text-[16px] outline-none focus:ring-2 focus:ring-marigold" />
              <div className="mt-3 flex gap-2">
                <Button
                  className="flex-[1.4]"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    await postJson("/api/kitchen", { action: "attempt", recipeId: recipe.id, photoRef: photo?.ref ?? null, note: note.trim() });
                    setBusy(false);
                    setOpen(false);
                    setNote("");
                    setPhoto(null);
                    onChange();
                  }}
                >
                  Show {cookName}
                </Button>
                <Button variant="secondary" className="flex-1 !bg-white" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/** The cook's own corrections: Muse wrote it down, the family owns it. */
function RecipeEditor({ recipe, onDone }: { recipe: Recipe; onDone: () => void }) {
  const [title, setTitle] = useState(recipe.title);
  const [memory, setMemory] = useState(recipe.memory);
  const [serves, setServes] = useState(recipe.serves);
  const [ingredients, setIngredients] = useState(recipe.ingredients.map((i) => ({ ...i })));
  const [steps, setSteps] = useState(recipe.steps.map((x) => ({ ...x })));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const field = "h-[48px] w-full rounded-[14px] bg-white px-4 text-[16px] outline-none focus:ring-2 focus:ring-marigold";
  return (
    <div>
      <RoomHeader title="Edit recipe" subtitle="Fix anything Muse wrote down. Your words win." />
      <div className="space-y-3 rounded-card bg-surface p-4">
        <input className={field} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} aria-label="Title" />
        <input className={field} value={serves} onChange={(e) => setServes(e.target.value)} maxLength={40} placeholder="Serves (optional)" aria-label="Serves" />
        <textarea className="w-full resize-none rounded-[14px] bg-white p-4 text-[16px] outline-none focus:ring-2 focus:ring-marigold" rows={2} value={memory} onChange={(e) => setMemory(e.target.value)} maxLength={240} placeholder="Why this dish matters (optional)" aria-label="Memory" />
      </div>
      <SectionTitle>What goes in</SectionTitle>
      <ul className="m-0 list-none space-y-2 p-0">
        {ingredients.map((ing, i) => (
          <li key={i} className="grid grid-cols-[1fr_1fr_1fr_40px] gap-1.5">
            <input className={field} value={ing.item} onChange={(e) => setIngredients((v) => v.map((x, k) => (k === i ? { ...x, item: e.target.value } : x)))} placeholder="toor dal" aria-label="Ingredient" />
            <input className={field} value={ing.said} onChange={(e) => setIngredients((v) => v.map((x, k) => (k === i ? { ...x, said: e.target.value } : x)))} placeholder="one katori" aria-label="As said" />
            <input className={field} value={ing.approx} onChange={(e) => setIngredients((v) => v.map((x, k) => (k === i ? { ...x, approx: e.target.value } : x)))} placeholder="≈ 1 cup" aria-label="Rough guide" />
            <button type="button" aria-label="Remove ingredient" onClick={() => setIngredients((v) => v.filter((_, k) => k !== i))} className="press grid h-[48px] place-items-center rounded-[14px] text-ink-faint">
              <Icon name="close" size={16} />
            </button>
          </li>
        ))}
      </ul>
      <button type="button" onClick={() => setIngredients((v) => [...v, { item: "", said: "", approx: "" }])} className="press mt-2 flex h-10 items-center gap-1.5 text-[14px] font-semibold">
        <Icon name="plus" size={16} />
        Add ingredient
      </button>
      <SectionTitle>Steps</SectionTitle>
      <ol className="m-0 list-none space-y-2 p-0">
        {steps.map((st, i) => (
          <li key={i} className="rounded-[16px] bg-surface p-2.5">
            <div className="flex gap-1.5">
              <textarea className="w-full resize-none rounded-[12px] bg-white p-3 text-[16px] outline-none focus:ring-2 focus:ring-marigold" rows={2} value={st.text} onChange={(e) => setSteps((v) => v.map((x, k) => (k === i ? { ...x, text: e.target.value } : x)))} aria-label={`Step ${i + 1}`} />
              <button type="button" aria-label="Remove step" onClick={() => setSteps((v) => v.filter((_, k) => k !== i))} className="press grid w-10 place-items-center text-ink-faint">
                <Icon name="close" size={16} />
              </button>
            </div>
            <input className={`${field} mt-1.5 h-[42px] text-[15px]`} value={st.tip} onChange={(e) => setSteps((v) => v.map((x, k) => (k === i ? { ...x, tip: e.target.value } : x)))} placeholder="A tip in your words (optional)" aria-label="Tip" />
          </li>
        ))}
      </ol>
      <button type="button" onClick={() => setSteps((v) => [...v, { text: "", tip: "" }])} className="press mt-2 flex h-10 items-center gap-1.5 text-[14px] font-semibold">
        <Icon name="plus" size={16} />
        Add step
      </button>
      {error && <p className="m-0 mt-3 text-[14px] text-[#b42318]">{error}</p>}
      <div className="mt-6 flex gap-2">
        <Button
          className="flex-[1.4]"
          disabled={busy || !title.trim()}
          onClick={async () => {
            const cleanIngredients = ingredients.filter((x) => x.item.trim());
            const cleanSteps = steps.filter((x) => x.text.trim());
            if (!cleanIngredients.length || !cleanSteps.length) return setError("Keep at least one ingredient and one step.");
            setBusy(true);
            const out = await postJson("/api/kitchen", { action: "edit", recipeId: recipe.id, title: title.trim(), memory: memory.trim(), serves: serves.trim(), ingredients: cleanIngredients, steps: cleanSteps });
            setBusy(false);
            if (!out) return setError("Couldn't save. Try again.");
            onDone();
          }}
        >
          {busy ? "Saving…" : "Save recipe"}
        </Button>
        <Button variant="secondary" className="flex-1" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
