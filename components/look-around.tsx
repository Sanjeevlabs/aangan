"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "./ui/kit";

// Google's own live Street View and Photorealistic 3D view of a place, shown
// inside Aangan with Google's attribution. Nothing is fetched ahead, stored
// or copied (Map Tiles API policies); the view loads only when tapped.

const KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? "";
export const canLookAround = KEY.length > 0;

let loading: Promise<void> | null = null;
function loadMaps(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("no-window"));
  if ((window as unknown as { google?: { maps?: unknown } }).google?.maps) return Promise.resolve();
  loading ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(KEY)}&v=beta&libraries=maps3d`;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      loading = null;
      reject(new Error("maps-load-failed"));
    };
    document.head.appendChild(s);
  });
  return loading;
}

type GMaps = {
  maps: {
    StreetViewPanorama: new (el: HTMLElement, opts: Record<string, unknown>) => unknown;
    StreetViewService: new () => { getPanorama: (req: Record<string, unknown>) => Promise<{ data: { location?: { latLng?: unknown } } }> };
  };
};

export function LookAround({ name, lat, lng, onClose }: { name: string; lat: number; lng: number; onClose: () => void }) {
  const [mode, setMode] = useState<"3d" | "street">("3d");
  const [error, setError] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    const el = box.current;
    if (!el) return;
    el.innerHTML = "";
    setError(null);
    loadMaps()
      .then(async () => {
        if (!alive || !box.current) return;
        const g = (window as unknown as { google: GMaps }).google;
        if (mode === "street") {
          // Only open Street View where Google has imagery near the place.
          const found = await new g.maps.StreetViewService().getPanorama({ location: { lat, lng }, radius: 120 }).catch(() => null);
          if (!alive || !box.current) return;
          if (!found?.data.location?.latLng) return setError("No street-level view near this place. Try 3D.");
          new g.maps.StreetViewPanorama(box.current, { position: found.data.location.latLng, pov: { heading: 0, pitch: 0 }, addressControl: false, fullscreenControl: false, motionTracking: false });
        } else {
          const map = document.createElement("gmp-map-3d") as HTMLElement & { flyCameraAround?: (o: Record<string, unknown>) => void };
          map.setAttribute("center", `${lat},${lng},0`);
          map.setAttribute("range", "420");
          map.setAttribute("tilt", "67");
          map.setAttribute("heading", "0");
          map.setAttribute("mode", "hybrid");
          map.style.width = "100%";
          map.style.height = "100%";
          box.current.appendChild(map);
          // A slow, single circle around the place.
          window.setTimeout(() => map.flyCameraAround?.({ camera: { center: { lat, lng, altitude: 0 }, range: 420, tilt: 67, heading: 0 }, durationMillis: 24000, repeatCount: 1 }), 1500);
        }
      })
      .catch(() => alive && setError("Couldn't load the live view. Check the connection."));
    return () => {
      alive = false;
    };
  }, [mode, lat, lng]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-white" role="dialog" aria-modal="true" aria-label={`Look around ${name}`}>
      <div className="flex items-center justify-between gap-2 px-4" style={{ paddingTop: "calc(12px + env(safe-area-inset-top))", paddingBottom: 10 }}>
        <p className="m-0 min-w-0 truncate text-[16px] font-semibold">{name}</p>
        <div className="flex shrink-0 gap-1.5">
          {(["3d", "street"] as const).map((m) => (
            <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)} className={`press h-10 rounded-full px-4 text-[14px] font-semibold ${mode === m ? "bg-white text-black" : "bg-white/15"}`}>
              {m === "3d" ? "3D" : "Street"}
            </button>
          ))}
          <button type="button" onClick={onClose} aria-label="Close" className="press grid h-10 w-10 place-items-center rounded-full bg-white/15">
            <Icon name="close" />
          </button>
        </div>
      </div>
      <div ref={box} className="relative min-h-0 flex-1 bg-[#111]" />
      {error && <p className="m-0 px-5 py-4 text-center text-[14px] text-white/80">{error}</p>}
      <p className="m-0 px-5 pb-3 pt-2 text-center text-[11.5px] text-white/50" style={{ paddingBottom: "calc(12px + env(safe-area-inset-bottom))" }}>
        Live view from Google Maps. Aangan doesn&rsquo;t store it.
      </p>
    </div>
  );
}
