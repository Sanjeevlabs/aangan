// Client-side upload queue: a parent's photo / video / voice note is saved on
// the device first (IndexedDB when available, memory otherwise), then sent
// with exponential backoff (1 s, 3 s, 9 s, 27 s; at most 5 tries) and resumed
// on `online` and on app start. The card id is made here, so a retry after a
// lost response upserts the same card instead of adding a second. Browser only.

export const MAX_TRIES = 5;
export const BACKOFF_MS = [1000, 3000, 9000, 27000];

export interface QueueFile {
  field: string;
  name: string;
  blob: Blob;
}

export interface QueueItem {
  /** Client-made UUID, also the card id. */
  id: string;
  /** Multipart body fields (photo / video) ... */
  fields?: Record<string, string>;
  files?: QueueFile[];
  /** ... or a JSON body (voice). */
  json?: Record<string, unknown>;
  /** Bytes still to PUT to a signed URL before the card is posted. */
  upload?: { blob: Blob; filename: string; mime: string };
  /** Best-effort POSTs once the card exists (letters, wishes, ...). */
  after?: { url: string; body: unknown }[];
  tries: number;
  nextAt: number;
}

export type SendResult = "ok" | "retry" | "drop";
export type ItemStatus = "sending" | "waiting" | "sent" | "failed";
export type Outcome = "sent" | "queued" | "dropped";
export type Send = (item: QueueItem, save: (item: QueueItem) => Promise<void>) => Promise<SendResult>;

export interface QueueStore {
  put(item: QueueItem): Promise<void>;
  del(id: string): Promise<void>;
  all(): Promise<QueueItem[]>;
}

export function memoryStore(): QueueStore {
  const m = new Map<string, QueueItem>();
  return {
    put: async (i) => void m.set(i.id, i),
    del: async (id) => void m.delete(id),
    all: async () => [...m.values()],
  };
}

