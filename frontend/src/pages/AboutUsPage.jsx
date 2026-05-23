import Silian_React, { useEffect as Silian_useEffect, useMemo as Silian_useMemo, useRef as Silian_useRef, useState as Silian_useState } from 'react';
import { Mail as Silian_Mail, Instagram as Silian_Instagram, MessagesSquare as Silian_MessagesSquare, Handshake as Silian_Handshake, ArrowUpRight as Silian_ArrowUpRight, Github as Silian_Github } from 'lucide-react';
import { m as Silian_m, useInView as Silian_useInView, useScroll as Silian_useScroll, useTransform as Silian_useTransform, useSpring as Silian_useSpring, useReducedMotion as Silian_useReducedMotion, LazyMotion as Silian_LazyMotion, MotionConfig as Silian_MotionConfig, domAnimation as Silian_domAnimation } from 'framer-motion';
const Silian___FM_USED = Silian_m;
import { useQuery as Silian_useQuery } from 'react-query';
import { useTranslation as Silian_useTranslation } from '../hooks/useTranslation';
import { buttonVariants as Silian_buttonVariants } from '../components/ui/button-variants';
import { Card as Silian_Card, CardContent as Silian_CardContent, CardHeader as Silian_CardHeader, CardTitle as Silian_CardTitle, CardDescription as Silian_CardDescription } from '../components/ui/Card';
import { cn as Silian_cn } from '../lib/utils';
import { statsAPI as Silian_statsAPI } from '../lib/api';

const Silian_CONTACT_ICON_MAP = {
  email: Silian_Mail,
  instagram: Silian_Instagram,
  discord: Silian_MessagesSquare,
  partnership: Silian_Handshake,
};

const Silian_DEFAULT_ICON = Silian_ArrowUpRight;
const Silian_numberFormatter = new Intl.NumberFormat();
const Silian_carbonFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
const Silian_GITHUB_HOSTS = new Set(['github.com', 'www.github.com']);

function Silian_useIsMobileViewport() {
  const [Silian_isMobile, Silian_setIsMobile] = Silian_useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return false;
    }

    return window.matchMedia('(max-width: 767px)').matches;
  });

  Silian_useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return undefined;
    }

    const Silian_mediaQuery = window.matchMedia('(max-width: 767px)');
    const Silian_handleChange = (Silian_event) => {
      Silian_setIsMobile(Silian_event.matches);
    };

    Silian_setIsMobile(Silian_mediaQuery.matches);

    if (typeof Silian_mediaQuery.addEventListener === 'function') {
      Silian_mediaQuery.addEventListener('change', Silian_handleChange);
      return () => Silian_mediaQuery.removeEventListener('change', Silian_handleChange);
    }

    Silian_mediaQuery.addListener(Silian_handleChange);
    return () => Silian_mediaQuery.removeListener(Silian_handleChange);
  }, []);

  return Silian_isMobile;
}

const Silian_formatNumber = (Silian_value) => Silian_numberFormatter.format(Math.max(0, Math.round(Silian_value || 0)));
const Silian_formatCarbon = (Silian_value, Silian_t) => {
  const Silian_numericValue = Number(Silian_value || 0);
  if (Silian_numericValue >= 1000) {
    return `${Silian_carbonFormatter.format(Silian_numericValue / 1000)} ${Silian_t('units.t')}`;
  }
  return `${Silian_carbonFormatter.format(Silian_numericValue)} ${Silian_t('units.kg')}`;
};

const Silian_isGithubProfileLink = (Silian_value) => {
  if (typeof Silian_value !== 'string' || Silian_value.trim() === '') {
    return false;
  }

  try {
    const { hostname: Silian_hostname } = new URL(Silian_value);
    return Silian_GITHUB_HOSTS.has(Silian_hostname.toLowerCase());
  } catch {
    return false;
  }
};

