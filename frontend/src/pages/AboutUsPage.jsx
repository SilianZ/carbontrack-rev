import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Mail, Instagram, MessagesSquare, Handshake, ArrowUpRight, Github } from 'lucide-react';
import { m, useInView, useScroll, useTransform, useSpring, useReducedMotion, LazyMotion, MotionConfig, domAnimation } from 'framer-motion';
const __FM_USED = m;
import { useQuery } from 'react-query';
import { useTranslation } from '../hooks/useTranslation';
import { buttonVariants } from '../components/ui/button-variants';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { cn } from '../lib/utils';
import { statsAPI } from '../lib/api';

const CONTACT_ICON_MAP = {
  email: Mail,
  instagram: Instagram,
  discord: MessagesSquare,
  partnership: Handshake,
};

const DEFAULT_ICON = ArrowUpRight;
const numberFormatter = new Intl.NumberFormat();
const carbonFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
const GITHUB_HOSTS = new Set(['github.com', 'www.github.com']);

function useIsMobileViewport() {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return false;
    }

    return window.matchMedia('(max-width: 767px)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return undefined;
    }

    const mediaQuery = window.matchMedia('(max-width: 767px)');
    const handleChange = (event) => {
      setIsMobile(event.matches);
    };

    setIsMobile(mediaQuery.matches);

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }

    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, []);

  return isMobile;
}

const formatNumber = (value) => numberFormatter.format(Math.max(0, Math.round(value || 0)));
const formatCarbon = (value, t) => {
  const numericValue = Number(value || 0);
  if (numericValue >= 1000) {
    return `${carbonFormatter.format(numericValue / 1000)} ${t('units.t')}`;
  }
  return `${carbonFormatter.format(numericValue)} ${t('units.kg')}`;
};

const isGithubProfileLink = (value) => {
  if (typeof value !== 'string' || value.trim() === '') {
    return false;
  }

  try {
    const { hostname } = new URL(value);
    return GITHUB_HOSTS.has(hostname.toLowerCase());
  } catch {
    return false;
  }
};

