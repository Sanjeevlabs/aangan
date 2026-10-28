"use client";

import { useEffect, useState } from "react";
import { useViewer } from "@/components/viewer";
import { PrimaryButton } from "@/components/ui/buttons";

interface Invite {
  id: string;
  code: string;
  expiresAt: string;
}

// Privacy set: in-app disclosure, "Remove my memories", "Leave family",
// expiring invites. No face recognition, no auto-tagging, no health content.
export default function PrivacyPage() {
  const { viewer, refreshMembers } = useViewer();
  const [invites, setInvites] = useState<Invite[] | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadInvites = async () => {
    try {
      const res = await fetch("/api/invites", { cache: "no-store" });
      if (res.ok) setInvites(((await res.json()) as { invites: Invite[] }).invites);
    } catch {
      setInvites([]);
    }
  };

  useEffect(() => {
    void loadInvites();
  }, []);

  const removeMemories = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/privacy/cards", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ memberId: viewer.id }),
      });
      setStatus(res.ok ? "Your wishes, reactions, plays and roles were deleted. Shared family cards stay with the family." : "Try again.");
    } finally {
      setBusy(false);
    }
  };

  const leaveFamily = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/privacy/membership", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ memberId: viewer.id }),
      });
      if (res.ok) {
        await refreshMembers().catch(() => undefined);
        setStatus("You left the family. Your profile, edges and traces were deleted; shared cards stay with the family.");
      } else {
        setStatus("Try again.");
      }
    } finally {
      setBusy(false);
    }
  };

  const newInvite = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/invites", { method: "POST" });
      if (res.ok) await loadInvites();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pt-2">
      <h1 className="serif mb-3 mt-0 text-3xl">Privacy</h1>
      <section aria-label="Disclosure" className="mb-6">
        <div className="rounded-card border border-line bg-surface p-4">
          <p className="m-0 text-[15px] text-ink-soft">
            Demo mode: AI providers may process content. Voices are never cloned. No face recognition, no auto-tagging
            of minors, no health advice anywhere in Aangan.
          </p>
        </div>
      </section>
      <section aria-label="Your data" className="mb-6">
        <h2 className="mb-2 mt-0 text-xl">Your data ({viewer.displayName})</h2>
        <div className="rounded-card border border-line bg-surface p-4">
          <p className="m-0 text-[14px] text-ink-soft">
            “Remove my memories” deletes your wishes, reactions, plays and daily roles. Shared family cards stay with
            the family pool. “Leave family” additionally deletes your profile and Bond edges.
          </p>
          {status && (
            <p className="mt-2 text-sm" role="status">
              {status}
            </p>
          )}
          <PrimaryButton className="mt-3 w-full" disabled={busy} onClick={() => void removeMemories()}>
            Remove my memories
          </PrimaryButton>
          <button
            type="button"
            disabled={busy}
            onClick={() => void leaveFamily()}
            className="tap mt-2 w-full rounded-card border border-ink/25 text-[15px] font-semibold"
          >
            Leave family
          </button>
        </div>
      </section>
      <section aria-label="Invites" className="mb-6">
        <h2 className="mb-2 mt-0 text-xl">Family invites</h2>
        <div className="rounded-card border border-line bg-surface p-4">
          <p className="m-0 text-[14px] text-ink-soft">Codes expire after 7 days.</p>
          <ul className="m-0 mt-2 list-none p-0">
            {(invites ?? []).map((i) => (
              <li key={i.id} className="flex items-center justify-between py-1 text-[15px]">
                <strong className="tracking-widest">{i.code}</strong>
                <span className="text-ink-soft">expires {i.expiresAt.slice(0, 10)}</span>
              </li>
            ))}
          </ul>
          {invites !== null && invites.length === 0 && <p className="text-sm text-ink-soft">No active invites.</p>}
          <PrimaryButton className="mt-3 w-full" disabled={busy} onClick={() => void newInvite()}>
            New invite code
          </PrimaryButton>
        </div>
      </section>
    </div>
  );
}
