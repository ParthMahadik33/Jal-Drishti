import React, { useEffect, useRef, useState, useCallback } from 'react';

interface Chapter {
  id: number;
  eyebrow: string;
  headline: string;
  description: string;
  frameIndex: number; // Anchor frame for quick jumping / reduced motion
}

const TOTAL_FRAMES = 300;

const CHAPTERS: Chapter[] = [
  {
    id: 1,
    eyebrow: '01 / THE PROBLEM',
    headline: 'Flooding leaves a pattern.',
    description:
      'Waterlogging can return to the same places, monsoon after monsoon. Understanding that pattern is the first step towards better action.',
    frameIndex: 1,
  },
  {
    id: 2,
    eyebrow: '02 / CITIZEN REPORTING',
    headline: 'Every report adds context.',
    description:
      'A photo and location shared through WhatsApp help turn a local incident into useful evidence.',
    frameIndex: 90,
  },
  {
    id: 3,
    eyebrow: '03 / FLOOD INTELLIGENCE',
    headline: 'See the hotspots, not just the incidents.',
    description:
      'Bring reports together with available rainfall, terrain and historical information to identify zones that need attention.',
    frameIndex: 155,
  },
  {
    id: 4,
    eyebrow: '04 / THE DIFFERENCE',
    headline: "A resolved complaint isn't always a solved problem.",
    description:
      'When waterlogging returns after a maintenance action has been recorded, JalDrishti flags the location for closer investigation.',
    frameIndex: 220,
  },
  {
    id: 5,
    eyebrow: '05 / THE OUTCOME',
    headline: 'Know where to look next.',
    description:
      'Help officers prioritise inspections, maintenance and further drainage assessment using recurring reports and recorded actions.',
    frameIndex: 300,
  },
];

const getFrameUrl = (frameNum: number): string => {
  const padded = String(Math.min(TOTAL_FRAMES, Math.max(1, frameNum))).padStart(3, '0');
  return `/frames/ezgif-frame-${padded}.jpg`;
};

