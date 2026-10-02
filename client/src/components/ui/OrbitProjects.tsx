import React, { useRef, useState, useEffect, useLayoutEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';

export interface OrbitProjectItem {
  image?: string;
  label?: string;
  link?: string | { url?: string; href?: string; link?: string; path?: string };
}

export interface OrbitProjectsContentConfig {
  showCopy?: boolean;
  textColor?: string;
  leftTitle?: string;
  rightTitle?: string;
  desktopTitleFont?: React.CSSProperties;
  compactTitleFont?: React.CSSProperties;
  titleCenterGap?: number;
  centerText?: string;
  centerTextWidth?: number;
  compactTextGap?: number;
  desktopCenterFont?: React.CSSProperties;
  tabletCenterFont?: React.CSSProperties;
  mobileCenterFont?: React.CSSProperties;
  compactTextColor?: string;
}

export interface OrbitProjectsCardsConfig {
  background?: string;
  radius?: number;
  aspect?: number;
  imageFit?: 'cover' | 'contain';
  depthOpacity?: number;
  depthScale?: number;
  renderQuality?: number;
  labelColor?: string;
  labelFont?: React.CSSProperties;
}

export interface OrbitProjectsMotionConfig {
  scrollLength?: number;
  startOffset?: number;
  smoothness?: number;
  perspective?: number;
  curveWidth?: number;
  curveHeight?: number;
  depth?: number;
  rotation?: number;
  cardWidth?: number;
  offsetY?: number;
}

export interface OrbitProjectsGridConfig {
  columns?: number;
  gap?: number;
  maxWidth?: number;
  positionY?: number;
}

export interface OrbitProjectsResponsiveConfig {
  desktopBreakpoint?: number;
  mobileBreakpoint?: number;
  tabletColumns?: number;
  mobileColumns?: number;
  tabletPadding?: string;
  mobilePadding?: string;
  gap?: number;
  headerGap?: number;
}

export interface OrbitProjectsCanvasConfig {
  layout?: 'desktop' | 'tablet' | 'mobile';
  progress?: number;
}

export interface OrbitProjectsProps {
  items?: OrbitProjectItem[];
  background?: string;
  content?: OrbitProjectsContentConfig;
  cards?: OrbitProjectsCardsConfig;
  motion?: OrbitProjectsMotionConfig;
  grid?: OrbitProjectsGridConfig;
  responsive?: OrbitProjectsResponsiveConfig;
  canvas?: OrbitProjectsCanvasConfig;
  style?: React.CSSProperties;
  className?: string;
}

const DEFAULT_ITEMS: OrbitProjectItem[] = [
  {
    image: 'https://images.unsplash.com/photo-1618005198919-d3d4b5a92ead?auto=format&fit=crop&w=1600&q=90',
    label: 'Look 01',
  },
  {
    image: 'https://images.unsplash.com/photo-1558655146-d09347e92766?auto=format&fit=crop&w=1600&q=90',
    label: 'Look 02',
  },
  {
    image: 'https://images.unsplash.com/photo-1559028012-481c04fa702d?auto=format&fit=crop&w=1600&q=90',
    label: 'Look 03',
  },
  {
    image: 'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?auto=format&fit=crop&w=1600&q=90',
    label: 'Look 04',
  },
  {
    image: 'https://images.unsplash.com/photo-1559028012-d74eadee55f9?auto=format&fit=crop&w=1600&q=90',
    label: 'Look 05',
  },
  {
    image: 'https://images.unsplash.com/photo-1613909207039-6b173b755cc1?auto=format&fit=crop&w=1600&q=90',
    label: 'Look 06',
  },
];

const DEFAULT_CONTENT: Required<OrbitProjectsContentConfig> = {
  showCopy: true,
  textColor: '#0d0d0d',
  leftTitle: 'EDITORIAL',
  rightTitle: 'COLLECTION',
  desktopTitleFont: {
    fontFamily: "'Playfair Display', Georgia, serif",
    fontSize: 'clamp(64px, 8vw, 130px)',
    fontWeight: 400,
    lineHeight: 0.88,
    letterSpacing: '-0.04em',
    textAlign: 'left',
  },
  compactTitleFont: {
    fontFamily: "'Playfair Display', Georgia, serif",
    fontSize: 'clamp(36px, 10vw, 64px)',
    fontWeight: 400,
    lineHeight: 0.95,
    letterSpacing: '-0.03em',
    textAlign: 'left',
  },
  titleCenterGap: 32,
  centerText: 'Curated modern tailoring and architectural silhouettes crafted for effortless distinction.',
  centerTextWidth: 240,
  compactTextGap: 24,
  desktopCenterFont: {
    fontFamily: "'Inter', system-ui, sans-serif",
    fontSize: '13px',
    fontWeight: 500,
    lineHeight: 1.35,
    letterSpacing: '-0.01em',
    textAlign: 'center',
  },
  tabletCenterFont: {
    fontFamily: "'Inter', system-ui, sans-serif",
    fontSize: '13px',
    fontWeight: 500,
    lineHeight: 1.35,
    letterSpacing: '-0.01em',
    textAlign: 'left',
  },
  mobileCenterFont: {
    fontFamily: "'Inter', system-ui, sans-serif",
    fontSize: '13px',
    fontWeight: 500,
    lineHeight: 1.35,
    letterSpacing: '-0.01em',
    textAlign: 'left',
  },
  compactTextColor: '#525252',
};

const DEFAULT_CARDS: Required<OrbitProjectsCardsConfig> = {
  background: '#ece3d4',
  radius: 10,
  aspect: 1.35,
  imageFit: 'cover',
  depthOpacity: 25,
  depthScale: 80,
  renderQuality: 2,
  labelColor: 'rgba(13, 13, 13, 0.7)',
  labelFont: {
    fontFamily: "'Inter', system-ui, sans-serif",
    fontSize: '14px',
    fontWeight: 500,
    lineHeight: 1.2,
    letterSpacing: '0.02em',
    textAlign: 'center',
  },
};

const DEFAULT_MOTION: Required<OrbitProjectsMotionConfig> = {
  scrollLength: 420,
  startOffset: 50,
  smoothness: 7,
  perspective: 1300,
  curveWidth: 580,
  curveHeight: 220,
  depth: 520,
  rotation: 310,
  cardWidth: 410,
  offsetY: -30,
};

const DEFAULT_GRID: Required<OrbitProjectsGridConfig> = {
  columns: 3,
  gap: 20,
  maxWidth: 1200,
  positionY: 52,
};

const DEFAULT_RESPONSIVE: Required<OrbitProjectsResponsiveConfig> = {
  desktopBreakpoint: 1024,
  mobileBreakpoint: 640,
  tabletColumns: 2,
  mobileColumns: 1,
  tabletPadding: '64px 24px',
  mobilePadding: '48px 16px',
  gap: 16,
  headerGap: 48,
};

const DEFAULT_CANVAS: Required<OrbitProjectsCanvasConfig> = {
  layout: 'desktop',
  progress: 0.48,
};

function clamp(value: number, minimum = 0, maximum = 1): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function lerp(from: number, to: number, progress: number): number {
  return from + (to - from) * progress;
}

function smootherstep(start: number, end: number, value: number): number {
  if (start === end) {
    return value < start ? 0 : 1;
  }
  const progress = clamp((value - start) / (end - start));
  return progress * progress * progress * (progress * (progress * 6 - 15) + 10);
}

function getLinkValue(link?: string | { url?: string; href?: string; link?: string; path?: string }): string {
  if (!link) return '';
  if (typeof link === 'string') return link;
  return String(link.url || link.href || link.link || link.path || '');
}

function CardLinkWrapper({
  href,
  label,
  index,
  children,
  style,
}: {
  href: string;
  label?: string;
  index: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  if (!href) {
    return <div style={style}>{children}</div>;
  }
  const isInternal = href.startsWith('/') && !href.startsWith('//');
  const ariaLabel = label || `View project ${index + 1}`;

  if (isInternal) {
    return (
      <Link to={href} aria-label={ariaLabel} style={style}>
        {children}
      </Link>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={ariaLabel}
      style={style}
    >
      {children}
    </a>
  );
}

function CardContent({
  item,
  index,
  radius,
  imageFit,
  background,
  labelColor,
  labelFont,
  renderQuality = 1,
  shadowStrength = 1,
}: {
  item: OrbitProjectItem;
  index: number;
  radius: number;
  imageFit: 'cover' | 'contain';
  background: string;
  labelColor: string;
  labelFont: React.CSSProperties;
  renderQuality?: number;
  shadowStrength?: number;
}) {
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        borderRadius: radius,
        background,
        boxShadow: `0 ${18 * shadowStrength * renderQuality}px ${50 * shadowStrength * renderQuality}px rgba(0, 0, 0, ${0.12 * shadowStrength})`,
        backfaceVisibility: 'hidden',
        WebkitBackfaceVisibility: 'hidden',
      }}
    >
      {item.image ? (
        <img
          src={item.image}
          alt={item.label || `Project ${index + 1}`}
          draggable={false}
          loading="eager"
          style={{
            display: 'block',
            width: '100%',
            height: '100%',
            objectFit: imageFit,
            background,
            userSelect: 'none',
            pointerEvents: 'none',
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
          }}
        />
      ) : (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            boxSizing: 'border-box',
            ...labelFont,
            color: labelColor,
          }}
        >
          {item.label || `Project ${index + 1}`}
        </div>
      )}
    </div>
  );
}

