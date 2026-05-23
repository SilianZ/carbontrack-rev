import Silian_React, { Suspense as Silian_Suspense } from 'react';
import { Link as Silian_Link } from 'react-router-dom';
import { Leaf as Silian_Leaf } from 'lucide-react';
import { useTranslation as Silian_useTranslation } from '../hooks/useTranslation';
import { checkAuthStatus as Silian_checkAuthStatus } from '../lib/auth';
import { Button as Silian_Button } from '../components/ui/Button';
import Silian_FloatingActionButton from '../components/common/FloatingActionButton';
import Silian_ViewportDeferred from '../components/common/ViewportDeferred';

const Silian_HeroCarousel = Silian_React.lazy(() => import('../components/home/HeroCarousel'));
const Silian_StatsSection = Silian_React.lazy(() => import('../sections/StatsSection'));
const Silian_FeaturesSection = Silian_React.lazy(() => import('../sections/FeaturesSection'));
const Silian_HowItWorksSection = Silian_React.lazy(() => import('../sections/HowItWorksSection'));
const Silian_TrustSection = Silian_React.lazy(() => import('../sections/TrustSection'));
const Silian_AnnouncementSection = Silian_React.lazy(() => import('../sections/AnnouncementSection'));
const Silian_FeatureShowcaseSection = Silian_React.lazy(() => import('../sections/FeatureShowcaseSection'));

function Silian_SkeletonBlock({ className: Silian_className='' }) { return <div className={`animate-pulse rounded bg-muted ${Silian_className}`} />; }
function Silian_SectionSkeleton() { return (
  <div className="py-16 px-4"><div className="max-w-7xl mx-auto space-y-6">
    <Silian_SkeletonBlock className="h-8 w-1/3" />
    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
      {Array.from({length:4}).map((Silian__,Silian_i)=>(<Silian_SkeletonBlock key={Silian_i} className="h-32"/>))}
    </div>
  </div></div>
); }

function Silian_StaticHeroShowcase({ item: Silian_item }) {
  if (!Silian_item) {
    return null;
  }

  return (
    <div className="relative w-full max-w-4xl mx-auto">
      <div className="relative min-h-[280px] overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-card via-card to-secondary/35 shadow-2xl md:min-h-[320px]">
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-400 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-400 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 px-8 py-12 text-center md:px-16 md:py-16">
          <h3 className="text-2xl md:text-3xl lg:text-4xl font-bold text-emerald-600 mb-4 leading-tight">
            {Silian_item.title}
          </h3>
          <p className="text-muted-foreground mx-auto max-w-2xl text-base leading-relaxed md:text-lg lg:text-xl">
            {Silian_item.description}
          </p>
        </div>
      </div>
    </div>
  );
}

function Silian_scheduleIdleTask(Silian_callback, Silian_delayMs = 0) {
  if (typeof window === 'undefined') {
    Silian_callback();
    return () => {};
  }

  let Silian_idleHandle = null;
  const Silian_timeoutHandle = window.setTimeout(() => {
    if (typeof window.requestIdleCallback === 'function') {
      Silian_idleHandle = window.requestIdleCallback(Silian_callback, { timeout: 1500 });
      return;
    }

    Silian_callback();
  }, Silian_delayMs);

  return () => {
    window.clearTimeout(Silian_timeoutHandle);
    if (Silian_idleHandle != null && typeof window.cancelIdleCallback === 'function') {
      window.cancelIdleCallback(Silian_idleHandle);
    }
  };
}

