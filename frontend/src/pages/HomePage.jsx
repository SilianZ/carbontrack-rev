import React, { Suspense } from 'react';
import { Link } from 'react-router-dom';
import { Leaf } from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';
import { checkAuthStatus } from '../lib/auth';
import { Button } from '../components/ui/Button';
import FloatingActionButton from '../components/common/FloatingActionButton';
import HeroCarousel from '../components/home/HeroCarousel';

const StatsSection = React.lazy(() => import('../sections/StatsSection'));
const FeaturesSection = React.lazy(() => import('../sections/FeaturesSection'));
const HowItWorksSection = React.lazy(() => import('../sections/HowItWorksSection'));
const TrustSection = React.lazy(() => import('../sections/TrustSection'));
const AnnouncementSection = React.lazy(() => import('../sections/AnnouncementSection'));
const FeatureShowcaseSection = React.lazy(() => import('../sections/FeatureShowcaseSection'));

function SkeletonBlock({ className='' }) { return <div className={`animate-pulse rounded bg-muted ${className}`} />; }
function SectionSkeleton() { return (
  <div className="py-16 px-4"><div className="max-w-7xl mx-auto space-y-6">
    <SkeletonBlock className="h-8 w-1/3" />
    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
      {Array.from({length:4}).map((_,i)=>(<SkeletonBlock key={i} className="h-32"/>))}
    </div>
  </div></div>
); }

export default function HomePage() {
  const { t } = useTranslation();
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);
  const heroHighlights = t('home.hero.highlights', { returnObjects: true }) || [];

  React.useEffect(() => {
    const checkAuth = async () => {
      const authStatus = await checkAuthStatus();
      setIsAuthenticated(authStatus.isAuthenticated);
    };
    checkAuth();
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-hidden">
      {/* Ambient Glow */}
      <div className="absolute top-0 left-1/2 -z-10 h-[500px] w-[800px] -translate-x-1/2 blur-[100px] bg-gradient-to-tr from-blue-50/50 via-gray-100/50 to-transparent opacity-50 dark:from-primary/20 dark:via-primary/10 dark:opacity-20 pointer-events-none" />

      {/* Hero Section */}
      <section className="relative py-20 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <div className="mb-8">
            <Leaf className="h-16 w-16 text-primary mx-auto mb-4" />
            <h1 className="text-5xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-gray-900 to-gray-600 dark:from-white dark:to-white/60 mb-6">
              {t('home.hero.title')}
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-3xl mx-auto">
              {t('home.hero.subtitle')}
            </p>
          </div>
          
          {/* 新的轮播图组件 */}
          {heroHighlights.length > 0 && (
            <div className="mb-12">
              <HeroCarousel items={heroHighlights} interval={5000} />
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {isAuthenticated ? (
              <>
                <Link to="/dashboard">
                  <Button size="lg" className="w-full sm:w-auto rounded-full shadow-sm hover:scale-105 transition-all duration-300">
                    {t('home.hero.goToDashboard')}
                  </Button>
                </Link>
                <Link to="/calculate">
                  <Button variant="outline" size="lg" className="w-full sm:w-auto rounded-full bg-white/5 backdrop-blur-md border-black/5 dark:border-white/10 hover:scale-105 transition-all duration-300">
                    {t('home.hero.recordActivity')}
                  </Button>
                </Link>
              </>
            ) : (
              <>
                <Link to="/auth/register">
                  <Button size="lg" className="w-full sm:w-auto rounded-full shadow-sm hover:scale-105 transition-all duration-300">
                    {t('home.hero.getStarted')}
                  </Button>
                </Link>
                <Link to="/auth/login">
                  <Button variant="outline" size="lg" className="w-full sm:w-auto rounded-full bg-white/5 backdrop-blur-md border-black/5 dark:border-white/10 hover:scale-105 transition-all duration-300">
                    {t('home.hero.signIn')}
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      <Suspense fallback={<SectionSkeleton />}>
        <StatsSection />
      </Suspense>

      <Suspense fallback={<SectionSkeleton />}>
        <AnnouncementSection />
      </Suspense>

      <Suspense fallback={<SectionSkeleton />}>
        <FeatureShowcaseSection />
      </Suspense>

      <Suspense fallback={<SectionSkeleton />}>
        <FeaturesSection />
      </Suspense>

      <Suspense fallback={<SectionSkeleton />}>
        <HowItWorksSection />
      </Suspense>

      {/* CTA Section */}
      <section className="py-24 px-4 relative overflow-hidden">
        {/* CTA Glow */}
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-transparent to-primary/5 dark:to-primary/10 pointer-events-none" />
        <div className="max-w-4xl mx-auto text-center bg-card text-card-foreground border border-black/5 dark:border-white/10 dark:bg-white/5 dark:backdrop-blur-md rounded-3xl p-12 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none">
          <h2 className="text-3xl font-bold tracking-tight mb-4 bg-clip-text text-transparent bg-gradient-to-br from-gray-900 to-gray-600 dark:from-white dark:to-white/60">
            {t('home.cta.title')}
          </h2>
          <p className="text-xl text-muted-foreground mb-8">
            {t('home.cta.subtitle')}
          </p>
          
          {!isAuthenticated && (
            <Link to="/auth/register">
              <Button size="lg" className="rounded-full shadow-sm hover:scale-105 transition-all duration-300">
                {t('home.cta.joinNow')}
              </Button>
            </Link>
          )}
        </div>
      </section>

      <Suspense fallback={<SectionSkeleton />}>
        <TrustSection />
      </Suspense>

      <FloatingActionButton />
    </div>
  );
}
