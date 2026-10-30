"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { joinLink, whatsappInvite } from "@/lib/invite-link";
import { resetFamilyCards } from "@/lib/use-family";
import { postJson } from "@/lib/use-json";
import { cn } from "@/lib/utils";
import { useShell } from "./shell";
import { Button, Icon } from "./ui/kit";

type Mode = "create" | "join" | "signin";
type Step = "details" | "email" | "code" | "other-side" | "invite";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const ERRORS: Record<string, string> = {
  "invalid-email": "That email doesn't look right.",
  "too-many-codes": "Too many codes requested. Wait a few minutes, then try again.",
  "code-not-sent": "We couldn't send the code. Try again in a moment.",
  "wrong-code": "That code didn't match. Check the latest email and try again.",
  "too-many-attempts": "Too many tries. Wait a few minutes, then request a new code.",
  "no-family": "No family uses this email yet. Start one, or join with an invite code.",
  "already-member": "This email already belongs to a family. Sign in instead.",
  "invalid-invite": "That invite code isn't valid or has expired. Ask for a new one.",
  "too-many-sides": "You're already in four families, the most Aangan allows.",
};

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="mt-4 block">
      <span className="mb-1.5 block text-[13px] font-medium text-ink-soft">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-[13px] text-ink-faint">{hint}</span>}
    </label>
  );
}

const input = "h-[52px] w-full rounded-full bg-surface px-5 text-[16px] outline-none placeholder:text-ink-faint focus:ring-2 focus:ring-black/15";

interface Peek {
  family: string;
  host: string | null;
  places: { id: string; callName: string }[];
}

