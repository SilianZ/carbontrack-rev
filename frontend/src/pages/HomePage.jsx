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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.16),_transparent_45%),linear-gradient(180deg,var(--background),color-mix(in_oklab,var(--background)_88%,var(--secondary)))] text-foreground">
      {/* Hero Section */}
      <section className="relative py-20 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <div className="mb-8">
            <Leaf className="h-16 w-16 text-green-600 mx-auto mb-4" />
            <h1 className="text-5xl font-bold mb-6">
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
                  <Button size="lg" className="w-full sm:w-auto">
                    {t('home.hero.goToDashboard')}
                  </Button>
                </Link>
                <Link to="/calculate">
                  <Button variant="outline" size="lg" className="w-full sm:w-auto">
                    {t('home.hero.recordActivity')}
                  </Button>
                </Link>
              </>
            ) : (
              <>
                <Link to="/auth/register">
                  <Button size="lg" className="w-full sm:w-auto">
                    {t('home.hero.getStarted')}
                  </Button>
                </Link>
                <Link to="/auth/login">
                  <Button variant="outline" size="lg" className="w-full sm:w-auto">
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
      <section className="py-20 px-4 bg-green-600 text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">
            {t('home.cta.title')}
          </h2>
          <p className="text-xl text-green-100 mb-8">
            {t('home.cta.subtitle')}
          </p>
          
          {!isAuthenticated && (
            <Link to="/auth/register">
              <Button size="lg" variant="secondary">
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
