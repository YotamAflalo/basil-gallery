"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { PaintingImage } from "@/components/painting-image";
import { COUNTRIES, TECHNIQUES, type Painting } from "@/lib/schema";

import { savePainting, type PaintingEdit } from "./actions";

/**
 * One painting at a time, driven from the keyboard.
 *
 * There are 227 works to get through, so the cost that matters is keystrokes
 * per painting, not pixels. Hence: autofocus straight into the title, save
 * and advance on one chord, and a "same as previous" that fills the fields a
 * batch from one trip will share.
 */

type Draft = Omit<PaintingEdit, "id">;

function draftFrom(p: Painting): Draft {
  return {
    title: p.title,
    year: p.year === null ? "" : String(p.year),
    country: p.country ?? "",
    place: p.place ?? "",
    technique: p.technique ?? "",
    description: p.description,
    published: p.published,
  };
}

export function Curator({ paintings }: { paintings: Painting[] }) {
  const [all, setAll] = useState(paintings);
  const [onlyTodo, setOnlyTodo] = useState(true);
  const [cursor, setCursor] = useState(0);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loadedId, setLoadedId] = useState<string>();
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState("");
  // State, not a ref: the "same as previous" button's disabled state is read
  // during render, and a ref read during render is not reactive.
  const [carried, setCarried] = useState<Partial<Draft> | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  const queue = useMemo(
    () => (onlyTodo ? all.filter((p) => !p.curated) : all),
    [all, onlyTodo],
  );

  const current = queue[Math.min(cursor, queue.length - 1)];
  const curatedCount = all.filter((p) => p.curated).length;

  // Load the painting under the cursor into the form. Done during render
  // rather than in an effect (React's documented "reset state when a prop
  // changes" pattern) so the server-rendered HTML already shows the right
  // painting — an effect would render the empty state first and flash.
  if (current && current.id !== loadedId) {
    setLoadedId(current.id);
    setDraft(draftFrom(current));
    setStatus("idle");
    setError("");
  }

  const move = useCallback(
    (delta: number) => {
      setCursor((c) => Math.max(0, Math.min(queue.length - 1, c + delta)));
    },
    [queue.length],
  );

  const save = useCallback(
    async (advance: boolean) => {
      if (!current || !draft) return;
      setStatus("saving");

      const result = await savePainting({ id: current.id, ...draft });

      if (!result.ok) {
        setStatus("error");
        setError(result.error);
        return;
      }

      // Remember the fields a batch tends to share, for "same as previous".
      setCarried({
        country: draft.country,
        place: draft.place,
        year: draft.year,
        technique: draft.technique,
      });

      const saved = { ...current, ...toPaintingShape(draft), curated: true };
      setAll((list) => list.map((p) => (p.id === current.id ? saved : p)));
      setStatus("saved");

      if (advance) {
        // With "needs work" on, the saved painting leaves the queue, so the
        // same cursor index already points at the next one.
        if (!onlyTodo) move(1);
        setTimeout(() => titleRef.current?.focus(), 0);
      }
    },
    [current, draft, move, onlyTodo],
  );

  const ditto = useCallback(() => {
    if (!carried) return;
    setDraft((d) => (d ? { ...d, ...carried } : d));
  }, [carried]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === "Enter") {
        e.preventDefault();
        void save(true);
      } else if (mod && e.key.toLowerCase() === "d") {
        e.preventDefault();
        ditto();
      } else if (e.altKey && e.key === "ArrowRight") {
        e.preventDefault();
        move(1);
      } else if (e.altKey && e.key === "ArrowLeft") {
        e.preventDefault();
        move(-1);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [save, ditto, move]);

  if (!current || !draft) {
    return (
      <main className="mx-auto max-w-md px-6 py-24 text-center">
        <h1 className="text-[20px] font-medium">Everything is tagged.</h1>
        <p className="mt-2 text-[15px] text-[#707070]">
          All {all.length} paintings have been checked by hand.
        </p>
        <button
          type="button"
          onClick={() => {
            setOnlyTodo(false);
            setCursor(0);
          }}
          className="mt-6 min-h-11 border border-black px-4 text-[13px]"
        >
          Review them anyway
        </button>
      </main>
    );
  }

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => (d ? { ...d, [key]: value } : d));

  return (
    <main className="mx-auto max-w-5xl px-4 pb-24 pad-safe">
      <Progress
        curated={curatedCount}
        total={all.length}
        position={cursor + 1}
        queueLength={queue.length}
        onlyTodo={onlyTodo}
        onToggle={() => {
          setOnlyTodo((v) => !v);
          setCursor(0);
        }}
      />

      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_22rem]">
        <div>
          <PaintingImage
            path={current.path}
            alt={current.title}
            width={current.width}
            height={current.height}
            sizes="(max-width: 768px) 92vw, 640px"
            priority
            className="max-h-[52dvh] w-full"
          />
          <p className="pt-2 font-mono text-[11px] break-all text-[#707070]">
            {current.path}
          </p>
        </div>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void save(true);
          }}
        >
          <Field label="Title">
            <input
              ref={titleRef}
              value={draft.title}
              onChange={(e) => set("title", e.target.value)}
              autoFocus
              className={inputClass}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Year">
              <input
                value={draft.year}
                onChange={(e) => set("year", e.target.value)}
                inputMode="numeric"
                placeholder="unknown"
                className={inputClass}
              />
            </Field>

            <Field label="Country">
              <select
                value={draft.country}
                onChange={(e) => set("country", e.target.value)}
                className={inputClass}
              >
                <option value="">—</option>
                {COUNTRIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Place">
            <input
              value={draft.place}
              onChange={(e) => set("place", e.target.value)}
              placeholder="Amsterdam Canal"
              className={inputClass}
            />
          </Field>

          <Field label="Technique">
            <select
              value={draft.technique}
              onChange={(e) => set("technique", e.target.value)}
              className={inputClass}
            >
              <option value="">—</option>
              {TECHNIQUES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Description">
            <textarea
              value={draft.description}
              onChange={(e) => set("description", e.target.value)}
              rows={3}
              className={`${inputClass} resize-y py-2 leading-snug`}
            />
          </Field>

          <label className="flex min-h-11 items-center gap-2 text-[13px]">
            <input
              type="checkbox"
              checked={draft.published}
              onChange={(e) => set("published", e.target.checked)}
              className="size-4"
            />
            Show on the site
          </label>

          {status === "error" && (
            <p role="alert" className="text-[13px] text-[#B3261E]">
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={status === "saving"}
              className="min-h-12 flex-1 border border-black text-[15px] disabled:opacity-40"
            >
              {status === "saving" ? "Saving…" : "Save and next"}
            </button>
            <button
              type="button"
              onClick={() => move(1)}
              className="min-h-12 border border-[#E5E5E5] px-4 text-[13px]"
            >
              Skip
            </button>
          </div>

          <button
            type="button"
            onClick={ditto}
            disabled={!carried}
            className="min-h-11 w-full border border-[#E5E5E5] text-[13px] disabled:opacity-40"
          >
            Same place, year and technique as the last one
          </button>

          <Shortcuts />
        </form>
      </div>
    </main>
  );
}

const inputClass =
  "min-h-11 w-full border border-[#E5E5E5] px-3 text-[15px] focus:border-black focus:outline-none";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block pb-1 text-[13px] text-[#707070]">{label}</span>
      {children}
    </label>
  );
}

function Progress({
  curated,
  total,
  position,
  queueLength,
  onlyTodo,
  onToggle,
}: {
  curated: number;
  total: number;
  position: number;
  queueLength: number;
  onlyTodo: boolean;
  onToggle: () => void;
}) {
  const pct = total === 0 ? 0 : Math.round((curated / total) * 100);

  return (
    <header className="py-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-[15px] font-medium">
          Curating{" "}
          <span className="text-[#707070] tabular-nums">
            {position} of {queueLength}
          </span>
        </h1>
        <button
          type="button"
          onClick={onToggle}
          className="min-h-11 text-[13px] text-[#707070] underline"
        >
          {onlyTodo ? "Show all" : "Only untagged"}
        </button>
      </div>

      <div className="mt-2 h-1 w-full bg-[#E5E5E5]">
        <div className="h-full bg-black transition-[width]" style={{ width: `${pct}%` }} />
      </div>
      <p className="pt-1.5 text-[11px] text-[#707070] tabular-nums">
        {curated} of {total} checked by hand · {pct}%
      </p>
    </header>
  );
}

function Shortcuts() {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 pt-2 text-[11px] text-[#707070]">
      <dt className="font-mono">⌘/Ctrl ↵</dt>
      <dd>Save and next</dd>
      <dt className="font-mono">⌘/Ctrl D</dt>
      <dd>Same as previous</dd>
      <dt className="font-mono">Alt → ←</dt>
      <dd>Skip without saving</dd>
    </dl>
  );
}

/** Mirror a saved draft back into Painting shape for the local list. */
function toPaintingShape(draft: Draft) {
  return {
    title: draft.title,
    year: draft.year.trim() === "" ? null : Number(draft.year),
    country: draft.country || null,
    place: draft.place || null,
    technique: draft.technique || null,
    description: draft.description,
    published: draft.published,
  };
}
