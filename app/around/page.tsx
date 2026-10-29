"use client";

import { AnimatePresence, m } from "framer-motion";
import { useEffect, useState } from "react";
import { cardImage } from "@/components/albums";
import { LookAround, canLookAround } from "@/components/look-around";
import { Neighbourhood, PLACE_LOOK, coordsFromLink } from "@/components/neighbourhood";
import { usePlayer } from "@/components/player";
import { useShell } from "@/components/shell";
import { ActionMenu, Avatar, Button, EmptyLine, Icon, MuseMark, Photo, RoomHeader, SectionTitle } from "@/components/ui/kit";
import { useViewer } from "@/components/viewer";
import { householdName, households } from "@/lib/households";
import { PLACE_KINDS } from "@/lib/kind-values";
import type { Place } from "@/lib/kinds";
import { canChange } from "@/lib/permissions";
import { callName, memberPhoto } from "@/lib/people";
import type { PlaceSuggestion } from "@/lib/places";
import type { Card } from "@/lib/schemas";
import { useFamilyCards } from "@/lib/use-family";
import { postJson, useJson } from "@/lib/use-json";
import { cn } from "@/lib/utils";
import { placeFromTz } from "@/lib/zones";

// Around home: the temple, the market, the old school, the tea stall: the
// places around a parent's home, kept with the family's own photos and voices.
// Look around in Google's live 3D / Street View when a place has a pin.