function DesktopProjectCard({
  item,
  index,
  x,
  y,
  z,
  width,
  height,
  rotateY,
  rotateZ,
  scale,
  opacity,
  zIndex,
  radius,
  imageFit,
  cardBackground,
  labelColor,
  labelFont,
  renderQuality,
  flattened,
}: {
  item: OrbitProjectItem;
  index: number;
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  rotateY: number;
  rotateZ: number;
  scale: number;
  opacity: number;
  zIndex: number;
  radius: number;
  imageFit: 'cover' | 'contain';
  cardBackground: string;
  labelColor: string;
  labelFont: React.CSSProperties;
  renderQuality: number;
  flattened: number;
}) {
  const href = getLinkValue(item.link);
  const quality = item.image ? clamp(renderQuality, 1, 3) : 1;
  const renderWidth = width * quality;
  const renderHeight = height * quality;
  const renderX = x - (renderWidth - width) / 2;
  const renderY = y - (renderHeight - height) / 2;
  const renderScale = scale / quality;
  const renderRadius = radius * quality;
  const content = (
    <CardContent
      item={item}
      index={index}
      radius={renderRadius}
      imageFit={imageFit}
      background={cardBackground}
      labelColor={labelColor}
      labelFont={labelFont}
      renderQuality={quality}
      shadowStrength={lerp(1, 0.4, flattened)}
    />
  );

  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        width: renderWidth,
        height: renderHeight,
        opacity,
        zIndex,
        transformOrigin: '50% 50%',
        transformStyle: 'preserve-3d',
        backfaceVisibility: 'hidden',
        WebkitBackfaceVisibility: 'hidden',
        transform: `
          translate3d(${renderX}px, ${renderY}px, ${z}px)
          rotateY(${rotateY}deg)
          rotateZ(${rotateZ}deg)
          scale(${renderScale})
        `,
      }}
    >
      <CardLinkWrapper
        href={href}
        label={item.label}
        index={index}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          color: 'inherit',
          textDecoration: 'none',
        }}
      >
        {content}
      </CardLinkWrapper>
    </div>
  );
}

