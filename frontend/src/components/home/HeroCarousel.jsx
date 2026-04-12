/* eslint-disable no-unused-vars */
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { cn } from '@/lib/utils';
/* eslint-enable no-unused-vars */

/**
 * 现代化的Hero区域轮播图组件
 * 支持自动播放、手动控制、暂停等功能
 */
export default function HeroCarousel({ items = [], interval = 5000, className }) {
  const { t } = useTranslation(['home']);
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [isPaused, setIsPaused] = React.useState(false);
  const [direction, setDirection] = React.useState(0);

  const handlePrevious = React.useCallback(() => {
    setDirection(-1);
    setCurrentIndex((prev) => (prev - 1 + items.length) % items.length);
  }, [items.length]);

  const handleNext = React.useCallback(() => {
    setDirection(1);
    setCurrentIndex((prev) => (prev + 1) % items.length);
  }, [items.length]);

  const goToSlide = React.useCallback((index) => {
    setDirection(index > currentIndex ? 1 : -1);
    setCurrentIndex(index);
  }, [currentIndex]);

  // 自动播放逻辑
  React.useEffect(() => {
    if (!items.length || isPaused) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setDirection(1);
      setCurrentIndex((prev) => (prev + 1) % items.length);
    }, interval);

    return () => window.clearInterval(timer);
  }, [items.length, interval, isPaused]);

  // 键盘导航
  React.useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowLeft') {
        handlePrevious();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePrevious, handleNext]);

  if (!items || items.length === 0) {
    return null;
  }

  const currentItem = items[currentIndex];

  const slideVariants = {
    enter: (direction) => ({
      x: direction > 0 ? 1000 : -1000,
      opacity: 0,
      scale: 0.8,
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1,
      scale: 1,
    },
    exit: (direction) => ({
      zIndex: 0,
      x: direction < 0 ? 1000 : -1000,
      opacity: 0,
      scale: 0.8,
    }),
  };

  return (
    <div 
      className={cn("relative w-full max-w-4xl mx-auto", className)}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* 主要内容区 */}
      <div className="relative min-h-[280px] overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-card via-card to-secondary/35 shadow-2xl md:min-h-[320px]">
        <AnimatePresence initial={false} custom={direction} mode="wait">
          <motion.div
            key={currentIndex}
            custom={direction}
            variants={slideVariants}
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
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.1, duration: 0.5 }}
              >
                <h3 className="text-2xl md:text-3xl lg:text-4xl font-bold text-emerald-600 mb-4 leading-tight">
                  {currentItem.title}
                </h3>
              </motion.div>

              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.5 }}
              >
                <p className="text-muted-foreground mx-auto max-w-2xl text-base leading-relaxed md:text-lg lg:text-xl">
                  {currentItem.description}
                </p>
              </motion.div>
            </div>
          </motion.div>
        </AnimatePresence>
        
        {/* 进度条 - 固定在容器底部，不参与动画 */}
        <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-100 via-emerald-200 to-emerald-100 rounded-b-3xl overflow-hidden">
          {!isPaused && (
            <motion.div
              className="h-full bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-600 shadow-lg relative"
              initial={{ width: "0%" }}
              animate={{ width: "100%" }}
              transition={{ duration: interval / 1000, ease: "linear" }}
              key={`progress-${currentIndex}`}
            >
              {/* 发光效果 */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-shimmer" />
            </motion.div>
          )}
        </div>

        {/* 左右导航按钮 */}
        {items.length > 1 && (
          <>
            <button
              type="button"
              onClick={handlePrevious}
              className="group absolute left-4 top-1/2 z-20 -translate-y-1/2 rounded-full border border-border/60 bg-card/90 p-2 text-emerald-600 shadow-lg backdrop-blur-sm transition-all hover:scale-110 hover:bg-card hover:shadow-emerald-500/30 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-background md:p-3"
              aria-label={t('home.hero.carouselPrevious')}
            >
              <ChevronLeft className="w-5 h-5 md:w-6 md:h-6 transition-transform group-hover:-translate-x-0.5" />
            </button>

            <button
              type="button"
              onClick={handleNext}
              className="group absolute right-4 top-1/2 z-20 -translate-y-1/2 rounded-full border border-border/60 bg-card/90 p-2 text-emerald-600 shadow-lg backdrop-blur-sm transition-all hover:scale-110 hover:bg-card hover:shadow-emerald-500/30 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-background md:p-3"
              aria-label={t('home.hero.carouselNext')}
            >
              <ChevronRight className="w-5 h-5 md:w-6 md:h-6 transition-transform group-hover:translate-x-0.5" />
            </button>
          </>
        )}

        {/* 暂停/播放按钮 */}
        {items.length > 1 && (
          <button
            type="button"
            onClick={() => setIsPaused(!isPaused)}
            className="group absolute right-4 top-4 z-20 rounded-full border border-border/60 bg-card/90 p-2 text-emerald-600 shadow-lg backdrop-blur-sm transition-all hover:scale-110 hover:bg-card hover:shadow-emerald-500/30 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-background"
            aria-label={isPaused ? t('home.hero.carouselPlay') : t('home.hero.carouselPause')}
          >
            {isPaused ? (
              <Play className="w-4 h-4 transition-transform group-hover:scale-110" />
            ) : (
              <Pause className="w-4 h-4 transition-transform group-hover:scale-110" />
            )}
          </button>
        )}
      </div>

      {/* 指示器 */}
      {items.length > 1 && (
        <div className="flex items-center justify-center gap-3 mt-6">
          {items.map((_, index) => (
            <button
              key={index}
              type="button"
              onClick={() => goToSlide(index)}
              className={cn(
                "relative transition-all duration-300 rounded-full focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2",
                index === currentIndex
                  ? "w-12 h-3"
                  : "w-3 h-3 hover:scale-125"
              )}
              aria-label={t('home.hero.carouselGoTo', { index: index + 1 })}
              aria-current={index === currentIndex}
            >
              <span
                className={cn(
                  "absolute inset-0 rounded-full transition-all duration-300",
                  index === currentIndex
                    ? "bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/50"
                    : "bg-emerald-200 hover:bg-emerald-300"
                )}
              />
              {index === currentIndex && (
                <motion.span
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
      {items.length > 1 && (
        <div className="text-center mt-4">
          <span className="text-muted-foreground text-sm font-medium">
            {currentIndex + 1} / {items.length}
          </span>
        </div>
      )}
    </div>
  );
}