export default function AroundPage() {
  const { viewer, members, relationships } = useViewer();
  const { refreshKey } = useShell();
  const { cards } = useFamilyCards(refreshKey);
  const homes = households(members, relationships).filter((h) => h.elders);
  const [homeId, setHomeId] = useState<string | null>(null);
  const home = homes.find((h) => h.id === homeId) ?? homes.find((h) => h.members.some((x) => x.id === viewer.id)) ?? homes[0];
  const near = home?.members.find((x) => x.role === "elder") ?? home?.members[0];
  const { data, reload } = useJson<{ places: Place[]; suggestions: PlaceSuggestion[] }>(near ? `/api/places?near=${near.id}` : null);
  const [selected, setSelected] = useState<string | null>(null);
  const [adding, setAdding] = useState<Partial<Place> | null>(null);
  const [looking, setLooking] = useState<Place | null>(null);
  const places = data?.places ?? [];
  const place = places.find((p) => p.id === selected) ?? null;
  const child = viewer.access === "child";
  useEffect(() => setSelected(null), [homeId]);

  if (!home || !near) {
    return (
      <div>
        <RoomHeader title="Around home" />
        <EmptyLine>Add a parent or grandparent to the family first.</EmptyLine>
      </div>
    );
  }

  return (
    <div>
      <RoomHeader title="Around home" subtitle={`The places that matter around ${householdName(home, (x) => callName(x))}'s home, ${placeFromTz(home.tz)}`} />
      {homes.length > 1 && (
        <div className="no-scrollbar -mx-5 mb-3 flex gap-2 overflow-x-auto px-5">
          {homes.map((h) => (
            <button key={h.id} type="button" onClick={() => setHomeId(h.id)} aria-pressed={h.id === home.id} className={cn("press flex h-11 shrink-0 items-center gap-2 rounded-full pl-1 pr-4 text-[15px] font-medium", h.id === home.id ? "bg-black text-white" : "bg-surface")}>
              <span className="flex -space-x-2">
                {h.members.slice(0, 2).map((x) => (
                  <Avatar key={x.id} src={memberPhoto(x)} name={callName(x)} size={30} />
                ))}
              </span>
              {householdName(h, (x) => callName(x))}
            </button>
          ))}
        </div>
      )}

      {data === null ? (
        <div className="skeleton h-[300px] rounded-[28px]" aria-busy="true" aria-label="Loading places" />
      ) : (
        <div className="-mx-1">
          <Neighbourhood places={places} selected={selected} onSelect={(id) => setSelected(id === selected ? null : id)} />
        </div>
      )}

      <AnimatePresence mode="wait">
        {place && (
          <m.section key={place.id} aria-label={place.name} className="mt-4 rounded-card bg-surface p-4" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <PlaceDetail
              place={place}
              cards={cards ?? []}
              canEdit={!child}
              canDelete={canChange(viewer, place.addedBy)}
              onLook={() => setLooking(place)}
              onEdit={() => setAdding(place)}
              onChange={async () => {
                await reload();
              }}
              onDeleted={async () => {
                setSelected(null);
                await reload();
              }}
            />
          </m.section>
        )}
      </AnimatePresence>

      {!place && places.length > 0 && <p className="m-0 mt-3 text-center text-[13px] text-ink-soft">Tap a place to see its memories.</p>}

      {!child && (data?.suggestions.length ?? 0) > 0 && (
        <section aria-label="Places your family mentions">
          <SectionTitle>Places your family mentions</SectionTitle>
          <ul className="m-0 list-none space-y-2 p-0">
            {data?.suggestions.map((s) => (
              <li key={s.name} className="flex items-center gap-3 rounded-card bg-surface p-3.5">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-white" style={{ background: PLACE_LOOK[s.kind].color }} aria-hidden="true">
                  <Icon name="village" size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold">{s.name}</span>
                  <span className="voice block truncate text-[14px] text-ink-soft">&ldquo;{s.quote}&rdquo;</span>
                </span>
                <button type="button" onClick={() => setAdding({ name: s.name, kind: s.kind })} className="press h-10 shrink-0 rounded-full bg-black px-4 text-[14px] font-semibold text-white">
                  Add
                </button>
              </li>
            ))}
          </ul>
          <MuseMark className="mt-2">found by Muse in your family&rsquo;s own voice notes and notes</MuseMark>
        </section>
      )}

      {!child && (
        <Button className="mt-6 w-full" onClick={() => setAdding({ kind: "temple" })}>
          <Icon name="plus" size={18} />
          Add a place
        </Button>
      )}
      {places.length === 0 && data && <EmptyLine>Start with the place they go every day: the temple, the market, a friend&rsquo;s house.</EmptyLine>}

      <AnimatePresence>
        {adding && (
          <PlaceForm
            initial={adding}
            nearMemberId={near.id}
            onDone={async (id) => {
              setAdding(null);
              await reload();
              if (id) setSelected(id);
            }}
          />
        )}
      </AnimatePresence>
      {looking && looking.lat !== null && looking.lng !== null && <LookAround name={looking.name} lat={looking.lat} lng={looking.lng} onClose={() => setLooking(null)} />}
    </div>
  );
}

