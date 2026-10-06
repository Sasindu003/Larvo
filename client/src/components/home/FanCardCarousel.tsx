import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';

export interface FanCardItem {
  id: string;
  title: string;
  subtitle?: string;
  tag?: string;
  image: string;
  slug: string;
  link?: string;
}

interface FanCardCarouselProps {
  cards: FanCardItem[];
  cardWidth?: number;
  cardHeight?: number;
  fanSpread?: number;
  rotationAngle?: number;
  cardRadius?: number;
  activeScale?: number;
  inactiveScale?: number;
  className?: string;
}

/**
 * FanCardCarousel
 * Native React port of the Framer FanCardCarousel component.
 * Features an interactive fanned cards layout with 3D rotation angles,
 * depth layering, mouse/touch drag navigation, keyboard controls,
 * and bottom pagination indicators.
 */
export const FanCardCarousel: React.FC<FanCardCarouselProps> = ({
  cards,
  cardWidth = 360,
  cardHeight = 490,
  fanSpread = 160,
  rotationAngle = 7,
  cardRadius = 28,
  activeScale = 1.06,
  inactiveScale = 0.86,
  className = '',
}) => {
  const navigate = useNavigate();
  const [activeIndex, setActiveIndex] = useState(() =>
    cards.length > 0 ? Math.floor(cards.length / 2) : 0
  );
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [containerWidth, setContainerWidth] = useState(1200);

  const containerRef = useRef<HTMLDivElement>(null);
  const dragStartX = useRef<number | null>(null);
  const [dragOffset, setDragOffset] = useState<number>(0);
  const isDragging = useRef<boolean>(false);
  const hasDraggedFar = useRef<boolean>(false);

  // ResizeObserver for responsive geometry
  useEffect(() => {
    if (!containerRef.current) return;
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth || 1200);
      }
    };
    updateWidth();
    const ro = new ResizeObserver(updateWidth);
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const total = cards.length;

  // Responsive dimensions
  const isMobile = containerWidth < 640;
  const isTablet = containerWidth >= 640 && containerWidth < 1024;

  const responsiveCardWidth = isMobile
    ? Math.min(cardWidth * 0.76, containerWidth * 0.78)
    : isTablet
    ? Math.min(cardWidth * 0.88, containerWidth * 0.44)
    : cardWidth;

  const responsiveCardHeight =
    responsiveCardWidth * (cardHeight / cardWidth);

  const responsiveFanSpread = isMobile
    ? Math.min(fanSpread * 0.6, responsiveCardWidth * 0.46)
    : isTablet
    ? fanSpread * 0.78
    : fanSpread;

  const responsiveRotation = isMobile
    ? rotationAngle * 0.45
    : isTablet
    ? rotationAngle * 0.7
    : rotationAngle;

  const responsiveActiveScale = isMobile ? 1.0 : isTablet ? 1.03 : activeScale;
  const responsiveInactiveScale = isMobile
    ? Math.min(inactiveScale, 0.8)
    : isTablet
    ? Math.min(inactiveScale, 0.84)
    : inactiveScale;

  const nextCard = useCallback(() => {
    if (total === 0) return;
    setActiveIndex((prev) => (prev < total - 1 ? prev + 1 : 0));
  }, [total]);

  const prevCard = useCallback(() => {
    if (total === 0) return;
    setActiveIndex((prev) => (prev > 0 ? prev - 1 : total - 1));
  }, [total]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prevCard();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        nextCard();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nextCard, prevCard]);

  // Drag / Swipe handling
  const handleDragStart = (clientX: number) => {
    dragStartX.current = clientX;
    isDragging.current = true;
    hasDraggedFar.current = false;
    setDragOffset(0);
  };

  const handleDragMove = (clientX: number) => {
    if (!isDragging.current || dragStartX.current === null) return;
    const diff = clientX - dragStartX.current;
    if (Math.abs(diff) > 8) {
      hasDraggedFar.current = true;
    }
    setDragOffset(diff);
  };

  const handleDragEnd = () => {
    if (!isDragging.current) return;
    isDragging.current = false;
    const threshold = isMobile ? 35 : 60;

    if (dragOffset > threshold) {
      prevCard();
    } else if (dragOffset < -threshold) {
      nextCard();
    }

    setDragOffset(0);
    dragStartX.current = null;
    setTimeout(() => {
      hasDraggedFar.current = false;
    }, 50);
  };

  const handleCardClick = (index: number, card: FanCardItem) => {
    if (hasDraggedFar.current) return;

    if (index === activeIndex) {
      const target = card.link || `/products?category=${card.slug}`;
      navigate(target);
    } else {
      setActiveIndex(index);
    }
  };

  // Card transform math: progressive fanning deck with dynamic container fitting
  const getCardTransform = (index: number) => {
    let distance = index - activeIndex;
    if (total > 2) {
      if (distance > total / 2) distance -= total;
      if (distance < -total / 2) distance += total;
    }

    const absDistance = Math.abs(distance);
    const sign = Math.sign(distance);

    // Progressive tapered spread:
    // Immediate neighbors have generous spacing (~130-150px);
    // outer cards compress smoothly so all cards remain previewed within container.
    const decay = isMobile ? 0.72 : isTablet ? 0.78 : 0.83;
    let rawOffset = 0;
    if (absDistance > 0) {
      rawOffset = (responsiveFanSpread * (1 - Math.pow(decay, absDistance))) / (1 - decay);
    }

    // Maximum allowable offset from center so the outermost card edge doesn't clip
    const maxAllowedOffset = Math.max(
      80,
      (containerWidth - responsiveCardWidth) / 2 - (isMobile ? 12 : 24)
    );

    // Maximum theoretical raw offset for the farthest card in this deck
    const maxDeckDistance = Math.ceil((total - 1) / 2);
    const maxRawOffset =
      maxDeckDistance > 0
        ? (responsiveFanSpread * (1 - Math.pow(decay, maxDeckDistance))) / (1 - decay)
        : 1;

    // Scale down offset if the spread would exceed container bounds
    const fitScale = maxRawOffset > maxAllowedOffset ? maxAllowedOffset / maxRawOffset : 1;
    const xOffset = sign * rawOffset * fitScale;

    // Gentle natural arch
    const yOffset = Math.pow(absDistance, 1.1) * (isMobile ? 12 : isTablet ? 18 : 22);

    // Natural fanned rotation with progressive dampening
    const rotation = sign * Math.pow(absDistance, 0.78) * responsiveRotation;

    // Gradual scale down for outer depth layering
    const scale =
      index === activeIndex
        ? responsiveActiveScale
        : Math.max(0.68, responsiveInactiveScale - absDistance * 0.035);

    const zIndex = total - absDistance;

    return { xOffset, yOffset, rotation, scale, zIndex };
  };

  if (cards.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className={`relative w-full overflow-hidden select-none py-8 sm:py-12 flex flex-col items-center justify-center ${className}`}
      onMouseDown={(e) => handleDragStart(e.clientX)}
      onMouseMove={(e) => handleDragMove(e.clientX)}
      onMouseUp={handleDragEnd}
      onMouseLeave={handleDragEnd}
      onTouchStart={(e) => handleDragStart(e.touches[0].clientX)}
      onTouchMove={(e) => handleDragMove(e.touches[0].clientX)}
      onTouchEnd={handleDragEnd}
    >
      {/* Cards Viewport Container */}
      <div
        className="relative w-full flex items-center justify-center"
        style={{
          height: responsiveCardHeight * (isMobile ? 1.25 : 1.18) + 30,
          minHeight: responsiveCardHeight + 50,
        }}
      >
        {cards.map((card, index) => {
          const { xOffset, yOffset, rotation, scale, zIndex } =
            getCardTransform(index);
          const isActive = index === activeIndex;
          const isHovered = hoveredIndex === index;

          const currentX = xOffset + (isDragging.current ? dragOffset * 0.4 : 0);
          const currentY = yOffset - (isHovered && !isActive && !isMobile ? 12 : 0);
          const currentScale =
            isHovered && !isActive ? scale * 1.04 : scale;

          return (
            <div
              key={card.id || index}
              onClick={() => handleCardClick(index, card)}
              onMouseEnter={() => !isMobile && setHoveredIndex(index)}
              onMouseLeave={() => !isMobile && setHoveredIndex(null)}
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                width: responsiveCardWidth,
                height: responsiveCardHeight,
                marginLeft: -responsiveCardWidth / 2,
                marginTop: -responsiveCardHeight / 2,
                zIndex: isActive ? 50 : zIndex,
                transform: `translate3d(${currentX}px, ${currentY}px, 0) rotate(${rotation}deg) scale(${currentScale})`,
                transition: isDragging.current
                  ? 'none'
                  : 'transform 0.5s cubic-bezier(0.25, 1, 0.5, 1), box-shadow 0.4s ease',
                borderRadius: cardRadius,
                cursor: isActive ? 'pointer' : 'pointer',
              }}
              className="will-change-transform"
            >
              <div
                style={{
                  borderRadius: cardRadius,
                  boxShadow: isActive
                    ? '0 24px 48px -12px rgba(0, 0, 0, 0.45), 0 12px 24px -8px rgba(0, 0, 0, 0.3)'
                    : '0 12px 28px -8px rgba(0, 0, 0, 0.35)',
                }}
                className={`relative w-full h-full overflow-hidden bg-ink-900 border transition-all duration-300 ${
                  isActive
                    ? 'border-white/30 ring-1 ring-white/20'
                    : 'border-white/10 hover:border-white/20'
                }`}
              >
                {/* Background Category Image */}
                <img
                  src={card.image}
                  alt={card.title}
                  loading={isActive ? 'eager' : 'lazy'}
                  className={`w-full h-full object-cover object-center filter transition-all duration-700 ${
                    isActive
                      ? 'brightness-[0.9] contrast-[1.05] scale-100 hover:scale-105'
                      : 'brightness-[0.7] contrast-[1.0] scale-100'
                  }`}
                  draggable={false}
                />

                {/* Ambient scrims for top and bottom text legibility */}
                <div
                  aria-hidden="true"
                  className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/80 pointer-events-none"
                />

                {/* Top Row: Title, Subtitle, & Glass Tag Pill */}
                <div className="absolute top-0 inset-x-0 p-5 sm:p-6 flex items-start justify-between gap-3 z-10 pointer-events-none">
                  <div className="space-y-1">
                    <h3 className="font-display text-xl sm:text-2xl font-bold text-white tracking-tight drop-shadow-md">
                      {card.title}
                    </h3>
                    {card.subtitle && (
                      <p className="text-xs text-white/80 font-medium tracking-wide">
                        {card.subtitle}
                      </p>
                    )}
                  </div>

                  {card.tag && (
                    <span className="shrink-0 inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase bg-white/15 backdrop-blur-md border border-white/25 text-white shadow-sm">
                      {card.tag}
                    </span>
                  )}
                </div>

                {/* Bottom Row on Active Card: Explore Callout */}
                <div className="absolute bottom-0 inset-x-0 p-5 sm:p-6 flex items-center justify-between z-10 pointer-events-none">
                  <div
                    className={`inline-flex items-center gap-2 text-xs font-semibold tracking-wide transition-all duration-300 ${
                      isActive
                        ? 'opacity-100 translate-y-0 text-white'
                        : 'opacity-0 translate-y-2 text-white/70'
                    }`}
                  >
                    <span className="px-3 py-1.5 rounded-lg bg-white/20 backdrop-blur-md border border-white/20 flex items-center gap-1.5">
                      <span>Shop Collection</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>

                  <span className="text-[11px] font-medium text-white/60 tracking-wider">
                    {String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Navigation Controls & Pagination Indicators */}
      <div className="mt-4 sm:mt-6 flex items-center gap-4 z-30">
        <button
          type="button"
          onClick={prevCard}
          aria-label="Previous category"
          className="p-2 rounded-full bg-ink-100 hover:bg-ink-200 text-ink-900 border border-ink-300 transition-all hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-900"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Bottom Pagination Dots / Pills */}
        <div className="flex items-center gap-1.5 px-2">
          {cards.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActiveIndex(i)}
              aria-label={`Go to category ${i + 1}`}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === activeIndex
                  ? 'w-7 bg-ink-950'
                  : 'w-2 bg-ink-300 hover:bg-ink-400'
              }`}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={nextCard}
          aria-label="Next category"
          className="p-2 rounded-full bg-ink-100 hover:bg-ink-200 text-ink-900 border border-ink-300 transition-all hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-900"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default FanCardCarousel;