// Timeline Card Component with Apple-style animations (memoized for perf)
const TimelineCard = React.memo(({ member, index, isLeft, t, isMobileViewport }) => {
  const cardRef = useRef(null);
  const isGithubLink = isGithubProfileLink(member.link);
  const isInView = useInView(cardRef, {
    once: false,
    margin: "-100px",
    amount: 0.4
  });

  const prefersReducedMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: cardRef,
    offset: ["start end", "center center"]
  });

  // Transform values (with reduced-motion friendly ranges)
  const yRaw = useTransform(scrollYProgress, [0, 0.5, 1], [prefersReducedMotion ? 20 : 80, 0, prefersReducedMotion ? -20 : -80]);
  const rotateYRaw = useTransform(
    scrollYProgress,
    [0, 0.5, 1],
    [
      prefersReducedMotion ? 0 : (isLeft ? 25 : -25),
      0,
      prefersReducedMotion ? 0 : (isLeft ? -12 : 12),
    ]
  );
  const opacityRaw = useTransform(scrollYProgress, [0, 0.2, 0.5, 0.8, 1], [0, 1, 1, 1, prefersReducedMotion ? 1 : 0.3]);
  const scaleRaw = useTransform(scrollYProgress, [0, 0.5, 1], [prefersReducedMotion ? 1 : 0.9, 1.04, prefersReducedMotion ? 1 : 0.97]);

  // Springs for smoother motion (less jank on scroll)
  const y = useSpring(yRaw, { stiffness: 80, damping: 15, mass: 0.8 });
  const rotateY = useSpring(rotateYRaw, { stiffness: 100, damping: 18, mass: 0.9 });
  const opacity = useSpring(opacityRaw, { stiffness: 150, damping: 20 });
  const scale = useSpring(scaleRaw, { stiffness: 150, damping: 15 });
  const motionStyle = isMobileViewport
    ? {
        opacity,
        y,
        willChange: 'transform, opacity',
      }
    : {
        y,
        opacity,
        scale,
        willChange: 'transform, opacity',
      };
  const motionInitial = isMobileViewport
    ? { opacity: 0, y: 24 }
    : { opacity: 0, x: isLeft ? -100 : 100, rotateY: isLeft ? 30 : -30 };
  const motionAnimate = isMobileViewport
    ? { opacity: 1, y: 0 }
    : {
        opacity: 1,
        x: 0,
        rotateY: 0,
      };
  const motionExit = isMobileViewport
    ? { opacity: 0, y: -16 }
    : {
        opacity: 0,
        x: isLeft ? -100 : 100,
        rotateY: isLeft ? 30 : -30,
      };

  return (
    <div
      ref={cardRef}
      className={cn(
        "relative grid gap-8 items-center",
        isMobileViewport ? "grid-cols-1" : "md:grid-cols-2",
        !isMobileViewport && (isLeft ? "md:pr-12" : "md:pl-12")
      )}
    >
      {/* Timeline Dot (Syncs with card appearance) */}
      <m.div
        className="hidden md:block absolute left-1/2 top-1/2 w-4 h-4 rounded-full bg-gradient-to-r from-green-500 to-blue-500 shadow-lg z-10"
        style={{ x: "-50%", y: "-50%" }}
        initial={{ scale: 0, opacity: 0 }}
        animate={isInView ? { scale: [0, 1.2, 1], opacity: 1 } : { scale: 0, opacity: 0 }}
        transition={{
          duration: 0.5,
          delay: index * 0.1,
          ease: [0.22, 1, 0.36, 1]
        }}
      >
        <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-green-500/20 to-blue-500/20" />
      </m.div>
      {/* Card positioned on alternating sides */}
      <m.div
        className={cn(
          "relative min-w-0",
          isMobileViewport ? "text-left" : (isLeft ? "md:col-start-1 md:text-right" : "md:col-start-2")
        )}
        style={motionStyle}
        initial={motionInitial}
        animate={isInView ? motionAnimate : motionExit}
        transition={{
          duration: 0.6,
          delay: index * 0.1,
          ease: [0.22, 1, 0.36, 1]
        }}
      >
        <m.div
          style={{
            rotateY,
            transformStyle: "preserve-3d",
            backfaceVisibility: 'hidden',
            willChange: 'transform'
          }}
          animate={isMobileViewport ? {
            opacity: isInView ? 1 : 0.98,
            transition: {
              duration: 0.4,
              delay: index * 0.08 + 0.1,
              ease: [0.22, 1, 0.36, 1]
            }
          } : (isInView ? {
            rotateY: prefersReducedMotion ? 0 : [isLeft ? 12 : -12, 0, isLeft ? -3 : 3, 0],
            scale: prefersReducedMotion ? 1 : [0.98, 1.01, 1],
            transition: {
              duration: 0.8,
              delay: index * 0.1 + 0.15,
              ease: [0.22, 1, 0.36, 1]
            }
          } : {})}
          whileHover={isMobileViewport ? undefined : {
            scale: 1.01,
            rotateY: prefersReducedMotion ? 0 : (isLeft ? -3 : 3),
            z: 50,
            transition: {
              duration: 0.4,
              ease: [0.22, 1, 0.36, 1]
            }
          }}
        >
          <Card
            className="group relative w-full overflow-hidden border border-border/60 bg-card/85 backdrop-blur-xl shadow-2xl hover:shadow-3xl transition-all duration-500"
            style={{
              transformStyle: "preserve-3d",
              transform: "translateZ(0)",
              willChange: 'transform, opacity'
            }}
          >
            {/* Gradient Overlay */}
            <m.div
              className="absolute inset-0 bg-gradient-to-br from-green-500/5 via-blue-500/5 to-purple-500/5"
              initial={{ opacity: 0 }}
              animate={isInView ? { opacity: [0, 0.5, 1, 0.7] } : { opacity: 0 }}
              transition={{
                duration: 1.0,
                delay: index * 0.1 + 0.2,
                ease: [0.22, 1, 0.36, 1]
              }}
            />

            {/* Animated Border */}
            <m.div
              className="absolute inset-0 rounded-lg"
              style={{
                background: "linear-gradient(90deg, #10b981, #3b82f6, #8b5cf6)",
                padding: "2px",
              }}
              initial={{ opacity: 0 }}
              animate={isInView ? {
                opacity: [0, 0, 0.8, 0.5],
              } : { opacity: 0 }}
              transition={{
                duration: 0.8,
                delay: index * 0.1 + 0.3,
                ease: [0.22, 1, 0.36, 1]
              }}
              whileHover={{ opacity: 1 }}
            >
              <div className="h-full w-full rounded-lg bg-card" />
            </m.div>

            <div className="relative" style={{ transform: "translateZ(50px)" }}>
              <CardHeader className="pb-4">
                <m.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={isInView ? { opacity: 1, y: 0 } : {}}
                  transition={{
                    duration: 0.4,
                    delay: index * 0.1 + 0.1,
                    ease: [0.22, 1, 0.36, 1]
                  }}
                >
                  <CardTitle className="mb-2 break-words text-balance text-2xl font-bold text-foreground md:text-3xl">
                    {member.name}
                  </CardTitle>
                  {member.role && (
                    <CardDescription className="break-words bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-base font-semibold text-transparent md:text-lg">
                      {member.role}
                    </CardDescription>
                  )}
                </m.div>
              </CardHeader>

              <CardContent className="text-muted-foreground space-y-4">
                <m.p
                  className="break-words leading-relaxed text-base md:text-lg"
                  initial={{ opacity: 0, y: 20 }}
                  animate={isInView ? { opacity: 1, y: 0 } : {}}
                  transition={{
                    duration: 0.4,
                    delay: index * 0.1 + 0.15,
                    ease: [0.22, 1, 0.36, 1]
                  }}
                >
                  {member.bio}
                </m.p>

                {member.link && (
                  <m.a
                    href={member.link}
                    target="_blank"
                    rel="noreferrer"
                    className={cn(
                      buttonVariants({
                        size: 'lg',
                        className: isGithubLink
                          ? 'w-full justify-center bg-[#24292e] text-white border-none shadow-lg hover:bg-[#2f363d] hover:shadow-xl hover:shadow-gray-900/20 overflow-hidden relative'
                          : 'w-full justify-center bg-gradient-to-r from-green-500 to-blue-500 text-white border-none shadow-lg hover:shadow-xl group-hover:from-green-600 group-hover:to-blue-600',
                      })
                    )}
                    initial={{ opacity: 0, y: 20 }}
                    animate={isInView ? { opacity: 1, y: 0 } : {}}
                    transition={{
                      duration: 0.4,
                      delay: index * 0.1 + 0.2,
                      ease: [0.22, 1, 0.36, 1]
                    }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {isGithubLink && (
                      <m.div
                        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-[-20deg]"
                        initial={{ x: '-150%' }}
                        whileHover={{ x: '150%' }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                      />
                    )}
                    <span className="mr-2 relative z-10">
                      {member.linkLabel || t('about.team.learnMore')}
                    </span>
                    {isGithubLink ? (
                      <Github className="h-5 w-5 transition-transform group-hover:rotate-12 relative z-10" />
                    ) : (
                      <ArrowUpRight className="h-5 w-5 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1 relative z-10" />
                    )}
                  </m.a>
                )}
              </CardContent>
            </div>
          </Card>
        </m.div>

        {/* Decorative Elements */}
        <m.div
          className="absolute -z-10 inset-0 bg-gradient-to-br from-green-200/30 to-blue-200/30 blur-3xl rounded-full"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={isInView ? { opacity: 1, scale: 1 } : {}}
          transition={{
            duration: 0.6,
            delay: index * 0.1 + 0.25,
            ease: [0.22, 1, 0.36, 1]
          }}
        />
      </m.div>
    </div>
  );
});