export const StorytellingSection: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imagesRef = useRef<Map<number, HTMLImageElement>>(new Map());
  const loadingQueueRef = useRef<Set<number>>(new Set());
  const rafIdRef = useRef<number | null>(null);
  const currentDrawnFrameRef = useRef<number>(1);
  const targetFrameRef = useRef<number>(1);

  const [activeChapter, setActiveChapter] = useState<number>(0);
  const [scrollProgress, setScrollProgress] = useState<number>(0);
  const [isPosterLoaded, setIsPosterLoaded] = useState<boolean>(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(false);

  // Check reduced motion preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const listener = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  }, []);

  // Frame loading helper
  const loadFrame = useCallback((frameNum: number): Promise<HTMLImageElement> => {
    if (imagesRef.current.has(frameNum)) {
      return Promise.resolve(imagesRef.current.get(frameNum)!);
    }

    if (loadingQueueRef.current.has(frameNum)) {
      return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (imagesRef.current.has(frameNum)) {
            clearInterval(checkInterval);
            resolve(imagesRef.current.get(frameNum)!);
          }
        }, 30);
      });
    }

    loadingQueueRef.current.add(frameNum);
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.src = getFrameUrl(frameNum);
      img.onload = () => {
        imagesRef.current.set(frameNum, img);
        loadingQueueRef.current.delete(frameNum);
        if (frameNum === 1) setIsPosterLoaded(true);
        resolve(img);
      };
      img.onerror = (err) => {
        loadingQueueRef.current.delete(frameNum);
        reject(err);
      };
    });
  }, []);

  // Draw frame on canvas with DPR scaling and 16:9 aspect preservation
  const drawFrame = useCallback((frameNum: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Find best image: exact target or closest available loaded frame
    let imgToDraw = imagesRef.current.get(frameNum);

    if (!imgToDraw || !imgToDraw.complete || imgToDraw.naturalWidth === 0) {
      // Find nearest loaded frame to avoid blank flash
      let nearestDist = Infinity;
      let nearestFrame = currentDrawnFrameRef.current;

      for (const [key, cachedImg] of imagesRef.current.entries()) {
        if (cachedImg.complete && cachedImg.naturalWidth > 0) {
          const dist = Math.abs(key - frameNum);
          if (dist < nearestDist) {
            nearestDist = dist;
            nearestFrame = key;
          }
        }
      }
      imgToDraw = imagesRef.current.get(nearestFrame);

      // Trigger load for the desired frame
      loadFrame(frameNum).then(() => {
        if (targetFrameRef.current === frameNum) {
          drawFrame(frameNum);
        }
      });
    }

    if (!imgToDraw || !imgToDraw.complete || imgToDraw.naturalWidth === 0) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    // Resize canvas buffer if needed
    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
    }

    ctx.save();
    ctx.scale(dpr, dpr);

    // Clear background
    ctx.fillStyle = '#E8F3FD';
    ctx.fillRect(0, 0, width, height);

    // 16:9 letterbox / pillarbox scaling (object-fit: contain)
    const imgAspect = imgToDraw.naturalWidth / imgToDraw.naturalHeight;
    const canvasAspect = width / height;

    let drawW = width;
    let drawH = height;
    let offsetX = 0;
    let offsetY = 0;

    if (canvasAspect > imgAspect) {
      drawH = height;
      drawW = height * imgAspect;
      offsetX = (width - drawW) / 2;
    } else {
      drawW = width;
      drawH = width / imgAspect;
      offsetY = (height - drawH) / 2;
    }

    ctx.drawImage(imgToDraw, offsetX, offsetY, drawW, drawH);
    ctx.restore();

    currentDrawnFrameRef.current = frameNum;
  }, [loadFrame]);

  // Priority preloader: initial frame, keyframes, then nearby window
  useEffect(() => {
    let cancelled = false;

    // 1. Immediately load frame 1
    loadFrame(1).then(() => {
      if (!cancelled) drawFrame(1);
    });

    // 2. Preload sparse keyframes (every 10th frame) to give immediate coverage across entire scroll range
    const preloadKeyframes = async () => {
      for (let f = 10; f <= TOTAL_FRAMES; f += 10) {
        if (cancelled) break;
        await loadFrame(f);
      }

      // 3. Incrementally preload all remaining frames
      for (let f = 1; f <= TOTAL_FRAMES; f++) {
        if (cancelled) break;
        if (!imagesRef.current.has(f)) {
          await loadFrame(f);
        }
      }
    };

    const timer = setTimeout(preloadKeyframes, 200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [loadFrame, drawFrame]);

  // Window resize handler to maintain sharp DPR rendering
  useEffect(() => {
    const handleResize = () => {
      drawFrame(currentDrawnFrameRef.current);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [drawFrame]);

  // Main scroll loop with requestAnimationFrame
  useEffect(() => {
    let ticking = false;

    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        rafIdRef.current = requestAnimationFrame(() => {
          ticking = false;
          const container = containerRef.current;
          if (!container) return;

          const rect = container.getBoundingClientRect();
          const viewportH = window.innerHeight;
          const totalScrollable = rect.height - viewportH;

          if (totalScrollable <= 0) return;

          // Progress strictly 0 to 1 while container travels through viewport
          const currentScroll = -rect.top;
          const rawProgress = currentScroll / totalScrollable;
          const clampedProgress = Math.max(0, Math.min(1, rawProgress));

          setScrollProgress(clampedProgress);

          // Calculate chapter (0 to 4)
          // 5 chapters evenly spaced across scroll progress [0-0.2, 0.2-0.4, 0.4-0.6, 0.6-0.8, 0.8-1.0]
          const chapterIdx = Math.min(4, Math.max(0, Math.floor(clampedProgress * 5)));
          setActiveChapter(chapterIdx);

          if (prefersReducedMotion) {
            // In reduced motion, snap to representative frame
            const target = CHAPTERS[chapterIdx].frameIndex;
            targetFrameRef.current = target;
            drawFrame(target);
            return;
          }

          // Continuous frame mapping (1 to 300)
          const targetFrame = Math.min(
            TOTAL_FRAMES,
            Math.max(1, Math.round(1 + clampedProgress * (TOTAL_FRAMES - 1)))
          );

          targetFrameRef.current = targetFrame;
          drawFrame(targetFrame);

          // Preload adjacent frames ahead of scroll direction
          for (let offset = 1; offset <= 8; offset++) {
            const nextF = Math.min(TOTAL_FRAMES, targetFrame + offset);
            const prevF = Math.max(1, targetFrame - offset);
            loadFrame(nextF);
            loadFrame(prevF);
          }
        });
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    // Trigger initial calculation
    onScroll();

    return () => {
      window.removeEventListener('scroll', onScroll);
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, [drawFrame, loadFrame, prefersReducedMotion]);

  // Click on chapter indicator to scroll smoothly to that chapter
  const scrollToChapter = (index: number) => {
    const container = containerRef.current;
    if (!container) return;

    const viewportH = window.innerHeight;
    const totalScrollable = container.offsetHeight - viewportH;
    const targetScrollY =
      container.offsetTop + (index / (CHAPTERS.length - 1)) * totalScrollable;

    window.scrollTo({
      top: targetScrollY,
      behavior: 'smooth',
    });
  };

  const currentChapter = CHAPTERS[activeChapter] || CHAPTERS[0];

  return (
    <section
      id="how-it-works"
      ref={containerRef}
      aria-label="How JalDrishti works storytelling"
      className="relative w-full bg-gradient-to-b from-[#EAF5FF] via-[#F4F9FF] to-[#EAF5FF] z-20"
      style={{ height: '360vh' }}
    >
      {/* Sticky Viewport Stage */}
      <div className="sticky top-0 h-screen w-full flex flex-col justify-center overflow-hidden">
        <div className="max-w-[1440px] w-full mx-auto px-6 sm:px-10 lg:px-16 py-6 sm:py-10 flex flex-col justify-between h-full">
          {/* Top subtle breadcrumb indicator */}
          <div className="pt-4 sm:pt-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-[#1769C2] animate-pulse" />
              <span className="font-sans font-medium text-[11px] sm:text-[12px] text-[#1769C2] tracking-[0.2em] uppercase select-none">
                Interactive Case Study &middot; JalDrishti Intelligence Flow
              </span>
            </div>

            {/* Overall frame progress badge */}
            <div className="hidden sm:flex items-center gap-2 font-sans text-[11px] text-[#526984] font-medium select-none">
              <span>Scene</span>
              <span className="font-semibold text-[#09172A]">0{activeChapter + 1}</span>
              <span>/ 05</span>
            </div>
          </div>

          {/* Two-Column Editorial Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-center my-auto w-full">
            {/* Left Column: Narrative Copy (35–40% width) */}
            <div className="lg:col-span-5 flex flex-col justify-center order-2 lg:order-1">
              {/* 5-Step Progress Tabs */}
              <nav aria-label="Chapter navigation" className="flex items-center gap-2 mb-6 sm:mb-8">
                {CHAPTERS.map((ch, idx) => {
                  const isActive = idx === activeChapter;
                  const isPassed = idx < activeChapter;
                  return (
                    <button
                      key={ch.id}
                      type="button"
                      onClick={() => scrollToChapter(idx)}
                      className="group flex flex-col items-start gap-1 py-1 cursor-pointer focus:outline-none"
                      aria-label={`Jump to ${ch.eyebrow}`}
                      aria-current={isActive ? 'step' : undefined}
                    >
                      <div
                        className={`h-[3px] rounded-full transition-all duration-300 ${
                          isActive
                            ? 'w-10 sm:w-12 bg-[#1769C2]'
                            : isPassed
                            ? 'w-6 sm:w-7 bg-[#1769C2]/40'
                            : 'w-6 sm:w-7 bg-[#CADDF0]'
                        }`}
                      />
                    </button>
                  );
                })}
              </nav>

              {/* Chapter Narrative Card with subtle, restrained transition */}
              <div
                key={currentChapter.id}
                className="transition-all duration-300 ease-out transform translate-y-0 opacity-100"
              >
                {/* Eyebrow Label */}
                <div className="font-sans font-medium text-[13px] sm:text-[14px] text-[#1769C2] tracking-[0.2em] uppercase mb-3 select-none">
                  {currentChapter.eyebrow}
                </div>

                {/* Headline in Instrument Serif */}
                <h2
                  className="font-serif font-normal text-[#09172A] text-[34px] sm:text-[44px] lg:text-[48px] xl:text-[52px] leading-[1.08] tracking-tight mb-4 sm:mb-5 text-left"
                >
                  {currentChapter.headline}
                </h2>

                {/* Supporting Paragraph in Manrope */}
                <p className="font-sans font-normal text-[#526984] text-[16px] sm:text-[18px] lg:text-[19px] leading-[1.55] max-w-[480px]">
                  {currentChapter.description}
                </p>
              </div>

              {/* Scroll prompt hint on first chapter */}
              {activeChapter === 0 && (
                <div className="mt-8 flex items-center gap-2 text-[12px] font-sans text-[#526984] select-none opacity-80 animate-bounce">
                  <span>Scroll down to continue the story</span>
                  <span className="text-base">&darr;</span>
                </div>
              )}
            </div>

            {/* Right Column: Visual Stage (60–65% width) */}
            <div className="lg:col-span-7 flex flex-col items-center justify-center order-1 lg:order-2 w-full">
              <div className="relative w-full aspect-video rounded-2xl md:rounded-3xl overflow-hidden border border-[#CADDF0]/80 shadow-[0_20px_50px_-15px_rgba(23,105,194,0.12)] bg-[#E8F3FD]">
                {/* HTML5 Canvas Rendering Image Sequence */}
                <canvas
                  ref={canvasRef}
                  className="w-full h-full block object-contain"
                  aria-label={`JalDrishti animation frame showing ${currentChapter.eyebrow}`}
                />

                {/* Static poster fallback while opening frame loads */}
                {!isPosterLoaded && (
                  <div className="absolute inset-0 bg-[#E8F3FD] flex items-center justify-center">
                    <span className="font-sans text-[13px] text-[#526984] animate-pulse">
                      Loading narrative sequence...
                    </span>
                  </div>
                )}

                {/* Subtle frame counter pill on top-right */}
                <div className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4 bg-white/80 backdrop-blur-xs px-3 py-1 rounded-full text-[11px] font-sans font-medium text-[#09172A]/80 shadow-xs border border-white/60 select-none">
                  <span className="text-[#1769C2]">
                    {Math.round(scrollProgress * 100)}%
                  </span>
                  <span className="mx-1 text-[#CADDF0]">&middot;</span>
                  <span>Frame {targetFrameRef.current} / 300</span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom subtle bar */}
          <div className="pb-3 sm:pb-4 flex items-center justify-between border-t border-[#CADDF0]/40 pt-3 text-[11px] font-sans text-[#526984]/70">
            <span className="uppercase tracking-[0.2em] font-medium">
              Stage {activeChapter + 1} of 5
            </span>
            <span className="uppercase tracking-[0.15em]">
              Scroll to scrub timeline
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};
