/* eslint-disable no-unused-vars */
import Silian_React from 'react';
import { motion as Silian_motion, AnimatePresence as Silian_AnimatePresence } from 'framer-motion';
import { ChevronLeft as Silian_ChevronLeft, ChevronRight as Silian_ChevronRight, Pause as Silian_Pause, Play as Silian_Play } from 'lucide-react';
import { useTranslation as Silian_useTranslation } from '../../hooks/useTranslation';
import { cn as Silian_cn } from '@/lib/utils';
/* eslint-enable no-unused-vars */

/**
 * 现代化的Hero区域轮播图组件
 * 支持自动播放、手动控制、暂停等功能
 */
export default function HeroCarousel({ items: Silian_items = [], interval: Silian_interval = 5000, className: Silian_className }) {
  const { t: Silian_t } = Silian_useTranslation(['home']);
  const [Silian_currentIndex, Silian_setCurrentIndex] = Silian_React.useState(0);
  const [Silian_isPaused, Silian_setIsPaused] = Silian_React.useState(false);
  const [Silian_direction, Silian_setDirection] = Silian_React.useState(0);

  const Silian_handlePrevious = Silian_React.useCallback(() => {
    Silian_setDirection(-1);
    Silian_setCurrentIndex((Silian_prev) => (Silian_prev - 1 + Silian_items.length) % Silian_items.length);
  }, [Silian_items.length]);

  const Silian_handleNext = Silian_React.useCallback(() => {
    Silian_setDirection(1);
    Silian_setCurrentIndex((Silian_prev) => (Silian_prev + 1) % Silian_items.length);
  }, [Silian_items.length]);

  const Silian_goToSlide = Silian_React.useCallback((Silian_index) => {
    Silian_setDirection(Silian_index > Silian_currentIndex ? 1 : -1);
    Silian_setCurrentIndex(Silian_index);
  }, [Silian_currentIndex]);

  // 自动播放逻辑
  Silian_React.useEffect(() => {
    if (!Silian_items.length || Silian_isPaused) {
      return undefined;
    }

    const Silian_timer = window.setInterval(() => {
      Silian_setDirection(1);
      Silian_setCurrentIndex((Silian_prev) => (Silian_prev + 1) % Silian_items.length);
    }, Silian_interval);

    return () => window.clearInterval(Silian_timer);
  }, [Silian_items.length, Silian_interval, Silian_isPaused]);

  // 键盘导航
  Silian_React.useEffect(() => {
    const Silian_handleKeyDown = (Silian_e) => {
      if (Silian_e.key === 'ArrowLeft') {
        Silian_handlePrevious();
      } else if (Silian_e.key === 'ArrowRight') {
        Silian_handleNext();
      }
    };

    window.addEventListener('keydown', Silian_handleKeyDown);
    return () => window.removeEventListener('keydown', Silian_handleKeyDown);
  }, [Silian_handlePrevious, Silian_handleNext]);

  if (!Silian_items || Silian_items.length === 0) {
    return null;
  }

  const Silian_currentItem = Silian_items[Silian_currentIndex];

  const Silian_slideVariants = {
    enter: (Silian_direction) => ({
      x: Silian_direction > 0 ? 1000 : -1000,
      opacity: 0,
      scale: 0.8,
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1,
      scale: 1,
    },
    exit: (Silian_direction) => ({
      zIndex: 0,
      x: Silian_direction < 0 ? 1000 : -1000,
      opacity: 0,
      scale: 0.8,
    }),
  };

  return (
    <div
      className={Silian_cn("relative w-full max-w-4xl mx-auto", Silian_className)}
      onMouseEnter={() => Silian_setIsPaused(true)}
      onMouseLeave={() => Silian_setIsPaused(false)}
    >
      {/* 主要内容区 */}
      <div className="relative min-h-[280px] overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-card via-card to-secondary/35 shadow-2xl md:min-h-[320px]">
        <Silian_AnimatePresence initial={false} custom={Silian_direction} mode="wait">
          <Silian_motion.div
            key={Silian_currentIndex}
            custom={Silian_direction}
            variants={Silian_slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              x: { type: "spring", stiffness: 300, damping: 30 },
              opacity: { duration: 0.3 },
              scale: { duration: 0.3 },
            }}
            className="px-8 py-12 md:px-16 md:py-16"
          >
            {/* 装饰性背景图案 */}
            <div className="absolute inset-0 opacity-5">
              <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-400 rounded-full blur-3xl" />
              <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-400 rounded-full blur-3xl" />
            </div>

            {/* 内容 */}
            <div className="relative z-10 text-center">
              <Silian_motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.1, duration: 0.5 }}
              >
                <h3 className="text-2xl md:text-3xl lg:text-4xl font-bold text-emerald-600 mb-4 leading-tight">
                  {Silian_currentItem.title}
                </h3>
              </Silian_motion.div>

              <Silian_motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.5 }}
              >
                <p className="text-muted-foreground mx-auto max-w-2xl text-base leading-relaxed md:text-lg lg:text-xl">
                  {Silian_currentItem.description}
                </p>
              </Silian_motion.div>
            </div>
          </Silian_motion.div>
        </Silian_AnimatePresence>

        {/* 进度条 - 固定在容器底部，不参与动画 */}
        <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-100 via-emerald-200 to-emerald-100 rounded-b-3xl overflow-hidden">
          {!Silian_isPaused && (
            <Silian_motion.div
              className="h-full bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-600 shadow-lg relative"
              initial={{ width: "0%" }}
              animate={{ width: "100%" }}
              transition={{ duration: Silian_interval / 1000, ease: "linear" }}
              key={`progress-${Silian_currentIndex}`}
            >
              {/* 发光效果 */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-shimmer" />
            </Silian_motion.div>
          )}
        </div>

        {/* 左右导航按钮 */}
        {Silian_items.length > 1 && (
          <>
            <button
              type="button"
              onClick={Silian_handlePrevious}
              className="group absolute left-4 top-1/2 z-20 -translate-y-1/2 rounded-full border border-border/60 bg-card/90 p-2 text-emerald-600 shadow-lg backdrop-blur-sm transition-all hover:scale-110 hover:bg-card hover:shadow-emerald-500/30 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-background md:p-3"
              aria-label={Silian_t('home.hero.carouselPrevious')}
            >
              <Silian_ChevronLeft className="w-5 h-5 md:w-6 md:h-6 transition-transform group-hover:-translate-x-0.5" />
            </button>

            <button
              type="button"
              onClick={Silian_handleNext}
              className="group absolute right-4 top-1/2 z-20 -translate-y-1/2 rounded-full border border-border/60 bg-card/90 p-2 text-emerald-600 shadow-lg backdrop-blur-sm transition-all hover:scale-110 hover:bg-card hover:shadow-emerald-500/30 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-background md:p-3"
              aria-label={Silian_t('home.hero.carouselNext')}
            >
              <Silian_ChevronRight className="w-5 h-5 md:w-6 md:h-6 transition-transform group-hover:translate-x-0.5" />
            </button>
          </>
        )}

        {/* 暂停/播放按钮 */}
        {Silian_items.length > 1 && (
          <button
            type="button"
            onClick={() => Silian_setIsPaused(!Silian_isPaused)}
            className="group absolute right-4 top-4 z-20 rounded-full border border-border/60 bg-card/90 p-2 text-emerald-600 shadow-lg backdrop-blur-sm transition-all hover:scale-110 hover:bg-card hover:shadow-emerald-500/30 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-background"
            aria-label={Silian_isPaused ? Silian_t('home.hero.carouselPlay') : Silian_t('home.hero.carouselPause')}
          >
            {Silian_isPaused ? (
              <Silian_Play className="w-4 h-4 transition-transform group-hover:scale-110" />
            ) : (
              <Silian_Pause className="w-4 h-4 transition-transform group-hover:scale-110" />
            )}
          </button>
        )}
      </div>

      {/* 指示器 */}
      {Silian_items.length > 1 && (
        <div className="flex items-center justify-center gap-3 mt-6">
          {Silian_items.map((Silian__, Silian_index) => (
            <button
              key={Silian_index}
              type="button"
              onClick={() => Silian_goToSlide(Silian_index)}
              className={Silian_cn(
                "relative transition-all duration-300 rounded-full focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2",
                Silian_index === Silian_currentIndex
                  ? "w-12 h-3"
                  : "w-3 h-3 hover:scale-125"
              )}
              aria-label={Silian_t('home.hero.carouselGoTo', { index: Silian_index + 1 })}
              aria-current={Silian_index === Silian_currentIndex}
            >
              <span
                className={Silian_cn(
                  "absolute inset-0 rounded-full transition-all duration-300",
                  Silian_index === Silian_currentIndex
                    ? "bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/50"
                    : "bg-emerald-200 hover:bg-emerald-300"
                )}
              />
              {Silian_index === Silian_currentIndex && (
                <Silian_motion.span
                  layoutId="activeIndicator"
                  className="absolute inset-0 rounded-full bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-600"
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
            </button>
          ))}
        </div>
      )}

      {/* 幻灯片计数 */}
      {Silian_items.length > 1 && (
        <div className="text-center mt-4">
          <span className="text-muted-foreground text-sm font-medium">
            {Silian_currentIndex + 1} / {Silian_items.length}
          </span>
        </div>
      )}
    </div>
  );
}
