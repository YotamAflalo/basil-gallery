"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

import {
  WALLPAPER_PRESETS,
  wallpaperUrl,
  type WallpaperFit,
} from "@/lib/ik-url";
import type { Painting } from "@/lib/schema";

/**
 * Save a painting as a phone wallpaper.
 *
 * The first option is the visitor's own screen, measured rather than guessed,
 * because a wallpaper cut for the wrong aspect ratio is the whole problem.
 * ImageKit renders each size on demand, so nothing is pre-generated.
 */
export function WallpaperSheet({
  painting,
  onClose,
}: {
  painting: Painting;
  onClose: () => void;
}) {
  const [fit, setFit] = useState<WallpaperFit>("fill");
  const screen = useScreenSize();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const filename = `${painting.title.replace(/[^\w\s-]/g, "").trim() || "painting"} — Basil Swimmer.jpg`;

  return (
    <div className="fixed inset-0 z-60 flex flex-col justify-end">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Save as wallpaper"
        className="pad-safe-b relative max-h-[80dvh] overflow-y-auto border-t border-[#E5E5E5] bg-white px-5 pt-5"
      >
        <div className="flex items-baseline justify-between">
          <h2 className="text-[15px] font-medium">Save as wallpaper</h2>
          <button
            type="button"
            onClick={onClose}
            className="-mr-2 min-h-11 px-2 text-[13px] text-[#707070]"
          >
            Close
          </button>
        </div>

        <fieldset className="mt-4">
          <legend className="pb-2 text-[13px] text-[#707070]">
            How it should fit your screen
          </legend>
          <div className="flex gap-2">
            <FitOption
              active={fit === "fill"}
              onClick={() => setFit("fill")}
              title="Fill the screen"
              detail="Edge to edge, sides trimmed"
            />
            <FitOption
              active={fit === "whole"}
              onClick={() => setFit("whole")}
              title="Whole painting"
              detail="Nothing cut off"
            />
          </div>
        </fieldset>

        <div className="mt-5 space-y-2 pb-5">
          {screen && (
            <DownloadLink
              href={wallpaperUrl(painting.path, {
                ...screen,
                fit,
                orientation: painting,
              })}
              filename={filename}
              label="This phone"
              detail={`${screen.width} × ${screen.height}`}
              primary
            />
          )}

          {WALLPAPER_PRESETS.map((preset) => (
            <DownloadLink
              key={preset.id}
              href={wallpaperUrl(painting.path, {
                width: preset.width,
                height: preset.height,
                fit,
                orientation: painting,
              })}
              filename={filename}
              label={preset.label}
              detail={`${preset.width} × ${preset.height}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * The visitor's screen in real pixels, or null while server-rendering.
 *
 * useSyncExternalStore rather than an effect: window.screen is external state,
 * this is what the hook is for, and it re-reads on rotation for free. The
 * snapshot is a string so its identity is stable between renders — returning
 * a fresh object would loop.
 */
function useScreenSize(): { width: number; height: number } | null {
  const key = useSyncExternalStore(subscribeToScreen, screenSnapshot, () => "");
  if (!key) return null;
  const [width, height] = key.split("x").map(Number);
  return { width, height };
}

function subscribeToScreen(onChange: () => void) {
  window.addEventListener("resize", onChange);
  window.addEventListener("orientationchange", onChange);
  return () => {
    window.removeEventListener("resize", onChange);
    window.removeEventListener("orientationchange", onChange);
  };
}

function screenSnapshot(): string {
  const dpr = window.devicePixelRatio || 1;
  const w = Math.round(window.screen.width * dpr);
  const h = Math.round(window.screen.height * dpr);
  // Wallpapers are portrait; normalise so a rotated phone still gets one.
  return `${Math.min(w, h)}x${Math.max(w, h)}`;
}

function FitOption({
  active,
  onClick,
  title,
  detail,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  detail: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-11 flex-1 border px-3 py-2 text-left transition-colors ${
        active ? "border-black bg-black text-white" : "border-[#E5E5E5]"
      }`}
    >
      <span className="block text-[13px]">{title}</span>
      <span className={`block text-[11px] ${active ? "opacity-70" : "text-[#707070]"}`}>
        {detail}
      </span>
    </button>
  );
}

function DownloadLink({
  href,
  filename,
  label,
  detail,
  primary = false,
}: {
  href: string;
  filename: string;
  label: string;
  detail: string;
  primary?: boolean;
}) {
  return (
    <a
      href={href}
      download={filename}
      className={`flex min-h-12 items-center justify-between border px-4 text-[15px] ${
        primary ? "border-black" : "border-[#E5E5E5]"
      }`}
    >
      <span>{label}</span>
      <span className="text-[13px] text-[#707070] tabular-nums">{detail}</span>
    </a>
  );
}