export default function HomePage() {
  const { t: Silian_t } = Silian_useTranslation(['home']);
  const Silian_heroContainerRef = Silian_React.useRef(null);
  const [Silian_isHeroVisible, Silian_setIsHeroVisible] = Silian_React.useState(false);
  const [Silian_shouldEnhanceHero, Silian_setShouldEnhanceHero] = Silian_React.useState(false);
  const [Silian_isAuthenticated] = Silian_React.useState(() => Silian_checkAuthStatus().isAuthenticated);
  const Silian_heroHighlights = Silian_React.useMemo(() => {
    const Silian_result = Silian_t('home.hero.highlights', { returnObjects: true });
    return Array.isArray(Silian_result) ? Silian_result : [];
  }, [Silian_t]);
  const Silian_primaryHeroHighlight = Silian_heroHighlights[0] ?? null;

  Silian_React.useEffect(() => {
    const Silian_node = Silian_heroContainerRef.current;
    if (!Silian_node) {
      return undefined;
    }

    if (typeof window === 'undefined' || typeof window.IntersectionObserver !== 'function') {
      Silian_setIsHeroVisible(true);
      return undefined;
    }

    const Silian_observer = new window.IntersectionObserver(
      (Silian_entries) => {
        if (Silian_entries.some((Silian_entry) => Silian_entry.isIntersecting)) {
          Silian_setIsHeroVisible(true);
          Silian_observer.disconnect();
        }
      },
      { rootMargin: '200px 0px' }
    );

    Silian_observer.observe(Silian_node);

    return () => Silian_observer.disconnect();
  }, []);

  Silian_React.useEffect(() => {
    if (Silian_shouldEnhanceHero || !Silian_isHeroVisible || Silian_heroHighlights.length === 0) {
      return undefined;
    }

    let Silian_cancelled = false;
    const Silian_cancelIdleTask = Silian_scheduleIdleTask(() => {
      if (Silian_cancelled) {
        return;
      }

      if (typeof Silian_React.startTransition === 'function') {
        Silian_React.startTransition(() => Silian_setShouldEnhanceHero(true));
        return;
      }

      Silian_setShouldEnhanceHero(true);
    }, 1200);

    return () => {
      Silian_cancelled = true;
      Silian_cancelIdleTask();
    };
  }, [Silian_heroHighlights.length, Silian_isHeroVisible, Silian_shouldEnhanceHero]);

  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-hidden">
      {/* Ambient Glow */}
      <div className="absolute top-0 left-1/2 -z-10 h-[500px] w-[800px] -translate-x-1/2 blur-[100px] bg-gradient-to-tr from-blue-50/50 via-gray-100/50 to-transparent opacity-50 dark:from-primary/20 dark:via-primary/10 dark:opacity-20 pointer-events-none" />

      {/* Hero Section */}
      <section className="relative py-20 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <div className="mb-8">
            <Silian_Leaf className="h-16 w-16 text-primary mx-auto mb-4" />
            <h1 className="text-5xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-gray-900 to-gray-600 dark:from-white dark:to-white/60 mb-6">
              {Silian_t('home.hero.title')}
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-3xl mx-auto">
              {Silian_t('home.hero.subtitle')}
            </p>
          </div>

          {/* 新的轮播图组件 */}
          {Silian_heroHighlights.length > 0 && (
            <div className="mb-12" ref={Silian_heroContainerRef}>
              {Silian_shouldEnhanceHero ? (
                <Silian_Suspense fallback={<Silian_StaticHeroShowcase item={Silian_primaryHeroHighlight} />}>
                  <Silian_HeroCarousel items={Silian_heroHighlights} interval={5000} />
                </Silian_Suspense>
              ) : (
                <Silian_StaticHeroShowcase item={Silian_primaryHeroHighlight} />
              )}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {Silian_isAuthenticated ? (
              <>
                <Silian_Link to="/dashboard">
                  <Silian_Button size="lg" className="w-full sm:w-auto rounded-full shadow-sm hover:scale-105 transition-all duration-300">
                    {Silian_t('home.hero.goToDashboard')}
                  </Silian_Button>
                </Silian_Link>
                <Silian_Link to="/calculate">
                  <Silian_Button variant="outline" size="lg" className="w-full sm:w-auto rounded-full bg-white/5 backdrop-blur-md border-black/5 dark:border-white/10 hover:scale-105 transition-all duration-300">
                    {Silian_t('home.hero.recordActivity')}
                  </Silian_Button>
                </Silian_Link>
              </>
            ) : (
              <>
                <Silian_Link to="/auth/register">
                  <Silian_Button size="lg" className="w-full sm:w-auto rounded-full shadow-sm hover:scale-105 transition-all duration-300">
                    {Silian_t('home.hero.getStarted')}
                  </Silian_Button>
                </Silian_Link>
                <Silian_Link to="/auth/login">
                  <Silian_Button variant="outline" size="lg" className="w-full sm:w-auto rounded-full bg-white/5 backdrop-blur-md border-black/5 dark:border-white/10 hover:scale-105 transition-all duration-300">
                    {Silian_t('home.hero.signIn')}
                  </Silian_Button>
                </Silian_Link>
              </>
            )}
          </div>
        </div>
      </section>

      <Silian_ViewportDeferred fallback={<Silian_SectionSkeleton />}>
        <Silian_Suspense fallback={<Silian_SectionSkeleton />}>
          <Silian_StatsSection />
        </Silian_Suspense>
      </Silian_ViewportDeferred>

      <Silian_ViewportDeferred fallback={<Silian_SectionSkeleton />}>
        <Silian_Suspense fallback={<Silian_SectionSkeleton />}>
          <Silian_AnnouncementSection />
        </Silian_Suspense>
      </Silian_ViewportDeferred>

      <Silian_ViewportDeferred fallback={<Silian_SectionSkeleton />}>
        <Silian_Suspense fallback={<Silian_SectionSkeleton />}>
          <Silian_FeatureShowcaseSection />
        </Silian_Suspense>
      </Silian_ViewportDeferred>

      <Silian_ViewportDeferred fallback={<Silian_SectionSkeleton />}>
        <Silian_Suspense fallback={<Silian_SectionSkeleton />}>
          <Silian_FeaturesSection />
        </Silian_Suspense>
      </Silian_ViewportDeferred>

      <Silian_ViewportDeferred fallback={<Silian_SectionSkeleton />}>
        <Silian_Suspense fallback={<Silian_SectionSkeleton />}>
          <Silian_HowItWorksSection />
        </Silian_Suspense>
      </Silian_ViewportDeferred>

      {/* CTA Section */}
      <section className="py-24 px-4 relative overflow-hidden">
        {/* CTA Glow */}
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-transparent to-primary/5 dark:to-primary/10 pointer-events-none" />
        <div className="max-w-4xl mx-auto text-center bg-card text-card-foreground border border-black/5 dark:border-white/10 dark:bg-white/5 dark:backdrop-blur-md rounded-3xl p-12 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none">
          <h2 className="text-3xl font-bold tracking-tight mb-4 bg-clip-text text-transparent bg-gradient-to-br from-gray-900 to-gray-600 dark:from-white dark:to-white/60">
            {Silian_t('home.cta.title')}
          </h2>
          <p className="text-xl text-muted-foreground mb-8">
            {Silian_t('home.cta.subtitle')}
          </p>

          {!Silian_isAuthenticated && (
            <Silian_Link to="/auth/register">
              <Silian_Button size="lg" className="rounded-full shadow-sm hover:scale-105 transition-all duration-300">
                {Silian_t('home.cta.joinNow')}
              </Silian_Button>
            </Silian_Link>
          )}
        </div>
      </section>

      <Silian_ViewportDeferred fallback={<Silian_SectionSkeleton />}>
        <Silian_Suspense fallback={<Silian_SectionSkeleton />}>
          <Silian_TrustSection />
        </Silian_Suspense>
      </Silian_ViewportDeferred>

      <Silian_FloatingActionButton />
    </div>
  );
}
