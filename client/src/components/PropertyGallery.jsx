import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Expand, X } from "lucide-react";
import { sized } from "../data/images.js";
import PropertyImage from "./PropertyImage.jsx";

// Main image with arrows and swipe, thumbnail strip, and a fullscreen lightbox.
export default function PropertyGallery({ images, title }) {
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const touchX = useRef(null);
  const total = images.length;

  const go = useCallback((dir) => setIndex((i) => (i + dir + total) % total), [total]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, go]);

  const swipe = {
    onTouchStart: (e) => { touchX.current = e.touches[0].clientX; },
    onTouchEnd: (e) => {
      if (touchX.current === null) return;
      const dx = e.changedTouches[0].clientX - touchX.current;
      if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
      touchX.current = null;
    },
  };

  const arrow = "absolute top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-ink-900 transition-colors hover:bg-white";

  if (total === 0) {
    return (
      <div className="grid aspect-[4/3] place-items-center rounded bg-sand-200 text-sm text-ink-500 sm:aspect-[16/10]">
        No photos available
      </div>
    );
  }

  return (
    <div>
      <div className="relative aspect-[4/3] overflow-hidden rounded bg-sand-200 sm:aspect-[16/10]" {...swipe}>
        <button type="button" onClick={() => setOpen(true)} aria-label="View fullscreen" className="block h-full w-full cursor-zoom-in">
          <PropertyImage src={sized(images[index], 1600)} alt={`${title}, photo ${index + 1} of ${total}`} priority width={1600} />
        </button>
        {total > 1 && (
          <>
            <button type="button" onClick={() => go(-1)} aria-label="Previous photo" className={`${arrow} left-3`}><ChevronLeft className="h-5 w-5" strokeWidth={1.5} /></button>
            <button type="button" onClick={() => go(1)} aria-label="Next photo" className={`${arrow} right-3`}><ChevronRight className="h-5 w-5" strokeWidth={1.5} /></button>
          </>
        )}
        <div className="pointer-events-none absolute bottom-3 right-3 flex items-center gap-2 rounded bg-ink-950/60 px-3 py-1.5 text-xs text-white">
          <Expand className="h-3.5 w-3.5" strokeWidth={1.5} /> {index + 1} / {total}
        </div>
      </div>

      {total > 1 && (
        <ul className="mt-3 flex gap-3 overflow-x-auto pb-1">
          {images.map((src, i) => (
            <li key={src} className="shrink-0">
              <button
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Show photo ${i + 1}`}
                aria-current={i === index}
                className={`block h-16 w-24 overflow-hidden rounded bg-sand-200 transition-opacity sm:h-20 sm:w-28 ${i === index ? "opacity-100 ring-1 ring-ink-900 ring-offset-2 ring-offset-sand-50" : "opacity-60 hover:opacity-100"}`}
              >
                <PropertyImage src={sized(src, 400)} alt="" width={400} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && (
        <div role="dialog" aria-modal="true" aria-label={`${title} photos`} className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/95" {...swipe}>
          <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="absolute right-4 top-4 grid h-11 w-11 place-items-center text-white"><X className="h-7 w-7" strokeWidth={1.5} /></button>
          <div className="h-[80vh] w-full max-w-6xl px-4">
            <PropertyImage src={sized(images[index], 2000)} alt={`${title}, photo ${index + 1} of ${total}`} width={2000} className="!object-contain" />
          </div>
          {total > 1 && (
            <>
              <button type="button" onClick={() => go(-1)} aria-label="Previous photo" className={`${arrow} left-4`}><ChevronLeft className="h-5 w-5" strokeWidth={1.5} /></button>
              <button type="button" onClick={() => go(1)} aria-label="Next photo" className={`${arrow} right-4`}><ChevronRight className="h-5 w-5" strokeWidth={1.5} /></button>
            </>
          )}
          <p className="absolute bottom-5 text-sm text-white/80">{index + 1} / {total}</p>
        </div>
      )}
    </div>
  );
}