function PlaceDetail({ place, cards, canEdit, canDelete, onLook, onEdit, onChange, onDeleted }: { place: Place; cards: Card[]; canEdit: boolean; canDelete: boolean; onLook: () => void; onEdit: () => void; onChange: () => Promise<void>; onDeleted: () => Promise<void> }) {
  const { members } = useViewer();
  const { play, current, isPlaying, toggle } = usePlayer();
  const [picking, setPicking] = useState(false);
  const here = place.cardIds.map((id) => cards.find((c) => c.id === id)).filter((c): c is Card => Boolean(c));
  const look = PLACE_LOOK[place.kind];
  const pinned = place.lat !== null && place.lng !== null;
  return (
    <>
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-white" style={{ background: look.color }} aria-hidden="true">
          <Icon name={place.kind === "home" ? "door" : "village"} size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="m-0 text-[12px] font-semibold uppercase tracking-[0.06em]" style={{ color: look.color }}>
            {look.label}
          </p>
          <p className="m-0 text-[19px] font-semibold leading-tight">{place.name}</p>
        </div>
        {(canEdit || canDelete) && (
          <ActionMenu
            label={`${place.name} options`}
            actions={[
              ...(canEdit ? [{ label: "Edit", onSelect: onEdit }] : []),
              ...(canDelete ? [{ label: "Remove place", danger: true, confirm: `Remove ${place.name}? Its photos stay in Memory Lane.`, onSelect: async () => { await postJson("/api/places", { action: "delete", placeId: place.id }); await onDeleted(); } }] : []),
            ]}
          />
        )}
      </div>
      {place.note && <p className="voice m-0 mt-3 text-[17px] leading-snug">{place.note}</p>}

      {pinned && canLookAround && (
        <button type="button" onClick={onLook} className="press mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-black text-[15px] font-semibold text-white">
          <Icon name="sun" size={18} />
          Look around in 3D
        </button>
      )}
      {pinned && !canLookAround && (
        <a href={`https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}`} target="_blank" rel="noreferrer" className="press mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-white text-[15px] font-semibold text-ink no-underline">
          Open in Google Maps
        </a>
      )}

      {here.length > 0 && (
        <ul className="no-scrollbar -mx-4 m-0 mt-4 flex list-none gap-2 overflow-x-auto p-0 px-4">
          {here.map((c) => {
            const by = members.find((x) => x.id === c.authorId);
            if (c.type === "audio") {
              const on = current?.id === c.id;
              return (
                <li key={c.id} className="w-[150px] shrink-0">
                  <button type="button" onClick={() => (on ? toggle() : play(c))} className="press flex h-[120px] w-full flex-col justify-between rounded-[18px] bg-[#fff6e6] p-3 text-left">
                    <span className="grid h-9 w-9 place-items-center rounded-full bg-black text-white">
                      <Icon name={on && isPlaying ? "pause" : "play"} size={16} />
                    </span>
                    <span className="block text-[13px] font-semibold">{callName(by)}&rsquo;s voice</span>
                  </button>
                </li>
              );
            }
            const src = cardImage(c);
            return (
              <li key={c.id} className="relative h-[120px] w-[150px] shrink-0 overflow-hidden rounded-[18px] bg-white">
                {src && <Photo src={src} alt={c.caption} sizes="160px" />}
                {canEdit && (
                  <button type="button" aria-label="Remove from this place" onClick={async () => { await postJson("/api/places", { action: "detach", placeId: place.id, cardId: c.id }); await onChange(); }} className="press absolute right-1.5 top-1.5 grid h-8 w-8 place-items-center rounded-full bg-black/45 text-white">
                    <Icon name="close" size={14} />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {canEdit && (
        <>
          <button type="button" onClick={() => setPicking((v) => !v)} className="press mt-3 flex h-10 items-center gap-1.5 text-[14px] font-semibold">
            <Icon name="plus" size={16} />
            Add a photo or voice from Memory Lane
          </button>
          {picking && (
            <ul className="no-scrollbar -mx-4 m-0 mt-1 flex list-none gap-2 overflow-x-auto p-0 px-4 pb-1">
              {cards
                .filter((c) => !place.cardIds.includes(c.id))
                .slice(0, 30)
                .map((c) => {
                  const src = c.type === "audio" ? null : cardImage(c);
                  return (
                    <li key={c.id} className="w-[96px] shrink-0">
                      <button type="button" onClick={async () => { await postJson("/api/places", { action: "attach", placeId: place.id, cardId: c.id }); await onChange(); }} className="press relative block h-[96px] w-full overflow-hidden rounded-[14px] bg-white text-left" aria-label={`Add ${c.caption || "memory"}`}>
                        {src ? <Photo src={src} alt="" sizes="100px" /> : <span className="flex h-full items-end p-2 text-[11.5px] font-medium">🎙 {c.caption.slice(0, 36)}</span>}
                      </button>
                    </li>
                  );
                })}
            </ul>
          )}
        </>
      )}
    </>
  );
}

function PlaceForm({ initial, nearMemberId, onDone }: { initial: Partial<Place>; nearMemberId: string; onDone: (id?: string) => void }) {
  const [name, setName] = useState(initial.name ?? "");
  const [kind, setKind] = useState<Place["kind"]>(initial.kind ?? "temple");
  const [note, setNote] = useState(initial.note ?? "");
  const [link, setLink] = useState(initial.lat != null && initial.lng != null ? `${initial.lat}, ${initial.lng}` : "");
  const [error, setError] = useState<string | null>(null);
  const coords = link.trim() ? coordsFromLink(link) : null;
  const here = () =>
    navigator.geolocation?.getCurrentPosition(
      (p) => setLink(`${p.coords.latitude.toFixed(5)}, ${p.coords.longitude.toFixed(5)}`),
      () => setError("Couldn't get your location."),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label={initial.id ? "Edit place" : "Add a place"}>
      <m.button type="button" aria-label="Close" className="absolute inset-0 bg-black/25" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => onDone()} />
      <m.div className="relative max-h-[92vh] w-full max-w-[480px] overflow-y-auto rounded-t-[32px] bg-white px-5 pt-4 shadow-frost" style={{ paddingBottom: "calc(20px + env(safe-area-inset-bottom))" }} initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", stiffness: 340, damping: 36 }}>
        <p className="m-0 text-[20px] font-semibold">{initial.id ? "Edit place" : "Add a place"}</p>
        <input value={name} onChange={(e) => setName(e.target.value.slice(0, 60))} placeholder="The temple at the corner" className="mt-3 h-[52px] w-full rounded-[16px] bg-surface px-4 text-[16px] font-semibold outline-none" aria-label="Name" />
        <div className="mt-3 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Kind of place">
          {PLACE_KINDS.map((k) => (
            <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)} className={cn("press h-9 rounded-full px-3 text-[13.5px]", kind === k ? "bg-black text-white" : "bg-surface")}>
              {PLACE_LOOK[k].label}
            </button>
          ))}
        </div>
        <textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 240))} rows={2} placeholder="Why it matters (Dadi walks here every morning)" className="mt-3 w-full resize-none rounded-[16px] bg-surface p-4 text-[15px] outline-none" aria-label="Note" />
        <p className="m-0 mb-1.5 mt-3 text-[13px] font-medium text-ink-soft">Where it is (optional, for the 3D view)</p>
        <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Paste a Google Maps link, or 26.4499, 80.3319" className="h-[48px] w-full rounded-full bg-surface px-4 text-[14px] outline-none" aria-label="Location link or coordinates" />
        <div className="mt-1.5 flex items-center justify-between">
          <button type="button" onClick={here} className="h-9 text-[13px] font-semibold text-ink-soft">
            I&rsquo;m there now: use my location
          </button>
          {link.trim() && <span className={cn("text-[12px]", coords ? "text-[#3d6b2a]" : "text-[#b42318]")}>{coords ? "Pinned" : "Can't read that link"}</span>}
        </div>
        <p className="m-0 mt-1 text-[12px] text-ink-faint">Prefer public places (a temple, a market) to the house itself. Only your family sees this.</p>
        {error && <p className="m-0 mt-2 text-[13px] text-[#b42318]">{error}</p>}
        <div className="mt-4 flex gap-2">
          <Button
            className="flex-[1.4]"
            disabled={!name.trim() || (link.trim() !== "" && !coords)}
            onClick={async () => {
              const fields = { name: name.trim(), kind, note: note.trim(), lat: coords?.lat ?? null, lng: coords?.lng ?? null, googlePlaceId: null };
              const out = await postJson<{ place?: Place }>("/api/places", initial.id ? { action: "edit", placeId: initial.id, ...fields } : { action: "add", nearMemberId, ...fields });
              if (!out) return setError("Couldn't save. Try again.");
              onDone(out.place?.id);
            }}
          >
            Save
          </Button>
          <Button variant="secondary" className="flex-1" onClick={() => onDone()}>
            Cancel
          </Button>
        </div>
      </m.div>
    </div>
  );
}
