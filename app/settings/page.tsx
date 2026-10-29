"use client";

import Link from "next/link";
import { useJson } from "@/lib/use-json";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Avatar, Button, Icon, Photo, RoomHeader } from "@/components/ui/kit";
import { useViewer } from "@/components/viewer";
import { type SupportedLang } from "@/lib/i18n";
import { LANGUAGES, language } from "@/lib/languages";
import { ZONES, placeFromTz } from "@/lib/zones";
import { processHomeImage } from "@/lib/media-client";
import { resolveMediaUrl } from "@/lib/media-session";
import { memberPhoto } from "@/lib/people";
import { resetFamilyCards } from "@/lib/use-family";
import { useLargeText } from "@/lib/use-large-text";
import { ACCESS_LABEL, can } from "@/lib/permissions";
import { callName } from "@/lib/people";
import { cn } from "@/lib/utils";
import { WindowSettings } from "@/components/window-settings";

interface Invite {
  code: string;
  expiresAt: string;
}

/** Who's who, and (for admins) who may do what. */
function PeopleAndRoles({ onMessage }: { onMessage: (m: string) => void }) {
  const { viewer, members, refreshMembers } = useViewer();
  const admin = can(viewer, "roles.assign");
  const order: Record<string, number> = { admin: 0, member: 1, child: 2 };
  const people = [...members].sort((a, b) => order[a.access] - order[b.access] || callName(a).localeCompare(callName(b)));
  return (
    <div>
      <ul className="m-0 list-none divide-y divide-[var(--line)] rounded-[22px] bg-surface p-0 px-4">
        {people.map((m) => (
          <li key={m.id} className="flex items-center gap-3 py-3">
            <Avatar src={memberPhoto(m)} name={callName(m)} size={40} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[16px] font-semibold">
                {callName(m)}
                {m.id === viewer.id ? " (you)" : ""}
              </span>
              <span className="block text-[13px] text-ink-soft">{m.email ? "Has their own account" : "Added by family"}</span>
            </span>
            {admin ? (
              <select
                aria-label={`${callName(m)}'s role`}
                value={m.access}
                onChange={async (e) => {
                  const res = await fetch(`/api/members/${encodeURIComponent(m.id)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ access: e.target.value }) });
                  if (res.status === 409) onMessage("The family needs at least one admin.");
                  else if (res.ok) onMessage(`${callName(m)} is now ${ACCESS_LABEL[e.target.value as keyof typeof ACCESS_LABEL].label.toLowerCase()}.`);
                  await refreshMembers();
                }}
                className="h-10 rounded-full bg-white px-3 text-[14px] font-semibold"
              >
                {(["admin", "member", "child"] as const).map((a) => (
                  <option key={a} value={a}>
                    {ACCESS_LABEL[a].label}
                  </option>
                ))}
              </select>
            ) : (
              <span className="rounded-full bg-white px-3 py-1.5 text-[13px] font-semibold">{ACCESS_LABEL[m.access].label}</span>
            )}
          </li>
        ))}
      </ul>
      <ul className="m-0 mt-3 list-none space-y-1 p-0 text-[13px] text-ink-soft">
        {(["admin", "member", "child"] as const).map((a) => (
          <li key={a}>
            <span className="font-semibold text-ink">{ACCESS_LABEL[a].label}</span> · {ACCESS_LABEL[a].note}
          </li>
        ))}
      </ul>
    </div>
  );
}

function LargeTextToggle() {
  const { viewer } = useViewer();
  const [large, setLarge] = useLargeText(viewer.role === "elder");
  return (
    <label className="flex items-center justify-between gap-3 rounded-[20px] bg-surface px-4 py-3.5">
      <span>
        <span className="block text-[17px] font-semibold">Larger text</span>
        <span className="block text-[14px] text-ink-soft">Bigger words and buttons, easier on the eyes</span>
      </span>
      <input type="checkbox" className="h-6 w-6 accent-black" checked={large} onChange={(e) => setLarge(e.target.checked)} />
    </label>
  );
}

/** Searchable picker: 29 languages would be a wall of radio buttons. */
function LanguagePicker({ value, onPick }: { value: SupportedLang; onPick: (code: SupportedLang) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const current = language(value);
  const query = q.trim().toLowerCase();
  const list = LANGUAGES.filter((l) => !query || l.name.toLowerCase().includes(query) || l.native.toLowerCase().includes(query) || l.code.includes(query));
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="press flex w-full items-center justify-between rounded-[20px] bg-surface px-4 py-3.5 text-left"
      >
        <span>
          <span className="block text-[17px] font-semibold">{current.native}</span>
          <span className="block text-[14px] text-ink-soft">{current.name}</span>
        </span>
        <span className="text-[15px] font-medium text-ink-soft">{open ? "Done" : "Change"}</span>
      </button>
      {open && (
        <div className="mt-2 rounded-[20px] bg-surface p-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search languages"
            aria-label="Search languages"
            className="h-11 w-full rounded-full bg-white px-4 text-[16px] outline-none focus:ring-2 focus:ring-marigold"
          />
          <ul role="radiogroup" aria-label="Language" className="m-0 mt-2 max-h-[320px] list-none overflow-y-auto p-0">
            {list.map((l) => (
              <li key={l.code}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={l.code === value}
                  onClick={() => {
                    onPick(l.code);
                    setOpen(false);
                    setQ("");
                  }}
                  className={cn("press flex h-12 w-full items-center justify-between rounded-[14px] px-3 text-left", l.code === value && "bg-black text-white")}
                >
                  <span className="text-[16px] font-medium" dir={"rtl" in l && l.rtl ? "rtl" : undefined}>
                    {l.native}
                  </span>
                  <span className={cn("text-[13px]", l.code === value ? "text-white/70" : "text-ink-soft")}>{l.name}</span>
                </button>
              </li>
            ))}
            {list.length === 0 && <li className="px-3 py-3 text-[15px] text-ink-soft">No match. Try the English name.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}


function Group({ title, id, children }: { title: string; id?: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} id={id} className="mt-9 scroll-mt-6">
      <h2 className="m-0 mb-3 text-[20px]">{title}</h2>
      {children}
    </section>
  );
}

const TABS = [
  ["you", "You"],
  ["family", "Family"],
  ["privacy", "Privacy"],
] as const;

export default function SettingsPage() {
  const router = useRouter();
  const { viewer, displayLang, setDisplayLang, refreshMembers } = useViewer();
  const [name, setName] = useState(viewer.firstName);
  const [tz, setTz] = useState(viewer.tz);
  const [saved, setSaved] = useState<string | null>(null);
  const [invite, setInvite] = useState<Invite | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const portraitRef = useRef<HTMLInputElement>(null);
  const homeRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<"you" | "family" | "privacy">("you");
  useEffect(() => {
    const h = window.location.hash;
    if (h === "#invite" || h === "#roles") setTab("family");
    if (h === "#privacy") setTab("privacy");
  }, []);

  useEffect(() => {
    setName(viewer.firstName);
    setTz(viewer.tz);
  }, [viewer.firstName, viewer.tz]);

  useEffect(() => {
    fetch("/api/invites", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { invites?: Invite[] } | null) => {
        const live = (d?.invites ?? []).filter((i) => new Date(i.expiresAt).getTime() > Date.now());
        setInvite(live[0] ?? null);
      })
      .catch(() => undefined);
  }, []);

  const flash = (msg: string) => {
    setSaved(msg);
    window.setTimeout(() => setSaved(null), 2200);
  };

  const saveProfile = async (patch: { firstName?: string; tz?: string; photoRef?: string; city?: string }) => {
    const res = await fetch("/api/members/profile", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(patch) });
    if (res.ok) {
      await refreshMembers();
      flash("Saved");
    } else flash("Couldn't save. Try again.");
  };

  const uploadImage = async (file: File, kind: "portrait" | "home") => {
    setBusy(kind);
    try {
      const { mediaRef, palette } = await processHomeImage(file);
      if (kind === "portrait") await saveProfile({ photoRef: mediaRef });
      else {
        await fetch("/api/members/home-image", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ memberId: viewer.id, mediaRef, palette }) });
        await refreshMembers();
        flash("Home photo updated");
      }
    } catch {
      flash("That photo couldn't be read. Try another.");
    } finally {
      setBusy(null);
    }
  };

  const newInvite = async () => {
    setBusy("invite");
    try {
      const res = await fetch("/api/invites", { method: "POST" });
      if (res.ok) setInvite(((await res.json()) as { invite: Invite }).invite);
    } finally {
      setBusy(null);
    }
  };

  const shareInvite = async () => {
    if (!invite) return;
    const text = `Join our family on Aangan. Your code: ${invite.code}`;
    try {
      if (navigator.share) await navigator.share({ title: "Aangan", text, url: window.location.origin });
      else {
        await navigator.clipboard.writeText(`${text}\n${window.location.origin}`);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      /* share sheet dismissed */
    }
  };

  const removeMemories = async () => {
    setBusy("remove");
    const res = await fetch("/api/privacy/cards", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ memberId: viewer.id }) });
    setBusy(null);
    flash(res.ok ? "Your wishes, reactions and listens were deleted" : "Couldn't delete. Try again.");
  };

  const leave = async () => {
    setBusy("leave");
    const res = await fetch("/api/privacy/membership", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ memberId: viewer.id }) });
    if (res.ok) {
      await fetch("/api/session", { method: "DELETE" }).catch(() => undefined);
      resetFamilyCards();
      window.dispatchEvent(new Event("aangan:auth"));
      router.replace("/");
    } else {
      setBusy(null);
      setConfirmLeave(false);
      flash(res.status === 409 ? "You're the only admin. Make someone else admin first (People & roles)." : "Couldn't leave. Try again.");
    }
  };

  const signOut = async () => {
    await fetch("/api/session", { method: "DELETE" }).catch(() => undefined);
    try {
      sessionStorage.clear();
    } catch {
      /* ignore */
    }
    resetFamilyCards();
    window.dispatchEvent(new Event("aangan:auth"));
    router.replace("/");
  };

  const home = resolveMediaUrl(viewer.homeImageRef) ?? "/demo/courtyard.jpg";

  return (
    <div>
      <RoomHeader title="Settings" />

      <div className="flex items-center gap-4">
        <button type="button" onClick={() => portraitRef.current?.click()} className="press relative rounded-full" aria-label="Change your photo">
          <Avatar src={memberPhoto(viewer)} name={viewer.firstName} size={76} ring />
          <span className="absolute -bottom-0.5 -right-0.5 grid h-7 w-7 place-items-center rounded-full bg-black text-white">
            <Icon name="camera" size={14} />
          </span>
        </button>
        <div className="min-w-0 flex-1">
          <label className="block">
            <span className="sr-only">Your first name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => name.trim() && name.trim() !== viewer.firstName && void saveProfile({ firstName: name.trim() })}
              className="w-full bg-transparent text-[24px] font-bold outline-none focus:underline"
              maxLength={40}
            />
          </label>
          <p className="m-0 text-[14px] text-ink-soft">The family calls you {viewer.displayName}</p>
        </div>
        <input ref={portraitRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && void uploadImage(e.target.files[0], "portrait")} />
      </div>

      <nav aria-label="Settings sections" className="mt-7 grid grid-cols-3 gap-1 rounded-full bg-surface p-1">
        {TABS.map(([id, label]) => (
          <button key={id} type="button" aria-pressed={tab === id} onClick={() => setTab(id)} className={cn("press h-10 rounded-full text-[15px] font-semibold", tab === id ? "bg-white text-ink shadow-sm" : "text-ink-soft")}>
            {label}
          </button>
        ))}
      </nav>

      {tab === "you" && (
        <>
      <Group title="Your window" id="window">
        <WindowSettings />
      </Group>
      <Group title="Hear the family in">
        <LanguagePicker
          value={displayLang}
          onPick={(code) => {
            void setDisplayLang(code);
            flash("Language updated");
          }}
        />
        <p className="m-0 mt-2 text-[13px] text-ink-faint">Everything the family shares (voices, recipes, notes) is translated into your language by Muse. The app itself stays in English. Names stay as the family says them.</p>
      </Group>

      <Group title="Reading">
        <LargeTextToggle />
      </Group>

      <Group title="Where you are">
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-medium text-ink-soft">Time zone, so family sees your local time</span>
          <select
            value={tz}
            onChange={(e) => {
              setTz(e.target.value);
              void saveProfile({ tz: e.target.value });
            }}
            className="h-[52px] w-full appearance-none rounded-full bg-surface px-5 text-[16px] outline-none focus:ring-2 focus:ring-marigold"
          >
            {Array.from(new Set([viewer.tz, ...ZONES.map((z) => z.tz)])).map((z) => (
              <option key={z} value={z}>
                {placeFromTz(z)}
              </option>
            ))}
          </select>
        </label>
        <label className="mt-4 block">
          <span className="mb-1.5 block text-[13px] font-medium text-ink-soft">Your city, so the other home sees your sky and weather</span>
          <input
            defaultValue={viewer.city}
            placeholder="Bengaluru"
            maxLength={60}
            onBlur={(e) => e.target.value.trim() !== viewer.city && void saveProfile({ city: e.target.value.trim() })}
            className="h-[52px] w-full rounded-full bg-surface px-5 text-[16px] outline-none focus:ring-2 focus:ring-marigold"
          />
        </label>
        <div className="relative mt-4 h-[160px] overflow-hidden rounded-card bg-surface">
          <Photo src={home} alt="Your home photo" sizes="440px" />
          <div className="glass absolute inset-x-2.5 bottom-2.5 flex items-center justify-between rounded-[18px] py-2.5 pl-4 pr-2.5">
            <span className="text-[15px] font-semibold">The home you miss</span>
            <button type="button" onClick={() => homeRef.current?.click()} className="press h-9 rounded-full bg-white px-4 text-[14px] font-semibold text-black">
              {busy === "home" ? "Uploading…" : "Change"}
            </button>
          </div>
          <input ref={homeRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && void uploadImage(e.target.files[0], "home")} />
        </div>
      </Group>

        </>
      )}

      {tab === "family" && (
        <>
      <Group title="Invite family" id="invite">
        {!can(viewer, "invite.create") ? (
          <p className="m-0 text-[15px] text-ink-soft">Ask a grown-up in the family to invite people.</p>
        ) : invite ? (
          <div className="rounded-[22px] bg-surface p-4">
            <p className="m-0 text-[13px] text-ink-soft">Share this code. It works until {new Date(invite.expiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}.</p>
            <p className="tnum m-0 mt-1 text-[28px] font-bold tracking-[0.12em]">{invite.code}</p>
            <Button className="mt-3 w-full" onClick={() => void shareInvite()}>
              {copied ? "Copied" : "Share invite"}
            </Button>
            {can(viewer, "invite.revoke") && (
              <button
                type="button"
                className="mt-2 h-10 w-full text-[14px] font-medium text-[#b42318]"
                onClick={async () => {
                  const res = await fetch("/api/invites", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ code: invite.code }) });
                  if (res.ok) {
                    setInvite(null);
                    flash("Code revoked. It no longer works.");
                  }
                }}
              >
                Revoke this code
              </button>
            )}
          </div>
        ) : (
          <Button className="w-full" disabled={busy === "invite"} onClick={() => void newInvite()}>
            {busy === "invite" ? "Creating…" : "Create an invite code"}
          </Button>
        )}
      </Group>

      <Group title="People & roles" id="roles">
        <PeopleAndRoles onMessage={flash} />
      </Group>

        </>
      )}

      {tab === "privacy" && (
        <>
      <Group title="Privacy" id="privacy">
        <ul className="m-0 list-none space-y-2 p-0 text-[15px] text-ink-soft">
          <li>Only your family sees what you share. Photos lose their location before upload.</li>
          <li>Voices are never cloned. No face recognition, and no tagging of children.</li>
          <li>Demo mode: Meta&rsquo;s AI models process content to caption, transcribe and translate.</li>
        </ul>
        {viewer.access !== "child" && (
          <div className="mt-4 overflow-hidden rounded-[22px] bg-surface">
            <a href="/api/export" download className="press flex w-full items-center justify-between px-4 py-4 text-left text-[16px] font-medium text-ink no-underline">
              <span>
                <span className="block">Download our family&rsquo;s data</span>
                <span className="block text-[13px] font-normal text-ink-soft">Everyone, the tree, recipes, care and memories, as one file you own</span>
              </span>
              <Icon name="down" size={18} className="text-ink-faint" />
            </a>
            <div className="mx-4 h-px bg-[var(--line)]" />
            <SharedLinks onMessage={flash} />
          </div>
        )}
        <div className="mt-4 overflow-hidden rounded-[22px] bg-surface">
          <button type="button" onClick={() => void removeMemories()} disabled={busy === "remove"} className="press flex w-full items-center justify-between px-4 py-4 text-left text-[16px] font-medium">
            Delete my reactions, wishes and listens
            <Icon name="chevron" size={18} className="text-ink-faint" />
          </button>
          <div className="mx-4 h-px bg-[var(--line)]" />
          {confirmLeave ? (
            <div className="px-4 py-4">
              <p className="m-0 text-[15px]">Leave the family? Your profile and place in the tree are deleted. Shared memories stay with the family.</p>
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={() => setConfirmLeave(false)} className="press h-10 flex-1 rounded-full bg-white text-[14px] font-semibold">
                  Stay
                </button>
                <button type="button" onClick={() => void leave()} disabled={busy === "leave"} className="press h-10 flex-1 rounded-full bg-[#b42318] text-[14px] font-semibold text-white">
                  {busy === "leave" ? "Leaving…" : "Leave family"}
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirmLeave(true)} className="press flex w-full items-center justify-between px-4 py-4 text-left text-[16px] font-medium text-[#b42318]">
              Leave the family
              <Icon name="chevron" size={18} className="text-ink-faint" />
            </button>
          )}
        </div>
      </Group>

      <Group title="Muse">
        <Link href="/trace" className="press flex items-center justify-between rounded-[22px] bg-surface px-4 py-4 text-[16px] font-medium text-ink no-underline">
          <span>
            <span className="block">What Muse did for your family</span>
            <span className="block text-[13px] font-normal text-ink-soft">Every caption, translation and suggestion, step by step</span>
          </span>
          <Icon name="chevron" size={18} className="text-ink-faint" />
        </Link>
      </Group>
        </>
      )}

      <Button variant="secondary" className="mt-9 w-full" onClick={() => void signOut()}>
        Sign out
      </Button>

      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 z-50 flex justify-center" style={{ bottom: "calc(24px + env(safe-area-inset-bottom))" }}>
        {saved && <p className="frost glass-pill m-0 px-5 py-3 text-[15px] font-medium">{saved}</p>}
      </div>
    </div>
  );
}

/** What this family has shared outside itself, and a way to take it back. */
function SharedLinks({ onMessage }: { onMessage: (m: string) => void }) {
  const { data, reload } = useJson<{ shares: { token: string; title: string; views: number }[] }>("/api/share");
  const list = data?.shares ?? [];
  return (
    <div className="px-4 py-4">
      <p className="m-0 text-[16px] font-medium">Shared outside the family</p>
      {list.length === 0 ? (
        <p className="m-0 mt-1 text-[13px] text-ink-soft">Nothing yet. Recipes you share appear here.</p>
      ) : (
        <ul className="m-0 mt-2 list-none space-y-1.5 p-0">
          {list.map((s) => (
            <li key={s.token} className="flex items-center justify-between gap-3 text-[14px]">
              <span className="min-w-0 truncate">
                {s.title} <span className="text-ink-faint">· opened {s.views}×</span>
              </span>
              <button
                type="button"
                onClick={async () => {
                  await fetch("/api/share", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: s.token }) });
                  await reload();
                  onMessage("Stopped sharing. The link no longer works.");
                }}
                className="h-9 shrink-0 text-[14px] font-semibold text-[#a32418]"
              >
                Stop
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