export function AuthFlow({ mode }: { mode: Mode }) {
  const router = useRouter();
  const { setChromeHidden } = useShell();
  const [step, setStep] = useState<Step>(mode === "signin" ? "email" : "details");
  const [familyName, setFamilyName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [peek, setPeek] = useState<Peek | null>(null);
  const [claim, setClaim] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [callName, setCallName] = useState("");
  const [city, setCity] = useState("");
  const [month, setMonth] = useState("");
  const [day, setDay] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [mock, setMock] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invite, setInvite] = useState<string | null>(null);
  const [farNames, setFarNames] = useState<string[]>([]);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setChromeHidden(true);
    return () => setChromeHidden(false);
  }, [setChromeHidden]);
  useEffect(() => {
    if (step === "code") codeRef.current?.focus();
  }, [step]);
  // A join link carries the code: /join?code=ABC123.
  useEffect(() => {
    if (mode !== "join") return;
    const c = new URLSearchParams(window.location.search).get("code");
    if (c) setInviteCode(c.slice(0, 64));
  }, [mode]);
  // Who sent this code? Offer the place they made for you ("I'm Maa").
  useEffect(() => {
    if (mode !== "join" || inviteCode.trim().length < 6) {
      setPeek(null);
      return;
    }
    const ctl = new AbortController();
    const t = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/invites/peek?code=${encodeURIComponent(inviteCode.trim())}`, { signal: ctl.signal });
        setPeek(res.ok ? ((await res.json()) as Peek) : null);
      } catch {
        /* typing on */
      }
    }, 350);
    return () => {
      window.clearTimeout(t);
      ctl.abort();
    };
  }, [mode, inviteCode]);

  const claimed = peek?.places.find((p) => p.id === claim);
  const title =
    step === "other-side"
      ? "Whose window is this?"
      : step === "invite"
        ? `Invite ${farNames.length ? farNames.join(" & ") : "them"}`
        : step === "email"
          ? mode === "signin"
            ? "Welcome back"
            : "Your email"
          : step === "code"
            ? "Check your email"
            : mode === "create"
              ? "Open your window"
              : peek
                ? `Join ${peek.host ? `${peek.host}'s` : `the ${peek.family}`} window`
                : "Join your family";

  const detailsValid = (claimed || firstName.trim()) && (mode === "create" ? familyName.trim() && month && day : inviteCode.trim().length >= 4);

  const sendCode = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/start", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }) });
      const data = (await res.json()) as { error?: string; mock?: boolean };
      if (!res.ok) throw new Error(data.error ?? "code-not-sent");
      setMock(Boolean(data.mock));
      setStep("code");
    } catch (e) {
      setError(ERRORS[(e as Error).message] ?? "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const enter = () => {
    resetFamilyCards();
    try {
      sessionStorage.removeItem("aangan:entered");
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new Event("aangan:auth"));
    router.replace("/");
  };

  const verify = async (value = code) => {
    if (value.length !== 6) return;
    setBusy(true);
    setError(null);
    const name = claimed ? claimed.callName : firstName.trim();
    const intent =
      mode === "signin"
        ? { type: "signin" }
        : mode === "create"
          ? { type: "create", familyName: familyName.trim(), firstName: name, callName: callName.trim() || undefined }
          : { type: "join", inviteCode: inviteCode.trim(), firstName: name, callName: claimed ? undefined : callName.trim() || undefined, claimMemberId: claimed?.id };
    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email,
          code: value,
          tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
          birthday: month && day ? `${month}-${day}` : undefined,
          city: city.trim() || undefined,
          intent,
        }),
      });
      const data = (await res.json()) as { error?: string; welcome?: string };
      if (!res.ok) throw new Error(data.error ?? "failed");
      if (data.welcome) {
        try {
          sessionStorage.setItem("aangan:welcome", data.welcome);
        } catch {
          /* private mode */
        }
      }
      if (mode === "create") {
        // Signed in: now the other side of the window.
        setBusy(false);
        setStep("other-side");
        return;
      }
      enter();
    } catch (e) {
      const key = (e as Error).message;
      setError(ERRORS[key] ?? "Something went wrong. Try again.");
      if (key === "wrong-code") setCode("");
      setBusy(false);
    }
  };

  const back = () => {
    setError(null);
    if (step === "other-side" || step === "invite") enter();
    else if (step === "code") setStep("email");
    else if (step === "email" && mode !== "signin") setStep("details");
    else router.push("/");
  };

  return (
    <div className="fixed inset-0 z-30 overflow-y-auto bg-white">
      <div className="mx-auto flex min-h-full max-w-[480px] flex-col px-5" style={{ paddingTop: "calc(16px + env(safe-area-inset-top))", paddingBottom: "calc(24px + env(safe-area-inset-bottom))" }}>
        <button type="button" onClick={back} aria-label={step === "other-side" || step === "invite" ? "Skip for now" : "Back"} className="press -ml-2 grid h-11 w-11 place-items-center rounded-full">
          <Icon name={step === "other-side" || step === "invite" ? "close" : "back"} />
        </button>
        <h1 className="m-0 mt-4 text-[32px] leading-[1.08]">{title}</h1>

        {step === "details" && (
          <form
            className="flex flex-1 flex-col"
            onSubmit={(e) => {
              e.preventDefault();
              if (detailsValid) setStep("email");
            }}
          >
            <p className="m-0 mt-2 text-[16px] text-ink-soft">{mode === "create" ? "A window into your parents' home, and theirs into yours." : "Use the code your family sent you."}</p>
            {mode === "create" ? (
              <Field label="Family name">
                <input className={input} value={familyName} onChange={(e) => setFamilyName(e.target.value)} placeholder="Sharma" maxLength={40} autoFocus />
              </Field>
            ) : (
              <Field label="Invite code">
                <input className={`${input} tnum uppercase tracking-[0.12em]`} value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} placeholder="ABC123" maxLength={64} autoCapitalize="characters" autoFocus={!inviteCode} />
              </Field>
            )}
            {mode === "join" && peek && peek.places.length > 0 && (
              <div className="mt-4">
                <span className="mb-1.5 block text-[13px] font-medium text-ink-soft">Which one is you?</span>
                <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5" role="radiogroup" aria-label="Which one is you?">
                  {peek.places.map((p) => (
                    <button key={p.id} type="button" role="radio" aria-checked={claim === p.id} onClick={() => setClaim(claim === p.id ? null : p.id)} className={cn("press h-11 shrink-0 rounded-full px-5 text-[15px] font-semibold", claim === p.id ? "bg-ink text-white" : "bg-surface")}>
                      I&rsquo;m {p.callName}
                    </button>
                  ))}
                  <button type="button" role="radio" aria-checked={claim === null} onClick={() => setClaim(null)} className={cn("press h-11 shrink-0 rounded-full px-5 text-[15px] font-medium", claim === null ? "bg-ink text-white" : "bg-surface")}>
                    Someone else
                  </button>
                </div>
              </div>
            )}
            {!claimed && (
              <>
                <Field label="Your first name">
                  <input className={input} value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Arjun" maxLength={40} autoComplete="given-name" />
                </Field>
                <Field label="What the family calls you" hint="Leave empty to use your name.">
                  <input className={input} value={callName} onChange={(e) => setCallName(e.target.value)} placeholder="Beta, Didi, Maa…" maxLength={40} />
                </Field>
              </>
            )}
            <Field label="Your city" hint="The other home sees your sky and the time there.">
              <input className={input} value={city} onChange={(e) => setCity(e.target.value)} placeholder="Bengaluru" maxLength={60} autoComplete="address-level2" />
            </Field>
            {mode === "create" && (
              <Field label="Your birthday" hint="We never ask for the year.">
                <div className="flex gap-2">
                  <select className={`${input} appearance-none`} value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Birthday month">
                    <option value="">Month</option>
                    {MONTHS.map((m, i) => (
                      <option key={m} value={String(i + 1).padStart(2, "0")}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <select className={`${input} w-[120px] appearance-none`} value={day} onChange={(e) => setDay(e.target.value)} aria-label="Birthday day">
                    <option value="">Day</option>
                    {Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, "0")).map((d) => (
                      <option key={d} value={d}>
                        {Number(d)}
                      </option>
                    ))}
                  </select>
                </div>
              </Field>
            )}
            <div className="flex-1" />
            <Button type="submit" className="mt-8 w-full" disabled={!detailsValid}>
              Continue
            </Button>
          </form>
        )}

        {step === "email" && (
          <form
            className="flex flex-1 flex-col"
            onSubmit={(e) => {
              e.preventDefault();
              void sendCode();
            }}
          >
            <p className="m-0 mt-2 text-[16px] text-ink-soft">
              We&rsquo;ll email you a 6-digit code. No password.
              {mode === "join" ? " Already in another family? Use the same email: you'll be in both." : ""}
            </p>
            <Field label="Email">
              <input className={input} type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoFocus />
            </Field>
            {error && (
              <p className="m-0 mt-3 text-[14px] text-[#b42318]" role="alert">
                {error}
              </p>
            )}
            <div className="flex-1" />
            <Button type="submit" className="mt-8 w-full" disabled={busy || !/^\S+@\S+\.\S+$/.test(email)}>
              {busy ? "Sending…" : "Send code"}
            </Button>
            {mode === "signin" && (
              <p className="m-0 mt-4 text-center text-[15px] text-ink-soft">
                New here?{" "}
                <Link href="/create" className="font-semibold text-ink">
                  Create
                </Link>{" "}
                or{" "}
                <Link href="/join" className="font-semibold text-ink">
                  join with a code
                </Link>
              </p>
            )}
          </form>
        )}

        {step === "code" && (
          <div className="flex flex-1 flex-col">
            <p className="m-0 mt-2 text-[16px] text-ink-soft">
              Enter the code we sent to <span className="font-semibold text-ink">{email}</span>.
            </p>
            {mock && <p className="m-0 mt-2 rounded-[16px] bg-surface px-4 py-2.5 text-[14px] text-ink-soft">Demo mode: no email is sent. Use 000000.</p>}
            <label className="mt-6 block">
              <span className="sr-only">6-digit code</span>
              <input
                ref={codeRef}
                value={code}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                  setCode(v);
                  if (v.length === 6) void verify(v);
                }}
                className="tnum h-[64px] w-full rounded-[20px] bg-surface text-center text-[30px] font-bold tracking-[0.5em] outline-none focus:ring-2 focus:ring-black/15"
                placeholder="······"
              />
            </label>
            {error && (
              <p className="m-0 mt-3 text-[14px] text-[#b42318]" role="alert">
                {error}
              </p>
            )}
            <button type="button" onClick={() => void sendCode()} disabled={busy} className="mt-3 h-11 self-center text-[15px] font-medium text-ink-soft">
              Send a new code
            </button>
            <div className="flex-1" />
            <Button className="mt-8 w-full" disabled={busy || code.length !== 6} onClick={() => void verify()}>
              {busy ? "Checking…" : mode === "create" ? "Open our window" : mode === "join" ? "Join" : "Sign in"}
            </Button>
          </div>
        )}

        {step === "other-side" && (
          <OtherSide
            onDone={async (names) => {
              setFarNames(names);
              const out = await postJson<{ invite: { code: string } }>("/api/invites", {});
              setInvite(out?.invite.code ?? null);
              setStep("invite");
            }}
            onSkip={enter}
          />
        )}

        {step === "invite" && <InviteStep code={invite} names={farNames} from={callName.trim() || firstName.trim()} onDone={enter} />}
      </div>
    </div>
  );
}

type They = "parents" | "children" | "other";
const THEY: { id: They; label: string }[] = [
  { id: "parents", label: "My parents" },
  { id: "children", label: "My children" },
  { id: "other", label: "Other family" },
];

/** Add the home on the other side: 1–n people, any roles, each with a call name and city. */
function OtherSide({ onDone, onSkip }: { onDone: (names: string[]) => Promise<void>; onSkip: () => void }) {
  const [they, setThey] = useState<They>("parents");
  const [people, setPeople] = useState<{ callName: string; city: string }[]>([{ callName: "", city: "" }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = people.filter((p) => p.callName.trim());
  const set = (i: number, patch: Partial<{ callName: string; city: string }>) => setPeople((ps) => ps.map((p, n) => (n === i ? { ...p, ...patch } : p)));
  return (
    <form
      className="flex flex-1 flex-col"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!ready.length || busy) return;
        setBusy(true);
        setError(null);
        // Everyone in one home shares a city: fill blanks from the first one given.
        const shared = ready.find((p) => p.city.trim())?.city.trim() ?? "";
        const out = await postJson<{ members: { displayName: string }[] }>("/api/members/other-side", { they, people: ready.map((p) => ({ callName: p.callName.trim(), city: p.city.trim() || shared })) });
        if (!out) {
          setBusy(false);
          setError("Couldn't add them. Check the names and try again.");
          return;
        }
        await onDone(out.members.map((m) => m.displayName));
      }}
    >
      <p className="m-0 mt-2 text-[16px] text-ink-soft">Who&rsquo;s in the home on the other side? Add them by the name you call them.</p>
      <div className="mt-4 flex gap-2" role="radiogroup" aria-label="They are">
        {THEY.map((t) => (
          <button key={t.id} type="button" role="radio" aria-checked={they === t.id} onClick={() => setThey(t.id)} className={cn("press h-10 flex-1 rounded-full text-[14px] font-medium", they === t.id ? "bg-ink text-white" : "bg-surface")}>
            {t.label}
          </button>
        ))}
      </div>
      <ul className="m-0 mt-2 list-none space-y-3 p-0">
        {people.map((p, i) => (
          <li key={i} className="flex items-end gap-2">
            <div className="grid min-w-0 flex-1 grid-cols-2 gap-2">
              <Field label={i === 0 ? "They're called" : "And"}>
                <input className={input} value={p.callName} onChange={(e) => set(i, { callName: e.target.value.slice(0, 40) })} placeholder={they === "children" ? "Arjun" : i === 0 ? "Maa" : "Papa"} aria-label={`Person ${i + 1} name`} />
              </Field>
              <Field label={i === 0 ? "City" : " "}>
                <input className={input} value={p.city} onChange={(e) => set(i, { city: e.target.value.slice(0, 60) })} placeholder={i === 0 ? "Kanpur" : "Same city"} aria-label={`Person ${i + 1} city`} />
              </Field>
            </div>
            {people.length > 1 && (
              <button type="button" aria-label={`Remove person ${i + 1}`} onClick={() => setPeople((ps) => ps.filter((_, n) => n !== i))} className="press mb-1 grid h-11 w-11 shrink-0 place-items-center rounded-full text-ink-soft">
                <Icon name="close" size={18} />
              </button>
            )}
          </li>
        ))}
      </ul>
      {people.length < 6 && (
        <button type="button" onClick={() => setPeople((ps) => [...ps, { callName: "", city: "" }])} className="press mt-3 flex h-11 items-center justify-center gap-2 self-start rounded-full bg-surface px-4 text-[15px] font-medium">
          <Icon name="plus" size={18} />
          Add someone
        </button>
      )}
      {error && (
        <p className="m-0 mt-3 text-[14px] text-[#b42318]" role="alert">
          {error}
        </p>
      )}
      <div className="flex-1" />
      <Button type="submit" className="mt-8 w-full" disabled={busy || ready.length === 0}>
        {busy ? "Adding…" : "Continue"}
      </Button>
      <Button variant="quiet" className="mt-1 w-full" onClick={onSkip}>
        Later
      </Button>
    </form>
  );
}

/** One tap: WhatsApp the join link and code. */
function InviteStep({ code, names, from, onDone }: { code: string | null; names: string[]; from: string; onDone: () => void }) {
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => setOrigin(window.location.origin), []);
  if (!code) {
    return (
      <div className="flex flex-1 flex-col">
        <p className="m-0 mt-2 text-[16px] text-ink-soft">We couldn&rsquo;t make an invite just now. You can send one later from the window.</p>
        <div className="flex-1" />
        <Button className="mt-8 w-full" onClick={onDone}>
          Open the window
        </Button>
      </div>
    );
  }
  return (
    <div className="flex flex-1 flex-col">
      <p className="m-0 mt-2 text-[16px] text-ink-soft">Send them the link. They tap it, pick their name, and their window opens onto yours.</p>
      <p className="tnum m-0 mt-6 rounded-[22px] bg-surface py-4 text-center text-[28px] font-bold tracking-[0.12em]">{code}</p>
      <p className="m-0 mt-2 text-center text-[13px] text-ink-faint">Works for 7 days</p>
      <div className="flex-1" />
      <a href={whatsappInvite(origin, code, from || undefined)} target="_blank" rel="noopener noreferrer" className="press mt-8 flex h-[52px] items-center justify-center gap-2 rounded-full bg-black text-[16px] font-semibold text-white no-underline">
        <Icon name="whatsapp" size={20} />
        Send on WhatsApp
      </a>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(joinLink(origin, code));
            setCopied(true);
          } catch {
            /* no clipboard */
          }
        }}
        className="press mt-2 flex h-11 items-center justify-center gap-2 rounded-full text-[15px] font-medium text-ink-soft"
      >
        <Icon name={copied ? "check" : "share"} size={18} />
        {copied ? "Link copied" : "Copy the link"}
      </button>
      <Button variant="secondary" className="mt-2 w-full" onClick={onDone}>
        {names.length ? "Open my window" : "Done"}
      </Button>
    </div>
  );
}
