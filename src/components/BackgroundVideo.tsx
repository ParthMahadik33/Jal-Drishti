import React, { useEffect, useRef } from 'react';

const VIDEO_URL =
  'https://res.cloudinary.com/dbpo7d6dx/video/upload/v1792079591/hero_blob_gwr_video_mvp_2K_upscaled_gdxyer.mp4';
const SENSITIVITY = 0.8;

interface BackgroundVideoProps {
  className?: string;
}

export const BackgroundVideo: React.FC<BackgroundVideoProps> = ({ className }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const targetTimeRef = useRef<number>(0);
  const isSeekingRef = useRef<boolean>(false);
  const prevXRef = useRef<number | null>(null);

  const performSeek = () => {
    const video = videoRef.current;
    if (!video || isSeekingRef.current) return;

    if (Math.abs(video.currentTime - targetTimeRef.current) > 0.01) {
      isSeekingRef.current = true;
      video.currentTime = targetTimeRef.current;
    }
  };

  const handleSeeked = () => {
    isSeekingRef.current = false;
    performSeek();
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      const initialTime = videoRef.current.duration * 0.5;
      targetTimeRef.current = initialTime;
      videoRef.current.currentTime = initialTime;
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const video = videoRef.current;
      if (!video || !video.duration || Number.isNaN(video.duration)) {
        prevXRef.current = e.clientX;
        return;
      }

      if (prevXRef.current === null) {
        prevXRef.current = e.clientX;
        return;
      }

      const delta = e.clientX - prevXRef.current;
      prevXRef.current = e.clientX;

      // Inverted so eye tracks with cursor (cursor right -> eye looks right, cursor left -> eye looks left)
      const timeOffset = -(delta / window.innerWidth) * SENSITIVITY * video.duration;
      targetTimeRef.current = Math.min(
        Math.max(targetTimeRef.current + timeOffset, 0),
        video.duration
      );

      performSeek();
    };

    const handleMouseLeave = () => {
      prevXRef.current = null;
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        prevXRef.current = e.touches[0].clientX;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        const clientX = e.touches[0].clientX;
        const video = videoRef.current;
        if (!video || !video.duration || Number.isNaN(video.duration)) {
          prevXRef.current = clientX;
          return;
        }

        if (prevXRef.current === null) {
          prevXRef.current = clientX;
          return;
        }

        const delta = clientX - prevXRef.current;
        prevXRef.current = clientX;

        // Inverted so eye tracks with touch
        const timeOffset = -(delta / window.innerWidth) * SENSITIVITY * video.duration;
        targetTimeRef.current = Math.min(
          Math.max(targetTimeRef.current + timeOffset, 0),
          video.duration
        );

        performSeek();
      }
    };

    const handleTouchEnd = () => {
      prevXRef.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseleave', handleMouseLeave);
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, []);

  return (
    <video
      ref={videoRef}
      src={VIDEO_URL}
      muted
      playsInline
      preload="auto"
      onSeeked={handleSeeked}
      onLoadedMetadata={handleLoadedMetadata}
      className={
        className ||
        'fixed inset-0 z-0 w-full h-full pointer-events-none select-none object-cover object-[80%_center] sm:object-[74%_center] lg:object-[70%_center]'
      }
    />
  );
};