function CompactProjectCard({
  item,
  index,
  radius,
  imageFit,
  cardBackground,
  labelColor,
  labelFont,
  aspect,
}: {
  item: OrbitProjectItem;
  index: number;
  radius: number;
  imageFit: 'cover' | 'contain';
  cardBackground: string;
  labelColor: string;
  labelFont: React.CSSProperties;
  aspect: number;
}) {
  const href = getLinkValue(item.link);
  const content = (
    <div
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: `${Math.max(aspect, 0.2)} / 1`,
      }}
    >
      <CardContent
        item={item}
        index={index}
        radius={radius}
        imageFit={imageFit}
        background={cardBackground}
        labelColor={labelColor}
        labelFont={labelFont}
        shadowStrength={0.3}
      />
    </div>
  );

  return (
    <CardLinkWrapper
      href={href}
      label={item.label}
      index={index}
      style={{
        display: 'block',
        width: '100%',
        color: 'inherit',
        textDecoration: 'none',
      }}
    >
      {content}
    </CardLinkWrapper>
  );
}

function CompactLayout({
  items,
  background,
  textColor,
  leftTitle,
  rightTitle,
  centerText,
  showCopy,
  titleFont,
  centerFont,
  centerTextWidth,
  centerTextColor,
  contentGap,
  columns,
  gap,
  headerGap,
  padding,
  radius,
  aspect,
  imageFit,
  cardBackground,
  labelColor,
  labelFont,
}: {
  items: OrbitProjectItem[];
  background?: string;
  textColor?: string;
  leftTitle?: string;
  rightTitle?: string;
  centerText?: string;
  showCopy?: boolean;
  titleFont?: React.CSSProperties;
  centerFont?: React.CSSProperties;
  centerTextWidth?: number;
  centerTextColor?: string;
  contentGap?: number;
  columns: number;
  gap: number;
  headerGap: number;
  padding?: string;
  radius: number;
  aspect: number;
  imageFit: 'cover' | 'contain';
  cardBackground: string;
  labelColor: string;
  labelFont: React.CSSProperties;
}) {
  return (
    <section
      style={{
        position: 'relative',
        width: '100%',
        height: 'auto',
        padding,
        boxSizing: 'border-box',
        background,
      }}
    >
      {showCopy && (
        <header
          style={{
            position: 'relative',
            width: '100%',
            marginBottom: headerGap,
          }}
        >
          <h2
            style={{
              ...titleFont,
              margin: 0,
              width: '100%',
              maxWidth: '100%',
              color: textColor,
            }}
          >
            <span style={{ display: 'block' }}>{leftTitle}</span>
            <span style={{ display: 'block' }}>{rightTitle}</span>
          </h2>
          {centerText && (
            <p
              style={{
                ...centerFont,
                margin: `${contentGap}px 0 0`,
                maxWidth: centerTextWidth,
                color: centerTextColor,
                textAlign: 'left',
              }}
            >
              {centerText}
            </p>
          )}
        </header>
      )}
      <div
        style={{
          position: 'relative',
          display: 'grid',
          width: '100%',
          gridTemplateColumns: `repeat(${Math.max(Math.round(columns), 1)}, minmax(0, 1fr))`,
          gap,
        }}
      >
        {items.map((item, index) => (
          <CompactProjectCard
            key={`${item.label || 'project'}-${index}`}
            item={item}
            index={index}
            radius={radius}
            imageFit={imageFit}
            cardBackground={cardBackground}
            labelColor={labelColor}
            labelFont={labelFont}
            aspect={aspect}
          />
        ))}
      </div>
    </section>
  );
}

