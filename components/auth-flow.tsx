"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { resetFamilyCards } from "@/lib/use-family";
import { useShell } from "./shell";
import { Button, Icon } from "./ui/kit";

type Mode = "create" | "join" | "signin";
type Step = "details" | "email" | "code";

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

const input = "h-[52px] w-full rounded-full bg-surface px-5 text-[16px] outline-none placeholder:text-ink-faint focus:ring-2 focus:ring-marigold";

export function AuthFlow({ mode }: { mode: Mode }) {
  const router = useRouter();
  const { setChromeHidden } = useShell();
  const [step, setStep] = useState<Step>(mode === "signin" ? "email" : "details");
  const [familyName, setFamilyName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [firstName, setFirstName] = useState("");
  const [callName, setCallName] = useState("");
  const [month, setMonth] = useState("");
  const [day, setDay] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [mock, setMock] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setChromeHidden(true);
    return () => setChromeHidden(false);
  }, [setChromeHidden]);
  useEffect(() => {
    if (step === "code") codeRef.current?.focus();
  }, [step]);

  const title =
    step === "email" ? (mode === "signin" ? "Welcome back" : "Your email") : step === "code" ? "Check your email" : mode === "create" ? "Start your family's Aangan" : "Join your family";

  const detailsValid = firstName.trim() && month && day && (mode === "create" ? familyName.trim() : inviteCode.trim().length >= 4);

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

  const verify = async (value = code) => {
    if (value.length !== 6) return;
    setBusy(true);
    setError(null);
    const intent =
      mode === "signin"
        ? { type: "signin" }
        : mode === "create"
          ? { type: "create", familyName: familyName.trim(), firstName: firstName.trim(), callName: callName.trim() || undefined }
          : { type: "join", inviteCode: inviteCode.trim(), firstName: firstName.trim(), callName: callName.trim() || undefined };
    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email,
          code: value,
          tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
          birthday: month && day ? `${month}-${day}` : undefined,
          intent,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "failed");
      resetFamilyCards();
      try {
        sessionStorage.removeItem("aangan:entered");
      } catch {
        /* ignore */
      }
      window.dispatchEvent(new Event("aangan:auth"));
      router.replace("/");
    } catch (e) {
      const key = (e as Error).message;
      setError(ERRORS[key] ?? "Something went wrong. Try again.");
      if (key === "wrong-code") setCode("");
      setBusy(false);
    }
  };

  const back = () => {
    setError(null);
    if (step === "code") setStep("email");
    else if (step === "email" && mode !== "signin") setStep("details");
    else router.push("/");
  };

  return (
    <div className="fixed inset-0 z-30 overflow-y-auto bg-white">
      <div className="mx-auto flex min-h-full max-w-[480px] flex-col px-5" style={{ paddingTop: "calc(16px + env(safe-area-inset-top))", paddingBottom: "calc(24px + env(safe-area-inset-bottom))" }}>
        <button type="button" onClick={back} aria-label="Back" className="press -ml-2 grid h-11 w-11 place-items-center rounded-full">
          <Icon name="back" />
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
            <p className="m-0 mt-2 text-[16px] text-ink-soft">
              {mode === "create" ? "You'll invite everyone else once you're in." : "Use the code a family member shared with you."}
            </p>
            {mode === "create" ? (
              <Field label="Family name">
                <input className={input} value={familyName} onChange={(e) => setFamilyName(e.target.value)} placeholder="The Sharma family" maxLength={40} autoFocus />
              </Field>
            ) : (
              <Field label="Invite code">
                <input
                  className={`${input} tnum uppercase tracking-[0.12em]`}
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  placeholder="ABC123"
                  maxLength={64}
                  autoCapitalize="characters"
                  autoFocus
                />
              </Field>
            )}
            <Field label="Your first name">
              <input className={input} value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Arjun" maxLength={40} autoComplete="given-name" />
            </Field>
            <Field label="What the family calls you" hint="Papa, Maa, Dadi, Chachu… Leave empty to use your name.">
              <input className={input} value={callName} onChange={(e) => setCallName(e.target.value)} placeholder="Papa" maxLength={40} />
            </Field>
            <Field label="Your birthday" hint="So the family can celebrate it. We never ask for the year.">
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
            <p className="m-0 mt-2 text-[16px] text-ink-soft">We&rsquo;ll email you a 6-digit code. No password to remember.</p>
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
                  Start a family
                </Link>{" "}
                or{" "}
                <Link href="/join" className="font-semibold text-ink">
                  join one
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
            {mock && <p className="m-0 mt-2 rounded-[16px] bg-[#fff6e6] px-4 py-2.5 text-[14px] text-[#8a4b00]">Demo mode: no email is sent. Use 000000.</p>}
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
                className="tnum h-[64px] w-full rounded-[20px] bg-surface text-center text-[30px] font-bold tracking-[0.5em] outline-none focus:ring-2 focus:ring-marigold"
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
              {busy ? "Checking…" : mode === "create" ? "Create our Aangan" : mode === "join" ? "Join the family" : "Sign in"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