// Timeline Card Component with Apple-style animations (memoized for perf)
const Silian_TimelineCard = Silian_React.memo(({ member: Silian_member, index: Silian_index, isLeft: Silian_isLeft, t: Silian_t, isMobileViewport: Silian_isMobileViewport }) => {
  const Silian_cardRef = Silian_useRef(null);
  const Silian_isGithubLink = Silian_isGithubProfileLink(Silian_member.link);
  const Silian_isInView = Silian_useInView(Silian_cardRef, {
    once: false,
    margin: "-100px",
    amount: 0.4
  });

  const Silian_prefersReducedMotion = Silian_useReducedMotion();
  const { scrollYProgress: Silian_scrollYProgress } = Silian_useScroll({
    target: Silian_cardRef,
    offset: ["start end", "center center"]
  });

  // Transform values (with reduced-motion friendly ranges)
  const Silian_yRaw = Silian_useTransform(Silian_scrollYProgress, [0, 0.5, 1], [Silian_prefersReducedMotion ? 20 : 80, 0, Silian_prefersReducedMotion ? -20 : -80]);
  const Silian_rotateYRaw = Silian_useTransform(
    Silian_scrollYProgress,
    [0, 0.5, 1],
    [
      Silian_prefersReducedMotion ? 0 : (Silian_isLeft ? 25 : -25),
      0,
      Silian_prefersReducedMotion ? 0 : (Silian_isLeft ? -12 : 12),
    ]
  );
  const Silian_opacityRaw = Silian_useTransform(Silian_scrollYProgress, [0, 0.2, 0.5, 0.8, 1], [0, 1, 1, 1, Silian_prefersReducedMotion ? 1 : 0.3]);
  const Silian_scaleRaw = Silian_useTransform(Silian_scrollYProgress, [0, 0.5, 1], [Silian_prefersReducedMotion ? 1 : 0.9, 1.04, Silian_prefersReducedMotion ? 1 : 0.97]);

  // Springs for smoother motion (less jank on scroll)
  const Silian_y = Silian_useSpring(Silian_yRaw, { stiffness: 80, damping: 15, mass: 0.8 });
  const Silian_rotateY = Silian_useSpring(Silian_rotateYRaw, { stiffness: 100, damping: 18, mass: 0.9 });
  const Silian_opacity = Silian_useSpring(Silian_opacityRaw, { stiffness: 150, damping: 20 });
  const Silian_scale = Silian_useSpring(Silian_scaleRaw, { stiffness: 150, damping: 15 });
  const Silian_motionStyle = Silian_isMobileViewport
    ? {
        opacity: Silian_opacity,
        y: Silian_y,
        willChange: 'transform, opacity',
      }
    : {
        y: Silian_y,
        opacity: Silian_opacity,
        scale: Silian_scale,
        willChange: 'transform, opacity',
      };
  const Silian_motionInitial = Silian_isMobileViewport
    ? { opacity: 0, y: 24 }
    : { opacity: 0, x: Silian_isLeft ? -100 : 100, rotateY: Silian_isLeft ? 30 : -30 };
  const Silian_motionAnimate = Silian_isMobileViewport
    ? { opacity: 1, y: 0 }
    : {
        opacity: 1,
        x: 0,
        rotateY: 0,
      };
  const Silian_motionExit = Silian_isMobileViewport
    ? { opacity: 0, y: -16 }
    : {
        opacity: 0,
        x: Silian_isLeft ? -100 : 100,
        rotateY: Silian_isLeft ? 30 : -30,
      };

  return (
    <div
      ref={Silian_cardRef}
      className={Silian_cn(
        "relative grid gap-8 items-center",
        Silian_isMobileViewport ? "grid-cols-1" : "md:grid-cols-2",
        !Silian_isMobileViewport && (Silian_isLeft ? "md:pr-12" : "md:pl-12")
      )}
    >
      {/* Timeline Dot (Syncs with card appearance) */}
      <Silian_m.div
        className="hidden md:block absolute left-1/2 top-1/2 w-4 h-4 rounded-full bg-gradient-to-r from-green-500 to-blue-500 shadow-lg z-10"
        style={{ x: "-50%", y: "-50%" }}
        initial={{ scale: 0, opacity: 0 }}
        animate={Silian_isInView ? { scale: [0, 1.2, 1], opacity: 1 } : { scale: 0, opacity: 0 }}
        transition={{
          duration: 0.5,
          delay: Silian_index * 0.1,
          ease: [0.22, 1, 0.36, 1]
        }}
      >
        <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-green-500/20 to-blue-500/20" />
      </Silian_m.div>
      {/* Card positioned on alternating sides */}
      <Silian_m.div
        className={Silian_cn(
          "relative min-w-0",
          Silian_isMobileViewport ? "text-left" : (Silian_isLeft ? "md:col-start-1 md:text-right" : "md:col-start-2")
        )}
        style={Silian_motionStyle}
        initial={Silian_motionInitial}
        animate={Silian_isInView ? Silian_motionAnimate : Silian_motionExit}
        transition={{
          duration: 0.6,
          delay: Silian_index * 0.1,
          ease: [0.22, 1, 0.36, 1]
        }}
      >
        <Silian_m.div
          style={{
            rotateY: Silian_rotateY,
            transformStyle: "preserve-3d",
            backfaceVisibility: 'hidden',
            willChange: 'transform'
          }}
          animate={Silian_isMobileViewport ? {
            opacity: Silian_isInView ? 1 : 0.98,
            transition: {
              duration: 0.4,
              delay: Silian_index * 0.08 + 0.1,
              ease: [0.22, 1, 0.36, 1]
            }
          } : (Silian_isInView ? {
            rotateY: Silian_prefersReducedMotion ? 0 : [Silian_isLeft ? 12 : -12, 0, Silian_isLeft ? -3 : 3, 0],
            scale: Silian_prefersReducedMotion ? 1 : [0.98, 1.01, 1],
            transition: {
              duration: 0.8,
              delay: Silian_index * 0.1 + 0.15,
              ease: [0.22, 1, 0.36, 1]
            }
          } : {})}
          whileHover={Silian_isMobileViewport ? undefined : {
            scale: 1.01,
            rotateY: Silian_prefersReducedMotion ? 0 : (Silian_isLeft ? -3 : 3),
            z: 50,
            transition: {
              duration: 0.4,
              ease: [0.22, 1, 0.36, 1]
            }
          }}
        >
          <Silian_Card
            className="group relative w-full overflow-hidden border border-border/60 bg-card/85 backdrop-blur-xl shadow-2xl hover:shadow-3xl transition-all duration-500"
            style={{
              transformStyle: "preserve-3d",
              transform: "translateZ(0)",
              willChange: 'transform, opacity'
            }}
          >
            {/* Gradient Overlay */}
            <Silian_m.div
              className="absolute inset-0 bg-gradient-to-br from-green-500/5 via-blue-500/5 to-purple-500/5"
              initial={{ opacity: 0 }}
              animate={Silian_isInView ? { opacity: [0, 0.5, 1, 0.7] } : { opacity: 0 }}
              transition={{
                duration: 1.0,
                delay: Silian_index * 0.1 + 0.2,
                ease: [0.22, 1, 0.36, 1]
              }}
            />

            {/* Animated Border */}
            <Silian_m.div
              className="absolute inset-0 rounded-lg"
              style={{
                background: "linear-gradient(90deg, #10b981, #3b82f6, #8b5cf6)",
                padding: "2px",
              }}
              initial={{ opacity: 0 }}
              animate={Silian_isInView ? {
                opacity: [0, 0, 0.8, 0.5],
              } : { opacity: 0 }}
              transition={{
                duration: 0.8,
                delay: Silian_index * 0.1 + 0.3,
                ease: [0.22, 1, 0.36, 1]
              }}
              whileHover={{ opacity: 1 }}
            >
              <div className="h-full w-full rounded-lg bg-card" />
            </Silian_m.div>

            <div className="relative" style={{ transform: "translateZ(50px)" }}>
              <Silian_CardHeader className="pb-4">
                <Silian_m.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={Silian_isInView ? { opacity: 1, y: 0 } : {}}
                  transition={{
                    duration: 0.4,
                    delay: Silian_index * 0.1 + 0.1,
                    ease: [0.22, 1, 0.36, 1]
                  }}
                >
                  <Silian_CardTitle className="mb-2 break-words text-balance text-2xl font-bold text-foreground md:text-3xl">
                    {Silian_member.name}
                  </Silian_CardTitle>
                  {Silian_member.role && (
                    <Silian_CardDescription className="break-words bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-base font-semibold text-transparent md:text-lg">
                      {Silian_member.role}
                    </Silian_CardDescription>
                  )}
                </Silian_m.div>
              </Silian_CardHeader>

              <Silian_CardContent className="text-muted-foreground space-y-4">
                <Silian_m.p
                  className="break-words leading-relaxed text-base md:text-lg"
                  initial={{ opacity: 0, y: 20 }}
                  animate={Silian_isInView ? { opacity: 1, y: 0 } : {}}
                  transition={{
                    duration: 0.4,
                    delay: Silian_index * 0.1 + 0.15,
                    ease: [0.22, 1, 0.36, 1]
                  }}
                >
                  {Silian_member.bio}
                </Silian_m.p>

                {Silian_member.link && (
                  <Silian_m.a
                    href={Silian_member.link}
                    target="_blank"
                    rel="noreferrer"
                    className={Silian_cn(
                      Silian_buttonVariants({
                        size: 'lg',
                        className: Silian_isGithubLink
                          ? 'w-full justify-center bg-[#24292e] text-white border-none shadow-lg hover:bg-[#2f363d] hover:shadow-xl hover:shadow-gray-900/20 overflow-hidden relative'
                          : 'w-full justify-center bg-gradient-to-r from-green-500 to-blue-500 text-white border-none shadow-lg hover:shadow-xl group-hover:from-green-600 group-hover:to-blue-600',
                      })
                    )}
                    initial={{ opacity: 0, y: 20 }}
                    animate={Silian_isInView ? { opacity: 1, y: 0 } : {}}
                    transition={{
                      duration: 0.4,
                      delay: Silian_index * 0.1 + 0.2,
                      ease: [0.22, 1, 0.36, 1]
                    }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {Silian_isGithubLink && (
                      <Silian_m.div
                        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-[-20deg]"
                        initial={{ x: '-150%' }}
                        whileHover={{ x: '150%' }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                      />
                    )}
                    <span className="mr-2 relative z-10">
                      {Silian_member.linkLabel || Silian_t('about.team.learnMore')}
                    </span>
                    {Silian_isGithubLink ? (
                      <Silian_Github className="h-5 w-5 transition-transform group-hover:rotate-12 relative z-10" />
                    ) : (
                      <Silian_ArrowUpRight className="h-5 w-5 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1 relative z-10" />
                    )}
                  </Silian_m.a>
                )}
              </Silian_CardContent>
            </div>
          </Silian_Card>
        </Silian_m.div>

        {/* Decorative Elements */}
        <Silian_m.div
          className="absolute -z-10 inset-0 bg-gradient-to-br from-green-200/30 to-blue-200/30 blur-3xl rounded-full"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={Silian_isInView ? { opacity: 1, scale: 1 } : {}}
          transition={{
            duration: 0.6,
            delay: Silian_index * 0.1 + 0.25,
            ease: [0.22, 1, 0.36, 1]
          }}
        />
      </Silian_m.div>
    </div>
  );
});

const Silian_AboutUsPage = () => {
  const { t: Silian_t } = Silian_useTranslation(['about', 'achievements', 'units']);
  const Silian_isMobileViewport = Silian_useIsMobileViewport();

  const { data: Silian_summaryData } = Silian_useQuery(
    ['public-stats-summary'],
    async () => {
      const Silian_response = await Silian_statsAPI.getPublicSummary();
      return Silian_response.data?.data ?? null;
    },
    {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    }
  );
  const Silian_hero = Silian_t('about.hero', { returnObjects: true }) || {};
  const Silian_contactLinks = Silian_t('about.contactLinks', { returnObjects: true, email: import.meta.env.VITE_SUPPORT_EMAIL }) || [];
  const Silian_team = Silian_t('about.team', { returnObjects: true }) || {};
  const Silian_mission = Silian_t('about.mission', { returnObjects: true }) || {};
  const Silian_achievements = Silian_t('about.achievements', { returnObjects: true }) || {};
  const Silian_specialThanks = Silian_t('about.specialThanks', { returnObjects: true }) || {};

  const Silian_groupedMembers = Silian_useMemo(() => {
    if (!Array.isArray(Silian_team?.members)) {
      return [];
    }
    return Silian_team.members;
  }, [Silian_team?.members]);

  const Silian_achievementStats = Silian_useMemo(() => {
    if (!Array.isArray(Silian_achievements?.stats)) {
      return [];
    }

    if (!Silian_summaryData) {
      return Silian_achievements.stats;
    }

    return Silian_achievements.stats.map((Silian_stat, Silian_index) => {
      const Silian_enriched = { ...Silian_stat };
      if (Silian_index === 0) {
        Silian_enriched.value = Silian_formatCarbon(Silian_summaryData.total_carbon_saved ?? 0, Silian_t);
      } else if (Silian_index === 1) {
        Silian_enriched.value = Silian_formatNumber(Silian_summaryData.total_users ?? 0);
      } else if (Silian_index === 2) {
        Silian_enriched.value = Silian_formatNumber(Silian_summaryData.total_records ?? 0);
      }
      return Silian_enriched;
    });
  }, [Silian_achievements?.stats, Silian_summaryData, Silian_t]);

  return (
    <Silian_LazyMotion features={Silian_domAnimation}>
      <Silian_MotionConfig reducedMotion="user" transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}>
        <div className="relative overflow-x-clip text-foreground">
          <div className="absolute inset-0 -z-10 bg-gradient-to-br from-background via-background to-secondary/30" />
          <div className="absolute top-10 right-10 h-72 w-72 rounded-full bg-green-500/15 blur-3xl -z-10" />
          <div className="absolute bottom-10 left-10 h-72 w-72 rounded-full bg-blue-500/15 blur-3xl -z-10" />

          <header className="relative px-4 py-24">
            <div className="max-w-5xl mx-auto text-center">
              <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
                {Silian_hero.title || 'About CarbonTrack'}
              </h1>
              {Silian_hero.subtitle && (
                <p className="text-lg md:text-xl text-muted-foreground leading-relaxed mb-8">
                  {Silian_hero.subtitle}
                </p>
              )}

              <div className="flex flex-wrap justify-center gap-4">
                {Silian_contactLinks.map((Silian_item) => {
                  const Silian_Icon = Silian_CONTACT_ICON_MAP[Silian_item.type] || Silian_DEFAULT_ICON;
                  return (
                    <a
                      key={`${Silian_item.type}-${Silian_item.href}`}
                      className={Silian_cn(
                        Silian_buttonVariants({
                          size: 'lg',
                          className:
                            'bg-gradient-to-r from-green-500 to-blue-500 text-white border-none shadow-lg hover:from-green-600 hover:to-blue-600 hover:shadow-xl',
                        }),
                        'justify-center'
                      )}
                      href={Silian_item.href}
                      target={Silian_item.external ? '_blank' : undefined}
                      rel={Silian_item.external ? 'noreferrer' : undefined}
                    >
                      <Silian_Icon className="h-5 w-5 mr-2" />
                      {Silian_item.label}
                    </a>
                  );
                })}
              </div>
            </div>
          </header>

          <main className="px-4 pb-24 space-y-20">
            <section className="max-w-7xl mx-auto">
              <Silian_m.div
                className="mb-16 text-center"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              >
                  <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
                  {Silian_team?.title || 'Our Team'}
                </h2>
                {Silian_team?.intro && (
                  <p className="text-lg text-muted-foreground max-w-3xl mx-auto leading-relaxed">
                    {Silian_team.intro}
                  </p>
                )}
              </Silian_m.div>

              {/* Timeline Container */}
              <div className="relative">
                {/* Central Timeline Line */}
                <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-green-400 via-blue-400 to-purple-400 transform -translate-x-1/2" />



                {/* Timeline Items */}
                <div className="space-y-24 md:space-y-32">
                  {Silian_groupedMembers.map((Silian_member, Silian_index) => (
                    <Silian_TimelineCard
                      key={Silian_member.name}
                      member={Silian_member}
                      index={Silian_index}
                      isLeft={Silian_index % 2 === 0}
                      isMobileViewport={Silian_isMobileViewport}
                      t={Silian_t}
                    />
                  ))}
                </div>
              </div>
            </section>

            <section className="max-w-5xl mx-auto">
              <Silian_Card className="border border-border/60 bg-card/80 backdrop-blur shadow-lg shadow-blue-950/10">
                <Silian_CardHeader>
                  <Silian_CardTitle className="text-3xl text-foreground">
                    {Silian_mission?.title || 'Our Mission'}
                  </Silian_CardTitle>
                  {Silian_mission?.description && (
                    <Silian_CardDescription className="text-base text-muted-foreground">
                      {Silian_mission.description}
                    </Silian_CardDescription>
                  )}
                </Silian_CardHeader>
                <Silian_CardContent className="space-y-4">
                  <ul className="space-y-3">
                    {(Silian_mission?.items || []).map((Silian_item) => (
                      <li key={Silian_item} className="flex items-start gap-3">
                        <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-gradient-to-r from-green-500 to-blue-500" />
                        <span className="text-muted-foreground leading-relaxed">{Silian_item}</span>
                      </li>
                    ))}
                  </ul>
                </Silian_CardContent>
              </Silian_Card>
            </section>

            <section className="max-w-6xl mx-auto">
              <div className="mb-10 text-center">
                <h2 className="text-3xl font-semibold text-foreground mb-4">
                  {Silian_achievements?.title || 'Our Achievements'}
                </h2>
                {Silian_achievements?.description && (
                  <p className="text-muted-foreground max-w-3xl mx-auto">
                    {Silian_achievements.description}
                  </p>
                )}
              </div>
              <div className="grid gap-6 md:grid-cols-3">
                {Silian_achievementStats.map((Silian_stat) => (
                  <Silian_Card
                    key={Silian_stat.label}
                    className="border border-border/60 bg-card/80 backdrop-blur shadow-lg shadow-purple-950/10 hover:shadow-xl transition-shadow duration-300"
                  >
                    <Silian_CardHeader>
                      <Silian_CardTitle className="text-xl text-foreground">{Silian_stat.label}</Silian_CardTitle>
                      {Silian_stat.highlight && (
                        <Silian_CardDescription className="text-green-600 font-semibold">
                          {Silian_stat.highlight}
                        </Silian_CardDescription>
                      )}
                    </Silian_CardHeader>
                    <Silian_CardContent>
                      {Silian_stat.value && (
                        <div className="text-3xl font-bold text-foreground mb-4">
                          {Silian_stat.value}
                        </div>
                      )}
                      {Silian_stat.description && (
                        <p className="text-muted-foreground leading-relaxed">
                          {Silian_stat.description}
                        </p>
                      )}
                    </Silian_CardContent>
                  </Silian_Card>
                ))}
              </div>
            </section>

            <section className="max-w-4xl mx-auto">
              <Silian_Card className="bg-gradient-to-r from-pink-500 to-orange-400 text-white border-none shadow-2xl">
                <Silian_CardHeader>
                  <Silian_CardTitle className="text-3xl">
                    {Silian_specialThanks?.title || 'Special Thanks'}
                  </Silian_CardTitle>
                  {Silian_specialThanks?.subtitle && (
                    <Silian_CardDescription className="text-white/80 text-base">
                      {Silian_specialThanks.subtitle}
                    </Silian_CardDescription>
                  )}
                </Silian_CardHeader>
                <Silian_CardContent className="space-y-4">
                  {Silian_specialThanks?.description && (
                    <p className="text-white/90 leading-relaxed">
                      {Silian_specialThanks.description}
                    </p>
                  )}
                  {Silian_specialThanks?.link && (
                    <a
                      href={Silian_specialThanks.link}
                      target="_blank"
                      rel="noreferrer"
                      className={Silian_cn(
                        Silian_buttonVariants({
                          variant: 'secondary',
                          className:
                            'border border-white/25 bg-white/12 text-white shadow-sm shadow-black/20 hover:bg-white/20 justify-center',
                        })
                      )}
                    >
                      {Silian_specialThanks.linkLabel || Silian_t('about.specialThanks.visit')}
                    </a>
                  )}
                </Silian_CardContent>
              </Silian_Card>
            </section>
          </main>
        </div>
      </Silian_MotionConfig>
    </Silian_LazyMotion>
  );
};

export default Silian_AboutUsPage;
