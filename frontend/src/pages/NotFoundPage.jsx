import Silian_React, { useRef as Silian_useRef, useEffect as Silian_useEffect } from 'react';
import { Link as Silian_Link } from 'react-router-dom';
import { Button as Silian_Button } from '../components/ui/Button';
import { useTranslation as Silian_useTranslation } from '../hooks/useTranslation';
import './NotFoundPage.css';

const Silian_BASE_SPEED = 40;
const Silian_ANGULAR_ACCEL = 360;
const Silian_SCALE_BASE_RATE = 1.2;
const Silian_SCALE_VELOCITY_FACTOR = 1 / 800;
const Silian_COLOR_LERP = 8;

export default function NotFoundPage() {
  const { t: Silian_t } = Silian_useTranslation(['notFoundPage']);
  const Silian_emojiRef = Silian_useRef(null);
  const Silian_angleRef = Silian_useRef(0); // degrees
  const Silian_velocityRef = Silian_useRef(40); // deg/s
  const Silian_rafRef = Silian_useRef(null);
  const Silian_lastTimeRef = Silian_useRef(null);
  const Silian_directionRef = Silian_useRef(1);
  const Silian_isHoveredRef = Silian_useRef(false);
  const Silian_scaleRef = Silian_useRef(1);
  const Silian_colorMixRef = Silian_useRef(0); // 0..1

  Silian_useEffect(() => {
    const Silian_el = Silian_emojiRef.current;
    if (!Silian_el) return;

    const Silian_redColor = '#ff3b30';

    const Silian_hexToRgb = (Silian_hex) => {
      const Silian_h = Silian_hex.replace('#', '');
      const Silian_bigint = parseInt(Silian_h, 16);
      return { r: (Silian_bigint >> 16) & 255, g: (Silian_bigint >> 8) & 255, b: Silian_bigint & 255 };
    };

    const Silian_rgbToCss = (Silian_rgb) => `rgb(${Math.round(Silian_rgb.r)}, ${Math.round(Silian_rgb.g)}, ${Math.round(Silian_rgb.b)})`;

    const Silian_lerp = (Silian_a, Silian_b, Silian_t) => Silian_a + (Silian_b - Silian_a) * Silian_t;
    const Silian_lerpColor = (Silian_c1, Silian_c2, Silian_t) => ({ r: Silian_lerp(Silian_c1.r, Silian_c2.r, Silian_t), g: Silian_lerp(Silian_c1.g, Silian_c2.g, Silian_t), b: Silian_lerp(Silian_c1.b, Silian_c2.b, Silian_t) });

    const Silian_baseRgb = Silian_hexToRgb('#374151'); // Tailwind gray-700 fallback
    const Silian_redRgb = Silian_hexToRgb(Silian_redColor);

    const Silian_step = (Silian_time) => {
      if (Silian_lastTimeRef.current == null) Silian_lastTimeRef.current = Silian_time;
      const Silian_dt = Math.min(0.05, (Silian_time - Silian_lastTimeRef.current) / 1000); // seconds, clamp to avoid big jumps
      Silian_lastTimeRef.current = Silian_time;

      const Silian_hovered = Silian_isHoveredRef.current;
      if (Silian_hovered) {
        Silian_velocityRef.current += Silian_directionRef.current * Silian_ANGULAR_ACCEL * Silian_dt;
      } else {
        const Silian_dir = Silian_directionRef.current;
        const Silian_speed = Math.abs(Silian_velocityRef.current || Silian_dir * Silian_BASE_SPEED);
        if (Silian_speed > Silian_BASE_SPEED) {
          const Silian_decel = Silian_ANGULAR_ACCEL * Silian_dt;
          const Silian_newSpeed = Math.max(Silian_BASE_SPEED, Silian_speed - Silian_decel);
          Silian_velocityRef.current = Silian_dir * Silian_newSpeed;
        } else {
          Silian_velocityRef.current = Silian_dir * Silian_BASE_SPEED;
        }
      }
      Silian_angleRef.current += Silian_velocityRef.current * Silian_dt;

      const Silian_scaleRate = Silian_SCALE_BASE_RATE + Math.abs(Silian_velocityRef.current) * Silian_SCALE_VELOCITY_FACTOR;
      if (Silian_hovered) {
        Silian_scaleRef.current += Silian_scaleRate * Silian_dt;
      } else {
        Silian_scaleRef.current = Math.max(1, Silian_scaleRef.current - Silian_scaleRate * Silian_dt);
      }

      const Silian_colorTarget = Silian_hovered ? 1 : 0;
      const Silian_colorAlpha = 1 - Math.exp(-Silian_COLOR_LERP * Silian_dt);
      Silian_colorMixRef.current += (Silian_colorTarget - Silian_colorMixRef.current) * Silian_colorAlpha;
      const Silian_mixedRgb = Silian_lerpColor(Silian_baseRgb, Silian_redRgb, Silian_colorMixRef.current);

      // apply to element without forcing React updates
      Silian_el.style.transform = `rotate(${Silian_angleRef.current}deg) scale(${Silian_scaleRef.current})`;
      Silian_el.style.color = Silian_rgbToCss(Silian_mixedRgb);

      Silian_rafRef.current = requestAnimationFrame(Silian_step);
    };

    Silian_rafRef.current = requestAnimationFrame(Silian_step);

    return () => {
      if (Silian_rafRef.current) cancelAnimationFrame(Silian_rafRef.current);
      Silian_rafRef.current = null;
    };
    // empty dependency so RAF loop never restarts unexpectedly
  }, []);

  const Silian_handleMouseEnter = () => {
    Silian_isHoveredRef.current = true;
  };
  const Silian_handleMouseLeave = () => {
    const Silian_prevVelocity = Silian_velocityRef.current || Silian_directionRef.current * Silian_BASE_SPEED;
    Silian_isHoveredRef.current = false;
    const Silian_newDirection = Silian_prevVelocity >= 0 ? -1 : 1;
    Silian_directionRef.current = Silian_newDirection;
    Silian_velocityRef.current = -Silian_prevVelocity;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 text-foreground">
      <div className="text-center max-w-xl">
        <h1 className="mb-4 text-5xl font-bold text-foreground">{Silian_t('notFoundPage.code')}</h1>
        <div
          className="mb-6 flex items-center justify-center"
          onMouseEnter={Silian_handleMouseEnter}
          onMouseLeave={Silian_handleMouseLeave}
        >
          <span
            aria-hidden
            ref={Silian_emojiRef}
            className="text-6xl emoji"
            style={{ display: 'inline-block' }}
          >
            {Silian_t('notFoundPage.emoji')}
          </span>
        </div>
        <p className="mb-2 text-lg text-foreground">{Silian_t('notFoundPage.message')}</p>
        <p className="mb-6 text-base text-muted-foreground">{Silian_t('notFoundPage.submessage')}</p>
        <div className="flex items-center justify-center gap-3">
          <Silian_Button
            onClick={() => window.location.reload()}
            variant="outline"
          >
            {Silian_t('notFoundPage.refresh')}
          </Silian_Button>
          <Silian_Link to="/">
            <Silian_Button>
              {Silian_t('notFoundPage.home')}
            </Silian_Button>
          </Silian_Link>
        </div>
      </div>
    </div>
  );
}