const AboutUsPage = () => {
  const { t } = useTranslation(['about', 'achievements', 'units']);
  const isMobileViewport = useIsMobileViewport();

  const { data: summaryData } = useQuery(
    ['public-stats-summary'],
    async () => {
      const response = await statsAPI.getPublicSummary();
      return response.data?.data ?? null;
    },
    {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    }
  );
  const hero = t('about.hero', { returnObjects: true }) || {};
  const contactLinks = t('about.contactLinks', { returnObjects: true, email: import.meta.env.VITE_SUPPORT_EMAIL }) || [];
  const team = t('about.team', { returnObjects: true }) || {};
  const mission = t('about.mission', { returnObjects: true }) || {};
  const achievements = t('about.achievements', { returnObjects: true }) || {};
  const specialThanks = t('about.specialThanks', { returnObjects: true }) || {};

  const groupedMembers = useMemo(() => {
    if (!Array.isArray(team?.members)) {
      return [];
    }
    return team.members;
  }, [team?.members]);

  const achievementStats = useMemo(() => {
    if (!Array.isArray(achievements?.stats)) {
      return [];
    }

    if (!summaryData) {
      return achievements.stats;
    }

    return achievements.stats.map((stat, index) => {
      const enriched = { ...stat };
      if (index === 0) {
        enriched.value = formatCarbon(summaryData.total_carbon_saved ?? 0, t);
      } else if (index === 1) {
        enriched.value = formatNumber(summaryData.total_users ?? 0);
      } else if (index === 2) {
        enriched.value = formatNumber(summaryData.total_records ?? 0);
      }
      return enriched;
    });
  }, [achievements?.stats, summaryData, t]);

  return (
    <LazyMotion features={domAnimation}>
      <MotionConfig reducedMotion="user" transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}>
        <div className="relative overflow-x-clip text-foreground">
          <div className="absolute inset-0 -z-10 bg-gradient-to-br from-background via-background to-secondary/30" />
          <div className="absolute top-10 right-10 h-72 w-72 rounded-full bg-green-500/15 blur-3xl -z-10" />
          <div className="absolute bottom-10 left-10 h-72 w-72 rounded-full bg-blue-500/15 blur-3xl -z-10" />

          <header className="relative px-4 py-24">
            <div className="max-w-5xl mx-auto text-center">
              <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
                {hero.title || 'About CarbonTrack'}
              </h1>
              {hero.subtitle && (
                <p className="text-lg md:text-xl text-muted-foreground leading-relaxed mb-8">
                  {hero.subtitle}
                </p>
              )}

              <div className="flex flex-wrap justify-center gap-4">
                {contactLinks.map((item) => {
                  const Icon = CONTACT_ICON_MAP[item.type] || DEFAULT_ICON;
                  return (
                    <a
                      key={`${item.type}-${item.href}`}
                      className={cn(
                        buttonVariants({
                          size: 'lg',
                          className:
                            'bg-gradient-to-r from-green-500 to-blue-500 text-white border-none shadow-lg hover:from-green-600 hover:to-blue-600 hover:shadow-xl',
                        }),
                        'justify-center'
                      )}
                      href={item.href}
                      target={item.external ? '_blank' : undefined}
                      rel={item.external ? 'noreferrer' : undefined}
                    >
                      <Icon className="h-5 w-5 mr-2" />
                      {item.label}
                    </a>
                  );
                })}
              </div>
            </div>
          </header>

          <main className="px-4 pb-24 space-y-20">
            <section className="max-w-7xl mx-auto">
              <m.div
                className="mb-16 text-center"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              >
                  <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
                  {team?.title || 'Our Team'}
                </h2>
                {team?.intro && (
                  <p className="text-lg text-muted-foreground max-w-3xl mx-auto leading-relaxed">
                    {team.intro}
                  </p>
                )}
              </m.div>

              {/* Timeline Container */}
              <div className="relative">
                {/* Central Timeline Line */}
                <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-green-400 via-blue-400 to-purple-400 transform -translate-x-1/2" />



                {/* Timeline Items */}
                <div className="space-y-24 md:space-y-32">
                  {groupedMembers.map((member, index) => (
                    <TimelineCard
                      key={member.name}
                      member={member}
                      index={index}
                      isLeft={index % 2 === 0}
                      isMobileViewport={isMobileViewport}
                      t={t}
                    />
                  ))}
                </div>
              </div>
            </section>

            <section className="max-w-5xl mx-auto">
              <Card className="border border-border/60 bg-card/80 backdrop-blur shadow-lg shadow-blue-950/10">
                <CardHeader>
                  <CardTitle className="text-3xl text-foreground">
                    {mission?.title || 'Our Mission'}
                  </CardTitle>
                  {mission?.description && (
                    <CardDescription className="text-base text-muted-foreground">
                      {mission.description}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-3">
                    {(mission?.items || []).map((item) => (
                      <li key={item} className="flex items-start gap-3">
                        <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-gradient-to-r from-green-500 to-blue-500" />
                        <span className="text-muted-foreground leading-relaxed">{item}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </section>

            <section className="max-w-6xl mx-auto">
              <div className="mb-10 text-center">
                <h2 className="text-3xl font-semibold text-foreground mb-4">
                  {achievements?.title || 'Our Achievements'}
                </h2>
                {achievements?.description && (
                  <p className="text-muted-foreground max-w-3xl mx-auto">
                    {achievements.description}
                  </p>
                )}
              </div>
              <div className="grid gap-6 md:grid-cols-3">
                {achievementStats.map((stat) => (
                  <Card
                    key={stat.label}
                    className="border border-border/60 bg-card/80 backdrop-blur shadow-lg shadow-purple-950/10 hover:shadow-xl transition-shadow duration-300"
                  >
                    <CardHeader>
                      <CardTitle className="text-xl text-foreground">{stat.label}</CardTitle>
                      {stat.highlight && (
                        <CardDescription className="text-green-600 font-semibold">
                          {stat.highlight}
                        </CardDescription>
                      )}
                    </CardHeader>
                    <CardContent>
                      {stat.value && (
                        <div className="text-3xl font-bold text-foreground mb-4">
                          {stat.value}
                        </div>
                      )}
                      {stat.description && (
                        <p className="text-muted-foreground leading-relaxed">
                          {stat.description}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>

            <section className="max-w-4xl mx-auto">
              <Card className="bg-gradient-to-r from-pink-500 to-orange-400 text-white border-none shadow-2xl">
                <CardHeader>
                  <CardTitle className="text-3xl">
                    {specialThanks?.title || 'Special Thanks'}
                  </CardTitle>
                  {specialThanks?.subtitle && (
                    <CardDescription className="text-white/80 text-base">
                      {specialThanks.subtitle}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  {specialThanks?.description && (
                    <p className="text-white/90 leading-relaxed">
                      {specialThanks.description}
                    </p>
                  )}
                  {specialThanks?.link && (
                    <a
                      href={specialThanks.link}
                      target="_blank"
                      rel="noreferrer"
                      className={cn(
                        buttonVariants({
                          variant: 'secondary',
                          className:
                            'border border-white/25 bg-white/12 text-white shadow-sm shadow-black/20 hover:bg-white/20 justify-center',
                        })
                      )}
                    >
                      {specialThanks.linkLabel || t('about.specialThanks.visit')}
                    </a>
                  )}
                </CardContent>
              </Card>
            </section>
          </main>
        </div>
      </MotionConfig>
    </LazyMotion>
  );
};

export default AboutUsPage;