export function OrbitProjects({
  items,
  background = 'transparent',
  content: contentProp,
  cards: cardsProp,
  motion: motionProp,
  grid: gridProp,
  responsive: responsiveProp,
  canvas: canvasProp,
  style,
  className,
}: OrbitProjectsProps) {
  const content = { ...DEFAULT_CONTENT, ...(contentProp || {}) };
  const cards = { ...DEFAULT_CARDS, ...(cardsProp || {}) };
  const motion = { ...DEFAULT_MOTION, ...(motionProp || {}) };
  const grid = { ...DEFAULT_GRID, ...(gridProp || {}) };
  const responsive = { ...DEFAULT_RESPONSIVE, ...(responsiveProp || {}) };
  const canvas = { ...DEFAULT_CANVAS, ...(canvasProp || {}) };

  const {
    showCopy,
    textColor,
    leftTitle,
    rightTitle,
    desktopTitleFont,
    compactTitleFont,
    titleCenterGap,
    centerText,
    centerTextWidth,
    desktopCenterFont,
    tabletCenterFont,
    mobileCenterFont,
    compactTextColor,
    compactTextGap,
  } = content;

  const {
    background: cardBackground,
    radius: cardRadius,
    aspect: cardAspect,
    imageFit,
    depthOpacity,
    depthScale,
    renderQuality,
    labelColor,
    labelFont,
  } = cards;

  const {
    scrollLength,
    startOffset,
    smoothness,
    perspective,
    curveWidth,
    curveHeight,
    depth,
    rotation: orbitRotation,
    cardWidth: arcCardWidth,
    offsetY: orbitOffsetY,
  } = motion;

  const {
    columns: gridColumns,
    gap: gridGap,
    maxWidth: gridMaxWidth,
    positionY: gridPositionY,
  } = grid;

  const {
    desktopBreakpoint,
    mobileBreakpoint,
    tabletColumns,
    mobileColumns,
    tabletPadding,
    mobilePadding,
    gap: compactGap,
    headerGap: compactHeaderGap,
  } = responsive;

  const { progress: canvasProgress } = canvas;

  const rootRef = useRef<HTMLElement | null>(null);
  const [viewportElement, setViewportElement] = useState<HTMLDivElement | null>(null);
  const viewportRef = useCallback((node: HTMLDivElement | null) => {
    setViewportElement(node);
  }, []);

  const targetProgressRef = useRef(clamp(canvasProgress));
  const animatedProgressRef = useRef(clamp(canvasProgress));
  const progressRafRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number | null>(null);

  const projectItems = items && items.length > 0 ? items : DEFAULT_ITEMS;
  const [progress, setProgress] = useState(clamp(canvasProgress));
  const [viewport, setViewport] = useState({ width: 1440, height: 900 });

  useLayoutEffect(() => {
    const element = viewportElement;
    if (!element) return;
    let frameA: number | null = null;
    let frameB: number | null = null;

    const measure = () => {
      const bounds = element.getBoundingClientRect();
      const width = Math.max(Math.round(bounds.width), 1);
      const height = Math.max(Math.round(bounds.height), 1);
      setViewport(previous => {
        if (Math.abs(previous.width - width) < 1 && Math.abs(previous.height - height) < 1) {
          return previous;
        }
        return { width, height };
      });
    };

    measure();
    frameA = window.requestAnimationFrame(() => {
      measure();
      frameB = window.requestAnimationFrame(measure);
    });

    const observer = new ResizeObserver(measure);
    observer.observe(element);

    return () => {
      if (frameA !== null) {
        window.cancelAnimationFrame(frameA);
      }
      if (frameB !== null) {
        window.cancelAnimationFrame(frameB);
      }
      observer.disconnect();
    };
  }, [viewportElement]);

  const isCompact = viewport.width < desktopBreakpoint;
  const isMobile = viewport.width < mobileBreakpoint;
  const [isNearViewport, setIsNearViewport] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isCompact) {
      setIsNearViewport(true);
      return;
    }
    const root = rootRef.current;
    if (!root || !('IntersectionObserver' in window)) {
      setIsNearViewport(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsNearViewport(entry.isIntersecting);
      },
      { root: null, rootMargin: '100% 0px 100% 0px', threshold: 0 }
    );
    observer.observe(root);
    return () => {
      observer.disconnect();
    };
  }, [isCompact]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (progressRafRef.current !== null) {
      window.cancelAnimationFrame(progressRafRef.current);
      progressRafRef.current = null;
    }
    lastFrameTimeRef.current = null;

    if (isCompact) {
      const nextProgress = 1;
      targetProgressRef.current = nextProgress;
      animatedProgressRef.current = nextProgress;
      setProgress(nextProgress);
      return;
    }

    if (!isNearViewport) {
      targetProgressRef.current = progress;
      animatedProgressRef.current = progress;
      return;
    }

    if (!rootRef.current) return;

    const animateProgress = (time: number) => {
      progressRafRef.current = null;
      const previousTime = lastFrameTimeRef.current ?? time;
      const deltaSeconds = Math.min(Math.max((time - previousTime) / 1e3, 0), 0.064);
      lastFrameTimeRef.current = time;
      const current = animatedProgressRef.current;
      const target = targetProgressRef.current;
      const dampingRate = Math.max(smoothness, 0.1);
      const interpolation = 1 - Math.exp(-dampingRate * deltaSeconds);
      const next = current + (target - current) * interpolation;
      const difference = Math.abs(target - next);
      const finalProgress = difference < 1e-4 ? target : next;
      animatedProgressRef.current = finalProgress;
      setProgress(finalProgress);
      if (difference >= 1e-4) {
        progressRafRef.current = window.requestAnimationFrame(animateProgress);
      } else {
        lastFrameTimeRef.current = null;
      }
    };

    const updateTargetProgress = () => {
      const root = rootRef.current;
      if (!root) return;
      const bounds = root.getBoundingClientRect();
      const entryLead = window.innerHeight * (clamp(startOffset, 0, 100) / 100);
      const availableDistance = Math.max(bounds.height - window.innerHeight, 1);
      targetProgressRef.current = clamp((entryLead - bounds.top) / availableDistance);
      if (progressRafRef.current === null) {
        progressRafRef.current = window.requestAnimationFrame(animateProgress);
      }
    };

    updateTargetProgress();
    window.addEventListener('scroll', updateTargetProgress, { passive: true });
    window.addEventListener('resize', updateTargetProgress);

    return () => {
      if (progressRafRef.current !== null) {
        window.cancelAnimationFrame(progressRafRef.current);
      }
      progressRafRef.current = null;
      lastFrameTimeRef.current = null;
      window.removeEventListener('scroll', updateTargetProgress);
      window.removeEventListener('resize', updateTargetProgress);
    };
  }, [isCompact, isNearViewport, smoothness, startOffset, progress]);

  if (isCompact) {
    return (
      <div
        ref={viewportRef}
        className={className}
        style={{
          ...style,
          position: 'relative',
          width: '100%',
          height: 'auto',
          overflow: 'visible',
          background,
        }}
      >
        <CompactLayout
          items={projectItems}
          background={background}
          textColor={textColor}
          leftTitle={leftTitle}
          rightTitle={rightTitle}
          centerText={centerText}
          showCopy={showCopy}
          titleFont={compactTitleFont}
          centerFont={isMobile ? mobileCenterFont : tabletCenterFont}
          centerTextWidth={centerTextWidth}
          centerTextColor={compactTextColor}
          contentGap={compactTextGap}
          columns={isMobile ? mobileColumns : tabletColumns}
          gap={compactGap}
          headerGap={compactHeaderGap}
          padding={isMobile ? mobilePadding : tabletPadding}
          radius={cardRadius}
          aspect={cardAspect}
          imageFit={imageFit}
          cardBackground={cardBackground}
          labelColor={labelColor}
          labelFont={labelFont}
        />
      </div>
    );
  }

  const viewportWidth = viewport.width;
  const viewportHeight = viewport.height;
  const itemCount = projectItems.length;
  const horizontalPadding = 48;
  const desktopColumns = Math.min(Math.max(Math.round(gridColumns), 1), Math.max(itemCount, 1));
  const rows = Math.ceil(itemCount / desktopColumns);
  const availableGridWidth = Math.max(viewportWidth - horizontalPadding * 2, 200);
  const finalGridWidth = Math.min(gridMaxWidth, availableGridWidth);
  const finalCardWidth = Math.max(90, (finalGridWidth - gridGap * (desktopColumns - 1)) / desktopColumns);
  const finalCardHeight = finalCardWidth / Math.max(cardAspect, 0.2);
  const finalGridHeight = rows * finalCardHeight + Math.max(rows - 1, 0) * gridGap;
  const actualArcCardWidth = Math.min(arcCardWidth, viewportWidth * 0.28);
  const actualArcCardHeight = actualArcCardWidth / Math.max(cardAspect, 0.2);
  const actualCurveWidth = Math.min(curveWidth, viewportWidth * 0.44);
  const actualCurveHeight = Math.min(curveHeight, viewportHeight * 0.3);
  const actualDepth = Math.min(depth, viewportWidth * 0.42);

  const titleEnterProgress = smootherstep(0, 0.2, progress);
  const titleExitProgress = smootherstep(0.74, 0.94, progress);
  const titleOpacity = titleEnterProgress * (1 - titleExitProgress);
  const titleVerticalShift = lerp(28, 0, titleEnterProgress);
  const titleOutsideOffset = viewportWidth * 0.7;

  const safeCenterTextWidth = Math.min(Math.max(centerTextWidth, 0), viewportWidth * 0.5);
  const titleFinalOffset = (safeCenterTextWidth + Math.max(titleCenterGap, 0)) / 2;
  const leftTitleOffset = lerp(titleOutsideOffset, titleFinalOffset, titleEnterProgress);
  const rightTitleOffset = lerp(titleOutsideOffset, titleFinalOffset, titleEnterProgress);

  const revealProgress = smootherstep(0, 0.17, progress);
  const orbitProgress = smootherstep(0.05, 0.7, progress);
  const centerCopyOpacity = smootherstep(0.12, 0.25, progress) * (1 - smootherstep(0.58, 0.82, progress));

  return (
    <section
      ref={rootRef}
      className={className}
      style={{
        ...style,
        position: 'relative',
        width: '100%',
        height: `${Math.max(scrollLength, 120)}vh`,
        background,
      }}
    >
      <div
        ref={viewportRef}
        style={{
          position: 'sticky',
          top: 0,
          width: '100%',
          height: '100svh',
          minHeight: 600,
          overflow: 'hidden',
          background,
          perspective: `${perspective}px`,
          perspectiveOrigin: '50% 50%',
          transformStyle: 'preserve-3d',
          isolation: 'isolate',
        }}
      >
        {showCopy && (
          <>
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                left: '50%',
                top: '56%',
                zIndex: 0,
                width: 'max-content',
                pointerEvents: 'none',
                opacity: titleOpacity,
                transform: `translate3d(calc(-100% - ${leftTitleOffset}px), calc(-50% + ${titleVerticalShift}px), 0)`,
                willChange: 'transform, opacity',
              }}
            >
              <div style={{ ...desktopTitleFont, margin: 0, whiteSpace: 'nowrap', color: textColor }}>
                {leftTitle}
              </div>
            </div>
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                left: '50%',
                top: '39%',
                zIndex: 0,
                width: 'max-content',
                pointerEvents: 'none',
                opacity: titleOpacity,
                transform: `translate3d(${rightTitleOffset}px, calc(-50% - ${titleVerticalShift}px), 0)`,
                willChange: 'transform, opacity',
              }}
            >
              <div style={{ ...desktopTitleFont, margin: 0, whiteSpace: 'nowrap', color: textColor }}>
                {rightTitle}
              </div>
            </div>
            <div
              style={{
                ...desktopCenterFont,
                position: 'absolute',
                left: '50%',
                top: '50%',
                zIndex: 2,
                width: safeCenterTextWidth,
                maxWidth: '80vw',
                padding: 16,
                boxSizing: 'border-box',
                pointerEvents: 'none',
                opacity: centerCopyOpacity,
                transform: 'translate3d(-50%, -50%, 0)',
                color: textColor,
              }}
            >
              {centerText}
            </div>
          </>
        )}

        <div style={{ position: 'absolute', inset: 0, zIndex: 10, transformStyle: 'preserve-3d' }}>
          {projectItems.map((item, index) => {
            const revealStart = 0.025 + index * 0.01;
            const revealEnd = 0.18 + index * 0.012;
            const cardReveal = smootherstep(revealStart, revealEnd, progress);
            const flattenStart = 0.56 + index * 0.009;
            const flattenEnd = Math.min(0.91 + index * 0.009, 0.99);
            const flattenProgress = smootherstep(flattenStart, flattenEnd, progress);
            const baseAngle = (index / Math.max(itemCount, 1)) * 360 - 125;
            const angle = baseAngle + orbitProgress * orbitRotation;
            const radians = (angle * Math.PI) / 180;
            const arcCenterX = Math.sin(radians) * actualCurveWidth;
            const arcCenterY = Math.cos(radians + 0.65) * actualCurveHeight - viewportHeight * 0.025 + orbitOffsetY;
            const arcZ = Math.cos(radians) * actualDepth;
            const normalizedDepth = clamp((arcZ + actualDepth) / Math.max(actualDepth * 2, 1));
            const minimumDepthScale = clamp(depthScale, 50, 100) / 100;
            const arcScale = lerp(minimumDepthScale, 1, normalizedDepth);
            const minimumDepthOpacity = clamp(depthOpacity, 0, 100) / 100;
            const arcOpacity = lerp(minimumDepthOpacity, 1, normalizedDepth);
            const arcRotateY = -Math.sin(radians) * 62;
            const arcRotateZ = -Math.sin(radians) * 8;
            const entranceOffset = (1 - cardReveal) * viewportHeight * 0.48;
            const arcLeft = arcCenterX - actualArcCardWidth / 2;
            const arcTop = arcCenterY - actualArcCardHeight / 2 + entranceOffset;
            const column = index % desktopColumns;
            const row = Math.floor(index / desktopColumns);
            const gridLeft = -finalGridWidth / 2 + column * (finalCardWidth + gridGap);
            const gridTop =
              viewportHeight * (gridPositionY / 100) -
              viewportHeight / 2 -
              finalGridHeight / 2 +
              row * (finalCardHeight + gridGap);
            const width = lerp(actualArcCardWidth, finalCardWidth, flattenProgress);
            const height = lerp(actualArcCardHeight, finalCardHeight, flattenProgress);
            const x = lerp(arcLeft, gridLeft, flattenProgress);
            const y = lerp(arcTop, gridTop, flattenProgress);
            const z = lerp(arcZ, 0, flattenProgress);
            const rotateY = lerp(arcRotateY, 0, flattenProgress);
            const rotateZ = lerp(arcRotateZ, 0, flattenProgress);
            const scale = lerp(arcScale, 1, flattenProgress);
            const opacity = clamp(lerp(arcOpacity * cardReveal * revealProgress, 1, flattenProgress));
            const zIndex = flattenProgress > 0.86 ? 100 + index : Math.round(100 + normalizedDepth * 800);

            return (
              <DesktopProjectCard
                key={`${item.label || 'project'}-${index}`}
                item={item}
                index={index}
                x={x}
                y={y}
                z={z}
                width={width}
                height={height}
                rotateY={rotateY}
                rotateZ={rotateZ}
                scale={scale}
                opacity={opacity}
                zIndex={zIndex}
                radius={cardRadius}
                imageFit={imageFit}
                cardBackground={cardBackground}
                labelColor={labelColor}
                labelFont={labelFont}
                renderQuality={renderQuality}
                flattened={flattenProgress}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default OrbitProjects;
