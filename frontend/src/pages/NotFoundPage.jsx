import React, { useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { useTranslation } from '../hooks/useTranslation';
import './NotFoundPage.css';

const BASE_SPEED = 40;
const ANGULAR_ACCEL = 360;
const SCALE_BASE_RATE = 1.2;
const SCALE_VELOCITY_FACTOR = 1 / 800;
const COLOR_LERP = 8;

export default function NotFoundPage() {
  const { t } = useTranslation();
  const emojiRef = useRef(null);
  const angleRef = useRef(0); // degrees
  const velocityRef = useRef(40); // deg/s
  const rafRef = useRef(null);
  const lastTimeRef = useRef(null);
  const directionRef = useRef(1);
  const isHoveredRef = useRef(false);
  const scaleRef = useRef(1);
  const colorMixRef = useRef(0); // 0..1

  useEffect(() => {
    const el = emojiRef.current;
    if (!el) return;

    const redColor = '#ff3b30';

    const hexToRgb = (hex) => {
      const h = hex.replace('#', '');
      const bigint = parseInt(h, 16);
      return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
    };

    const rgbToCss = (rgb) => `rgb(${Math.round(rgb.r)}, ${Math.round(rgb.g)}, ${Math.round(rgb.b)})`;

    const lerp = (a, b, t) => a + (b - a) * t;
    const lerpColor = (c1, c2, t) => ({ r: lerp(c1.r, c2.r, t), g: lerp(c1.g, c2.g, t), b: lerp(c1.b, c2.b, t) });

    const baseRgb = hexToRgb('#374151'); // Tailwind gray-700 fallback
    const redRgb = hexToRgb(redColor);

    const step = (time) => {
      if (lastTimeRef.current == null) lastTimeRef.current = time;
      const dt = Math.min(0.05, (time - lastTimeRef.current) / 1000); // seconds, clamp to avoid big jumps
      lastTimeRef.current = time;

      const hovered = isHoveredRef.current;
      if (hovered) {
        velocityRef.current += directionRef.current * ANGULAR_ACCEL * dt;
      } else {
        const dir = directionRef.current;
        const speed = Math.abs(velocityRef.current || dir * BASE_SPEED);
        if (speed > BASE_SPEED) {
          const decel = ANGULAR_ACCEL * dt;
          const newSpeed = Math.max(BASE_SPEED, speed - decel);
          velocityRef.current = dir * newSpeed;
        } else {
          velocityRef.current = dir * BASE_SPEED;
        }
      }
      angleRef.current += velocityRef.current * dt;

      const scaleRate = SCALE_BASE_RATE + Math.abs(velocityRef.current) * SCALE_VELOCITY_FACTOR;
      if (hovered) {
        scaleRef.current += scaleRate * dt;
      } else {
        scaleRef.current = Math.max(1, scaleRef.current - scaleRate * dt);
      }

      const colorTarget = hovered ? 1 : 0;
      const colorAlpha = 1 - Math.exp(-COLOR_LERP * dt);
      colorMixRef.current += (colorTarget - colorMixRef.current) * colorAlpha;
      const mixedRgb = lerpColor(baseRgb, redRgb, colorMixRef.current);

      // apply to element without forcing React updates
      el.style.transform = `rotate(${angleRef.current}deg) scale(${scaleRef.current})`;
      el.style.color = rgbToCss(mixedRgb);

      rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
    // empty dependency so RAF loop never restarts unexpectedly
  }, []);

  const handleMouseEnter = () => {
    isHoveredRef.current = true;
  };
  const handleMouseLeave = () => {
    const prevVelocity = velocityRef.current || directionRef.current * BASE_SPEED;
    isHoveredRef.current = false;
    const newDirection = prevVelocity >= 0 ? -1 : 1;
    directionRef.current = newDirection;
    velocityRef.current = -prevVelocity;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="text-center max-w-xl">
        <h1 className="text-5xl font-bold mb-4 text-gray-900">{t('notFoundPage.code')}</h1>
        <div
          className="mb-6 flex items-center justify-center"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <span
            aria-hidden
            ref={emojiRef}
            className="text-6xl emoji"
            style={{ display: 'inline-block' }}
          >
            {t('notFoundPage.emoji')}
          </span>
        </div>
        <p className="text-lg text-gray-700 mb-2">{t('notFoundPage.message')}</p>
        <p className="text-base text-gray-600 mb-6">{t('notFoundPage.submessage')}</p>
        <div className="flex items-center justify-center gap-3">
          <Button 
            onClick={() => window.location.reload()}
            variant="outline"
          >
            {t('notFoundPage.refresh')}
          </Button>
          <Link to="/">
            <Button>
              {t('notFoundPage.home')}
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
