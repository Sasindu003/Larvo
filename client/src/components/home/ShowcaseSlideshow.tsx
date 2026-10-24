import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface ShowcaseSlide {
  image: string;
  label: string;
  title?: string;
  link?: string;
  tag?: string;
}

interface ShowcaseSlideshowProps {
  slides: ShowcaseSlide[];
  intervalSec?: number;
  fit?: 'cover' | 'contain';
  radius?: number;
  overlay?: boolean;
  showLabel?: boolean;
  showCounter?: boolean;
  ringColor?: string;
  ringTrackColor?: string;
  ringThickness?: number;
  textColor?: string;
  placeholderColor?: string;
  className?: string;
  onSlideChange?: (index: number) => void;
}

/**
 * ShowcaseSlideshow
 * Native high-performance React port of the Framer Showcase Slideshow component.
 * Features an auto-advancing image panel with circular arc-progress ring,
 * live numerical slide counter, rotating uppercase caption, and interactive controls.
 */
export const ShowcaseSlideshow: React.FC<ShowcaseSlideshowProps> = ({
  slides = [],
  intervalSec = 5,
  fit = 'cover',
  radius = 22,
  overlay = true,
  showLabel = true,
  showCounter = true,
  ringColor = 'rgba(255, 255, 255, 0.9)',
  ringTrackColor = 'rgba(255, 255, 255, 0.15)',
  ringThickness = 1.5,
  textColor = 'rgba(255, 255, 255, 0.95)',
  placeholderColor = '#141414',
  className = '',
  onSlideChange,
}) => {
  const [current, setCurrent] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);

  const len = slides.length;
  const total = Math.max(len, 1);
  const idx = len ? current % len : 0;

  const R = 16;
  const CIRCUM = 2 * Math.PI * R;

  const goToSlide = useCallback(
    (nextIdx: number) => {
      if (len === 0) return;
      const normalized = ((nextIdx % len) + len) % len;
      setCurrent(normalized);
      setProgress(0);
      onSlideChange?.(normalized);
    },
    [len, onSlideChange]
  );

  const nextSlide = useCallback(() => {
    goToSlide(current + 1);
  }, [current, goToSlide]);

  const prevSlide = useCallback(() => {
    goToSlide(current - 1);
  }, [current, goToSlide]);

  // Frame-driven progress loop with pause/resume support
  useEffect(() => {
    if (len < 2 || isPaused) return;

    let animationFrameId: number;
    let lastTime = performance.now();
    const durationMs = intervalSec * 1000;

    const tick = (now: number) => {
      const delta = now - lastTime;
      lastTime = now;

      setProgress((prev) => {
        const next = prev + delta / durationMs;
        if (next >= 1) {
          nextSlide();
          return 0;
        }
        return next;
      });

      animationFrameId = requestAnimationFrame(tick);
    };

    animationFrameId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [len, isPaused, intervalSec, nextSlide]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      prevSlide();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      nextSlide();
    }
  };

  const activeLabel = len ? slides[idx]?.label : 'Curated Selection';
  const strokeDashoffset = CIRCUM * (1 - Math.min(1, Math.max(0, progress)));

  return (
    <div
      role="region"
      aria-label="Image Slideshow Showcase"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={() => setIsPaused(true)}
      onTouchEnd={() => setIsPaused(false)}
      style={{
        borderRadius: radius,
        backgroundColor: placeholderColor,
      }}
      className={`group relative overflow-hidden select-none outline-none focus-visible:ring-2 focus-visible:ring-white/80 shadow-2xl transition-all ${className}`}
    >
      {/* Slide Images with crossfade transition */}
      {len === 0 ? (
        <div className="absolute inset-0 flex items-center justify-center text-sm font-medium text-white/40">
          Loading slides...
        </div>
      ) : (
        slides.map((slide, i) => {
          const isActive = i === idx;
          return (
            <div
              key={i}
              className={`absolute inset-0 transition-all duration-700 ease-[cubic-bezier(0.4,0,0.2,1)] ${
                isActive
                  ? 'opacity-100 scale-100 z-10'
                  : 'opacity-0 scale-105 pointer-events-none z-0'
              }`}
            >
              <img
                src={slide.image}
                alt={slide.title || slide.label || `Slide ${i + 1}`}
                className="w-full h-full object-cover object-center filter brightness-[0.92] contrast-[1.04]"
                style={{ objectFit: fit }}
                loading={i === 0 ? 'eager' : 'lazy'}
              />
            </div>
          );
        })
      )}

      {/* Subtle bottom gradient scrim for caption contrast */}
      {overlay && (
        <div
          aria-hidden="true"
          className="absolute inset-0 z-20 pointer-events-none bg-gradient-to-t from-black/80 via-black/30 to-transparent"
        />
      )}

      {/* Manual Navigation Arrows (fade in on hover) */}
      {len > 1 && (
        <div className="absolute inset-x-3 top-1/2 -translate-y-1/2 z-30 flex items-center justify-between pointer-events-none">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              prevSlide();
            }}
            aria-label="Previous slide"
            className="pointer-events-auto p-2 rounded-full bg-black/40 hover:bg-black/70 text-white/90 backdrop-blur-md border border-white/10 opacity-0 group-hover:opacity-100 transition-all duration-200 hover:scale-105 active:scale-95 focus-visible:opacity-100"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              nextSlide();
            }}
            aria-label="Next slide"
            className="pointer-events-auto p-2 rounded-full bg-black/40 hover:bg-black/70 text-white/90 backdrop-blur-md border border-white/10 opacity-0 group-hover:opacity-100 transition-all duration-200 hover:scale-105 active:scale-95 focus-visible:opacity-100"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Rotating Slide Caption / Label */}
      {showLabel && (
        <div
          className="absolute bottom-5 left-5 z-30 font-sans text-[11px] font-semibold tracking-[0.16em] uppercase truncate max-w-[55%] transition-all duration-300"
          style={{ color: textColor }}
        >
          <span className="inline-block px-2.5 py-1 rounded bg-black/30 backdrop-blur-md border border-white/10">
            {activeLabel}
          </span>
        </div>
      )}

      {/* Circular Arc-Progress Ring & Live Numerical Counter */}
      {showCounter && (
        <div className="absolute bottom-4 right-5 z-30 flex items-center gap-3">
          {/* Animated SVG Ring */}
          <div className="relative w-[38px] height-[38px] flex items-center justify-center">
            <svg
              width="38"
              height="38"
              viewBox="0 0 38 38"
              className="-rotate-90 shrink-0 transform"
            >
              {/* Background Track */}
              <circle
                cx="19"
                cy="19"
                r={R}
                fill="none"
                stroke={ringTrackColor}
                strokeWidth={ringThickness}
              />
              {/* Animated Progress Arc */}
              <circle
                cx="19"
                cy="19"
                r={R}
                fill="none"
                stroke={ringColor}
                strokeWidth={ringThickness}
                strokeLinecap="round"
                strokeDasharray={CIRCUM}
                strokeDashoffset={strokeDashoffset}
                className="transition-none"
              />
            </svg>
          </div>

          {/* Numerical Counter: 01 / 04 */}
          <div
            className="font-sans text-xs font-semibold tracking-wider flex items-center gap-1 leading-none select-none"
            style={{ color: textColor }}
          >
            <span className="font-bold text-white">
              {String(idx + 1).padStart(2, '0')}
            </span>
            <span className="text-white/40">/</span>
            <span className="text-white/50">
              {String(total).padStart(2, '0')}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShowcaseSlideshow;