/** Tiny IndexedDB wrapper (no deps). */
export function idbStore(name = "aangan-uploads"): QueueStore {
  let dbp: Promise<IDBDatabase> | null = null;
  const open = () =>
    (dbp ??= new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open(name, 1);
      r.onupgradeneeded = () => r.result.createObjectStore("q", { keyPath: "id" });
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    }));
  const run = async <T,>(mode: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
    const db = await open();
    return new Promise<T>((resolve, reject) => {
      const req = f(db.transaction("q", mode).objectStore("q"));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  };
  return {
    put: async (i) => void (await run("readwrite", (s) => s.put(i))),
    del: async (id) => void (await run("readwrite", (s) => s.delete(id))),
    all: () => run("readonly", (s) => s.getAll() as IDBRequest<QueueItem[]>),
  };
}

export interface QueueOptions {
  store: QueueStore;
  send: Send;
  now?: () => number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (t: unknown) => void;
}

export function createUploadQueue(opts: QueueOptions) {
  const now = opts.now ?? Date.now;
  const setTimer = opts.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = opts.clearTimer ?? ((t) => clearTimeout(t as ReturnType<typeof setTimeout>));
  const items = new Map<string, QueueItem>();
  const status = new Map<string, ItemStatus>();
  const waiters = new Map<string, ((r: Outcome) => void)[]>();
  const listeners = new Set<() => void>();
  let timer: unknown = null;
  let running = false;
  let loaded: Promise<void> | null = null;

  const emit = () => listeners.forEach((l) => l());
  const set = (id: string, s: ItemStatus) => {
    status.set(id, s);
    emit();
  };
  const settle = (id: string, r: Outcome) => {
    for (const w of waiters.get(id) ?? []) w(r);
    waiters.delete(id);
  };
  const load = () =>
    (loaded ??= opts.store
      .all()
      .then((all) => {
        for (const i of all) {
          if (items.has(i.id)) continue;
          items.set(i.id, i);
          status.set(i.id, i.tries >= MAX_TRIES ? "failed" : "waiting");
        }
      })
      .catch(() => undefined));

  function arm() {
    if (timer) clearTimer(timer);
    timer = null;
    const due = [...items.values()].filter((i) => i.tries < MAX_TRIES).map((i) => i.nextAt);
    if (!due.length) return;
    timer = setTimer(() => void pump(), Math.max(0, Math.min(...due) - now()));
  }

  async function pump(): Promise<void> {
    if (running) return;
    running = true;
    try {
      await load();
      for (const item of [...items.values()].sort((a, b) => a.nextAt - b.nextAt)) {
        if (item.tries >= MAX_TRIES || item.nextAt > now()) continue;
        set(item.id, "sending");
        let r: SendResult;
        try {
          r = await opts.send(item, async (u) => {
            items.set(u.id, u);
            await opts.store.put(u).catch(() => undefined);
          });
        } catch {
          r = "retry";
        }
        if (r === "ok" || r === "drop") {
          items.delete(item.id);
          await opts.store.del(item.id).catch(() => undefined);
          set(item.id, r === "ok" ? "sent" : "failed");
          settle(item.id, r === "ok" ? "sent" : "dropped");
        } else {
          const tries = item.tries + 1;
          const next: QueueItem = { ...(items.get(item.id) ?? item), tries, nextAt: now() + (BACKOFF_MS[tries - 1] ?? BACKOFF_MS[BACKOFF_MS.length - 1]) };
          items.set(item.id, next);
          await opts.store.put(next).catch(() => undefined);
          set(item.id, tries >= MAX_TRIES ? "failed" : "waiting");
          settle(item.id, "queued");
        }
      }
    } finally {
      running = false;
      arm();
    }
  }

  return {
    /**
     * Save, then try once straight away. Resolves after that first attempt:
     * "sent", "queued" (kept, will retry) or "dropped" (the server refused it).
     * The same id twice is not stored twice.
     */
    async enqueue(item: Omit<QueueItem, "tries" | "nextAt">): Promise<Outcome> {
      await load();
      if (items.has(item.id)) {
        void pump();
        return "queued"; // already saved: one card, however many times it is added
      }
      const result = new Promise<Outcome>((resolve) => waiters.set(item.id, [...(waiters.get(item.id) ?? []), resolve]));
      const full: QueueItem = { ...item, tries: 0, nextAt: now() };
      items.set(full.id, full);
      set(full.id, "waiting");
      await opts.store.put(full).catch(() => undefined);
      void pump();
      return result;
    },
    /** App start / `online`: load what was left behind and send it now. Items that used up their tries get a fresh round. */
    async resume(): Promise<void> {
      await load();
      for (const [id, i] of items) {
        const fresh: QueueItem = { ...i, tries: i.tries >= MAX_TRIES ? 0 : i.tries, nextAt: now() };
        items.set(id, fresh);
        if (status.get(id) === "failed") status.set(id, "waiting");
        await opts.store.put(fresh).catch(() => undefined);
      }
      emit();
      await pump();
    },
    status: (id: string): ItemStatus | undefined => status.get(id),
    pending: (): number => items.size,
    subscribe(l: () => void): () => void {
      listeners.add(l);
      return () => void listeners.delete(l);
    },
    /** Run whatever is due now (tests). */
    flush: pump,
  };
}

/* ------------------------------------------------------- browser wiring */

/** 4xx the server will never accept; anything else (network, 5xx, 401, 429) is worth another try. */
function final4xx(status: number): boolean {
  return status >= 400 && status < 500 && ![401, 403, 408, 429].includes(status);
}

export function makeSender(f: typeof fetch = (...a) => fetch(...a)): Send {
  return async (item, save) => {
    try {
      if (item.upload) {
        const r = await f("/api/media/upload-url", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ filename: item.upload.filename, mime: item.upload.mime }) });
        if (r.status >= 500) return "retry";
        const d = r.ok ? ((await r.json()) as { uploadUrl?: string; ref?: string }) : {};
        if (d.uploadUrl && d.ref) {
          const put = await f(d.uploadUrl, { method: "PUT", body: item.upload.blob, headers: { "content-type": item.upload.mime } });
          if (!put.ok) return "retry";
          if (item.json) item = { ...item, json: { ...item.json, mediaRef: d.ref } };
          else item = { ...item, fields: { ...item.fields, mediaRef: d.ref } };
        }
        // No signed URL (mock / unavailable): the multipart bytes carry the media.
        item = { ...item, upload: undefined };
        await save(item);
      }
      let res: Response;
      if (item.json) {
        res = await f("/api/cards", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...item.json, id: item.id }) });
      } else {
        const form = new FormData();
        form.append("id", item.id);
        for (const [k, v] of Object.entries(item.fields ?? {})) form.append(k, v);
        for (const file of item.files ?? []) form.append(file.field, file.blob, file.name);
        res = await f("/api/cards", { method: "POST", body: form });
      }
      if (!res.ok) return final4xx(res.status) ? "drop" : "retry";
      // `after` only runs on a retry: a first-try success leaves the follow-ups to the caller, who still has the response.
      for (const a of item.tries > 0 ? (item.after ?? []) : []) {
        await f(a.url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(a.body) }).catch(() => null);
      }
      return "ok";
    } catch {
      return "retry";
    }
  };
}

let shared: ReturnType<typeof createUploadQueue> | null = null;

export function uploadQueue() {
  if (!shared) {
    let store: QueueStore = memoryStore();
    try {
      if (typeof indexedDB !== "undefined") store = idbStore();
    } catch {
      /* private mode: in-memory for this session */
    }
    shared = createUploadQueue({ store, send: makeSender() });
  }
  return shared;
}

/** Call once at app start: resumes leftovers, and again whenever the network returns. */
export function startUploadQueue(): () => void {
  const q = uploadQueue();
  const go = () => void q.resume();
  go();
  window.addEventListener("online", go);
  return () => window.removeEventListener("online", go);
}
