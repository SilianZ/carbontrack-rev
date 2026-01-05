import React, { useMemo, useRef } from 'react';
import { Mail, Instagram, MessagesSquare, Handshake, ArrowUpRight, Github } from 'lucide-react';
import { m, useInView, useScroll, useTransform, useSpring, useReducedMotion, LazyMotion, MotionConfig, domAnimation } from 'framer-motion';
const __FM_USED = m;
import { useQuery } from 'react-query';
import { useTranslation } from '../hooks/useTranslation';
import { buttonVariants } from '../components/ui/Button';
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

const formatNumber = (value) => numberFormatter.format(Math.max(0, Math.round(value || 0)));
const formatCarbon = (value, t) => {
  const numericValue = Number(value || 0);
  if (numericValue >= 1000) {
    return `${carbonFormatter.format(numericValue / 1000)} ${t('units.t')}`;
  }
  return `${carbonFormatter.format(numericValue)} ${t('units.kg')}`;
};

// Timeline Card Component with Apple-style animations (memoized for perf)
const TimelineCard = React.memo(({ member, index, isLeft, t }) => {
  const cardRef = useRef(null);
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

  return (
    <div
      ref={cardRef}
      className={cn(
        "relative grid md:grid-cols-2 gap-8 items-center",
        isLeft ? "md:pr-12" : "md:pl-12"
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
          "relative",
          isLeft ? "md:col-start-1 md:text-right" : "md:col-start-2"
        )}
        style={{
          y,
          opacity,
          scale,
          willChange: 'transform, opacity'
        }}
        initial={{ opacity: 0, x: isLeft ? -100 : 100, rotateY: isLeft ? 30 : -30 }}
        animate={isInView ? {
          opacity: 1,
          x: 0,
          rotateY: 0,
        } : {
          opacity: 0,
          x: isLeft ? -100 : 100,
          rotateY: isLeft ? 30 : -30,
        }}
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
          animate={isInView ? {
            rotateY: prefersReducedMotion ? 0 : [isLeft ? 12 : -12, 0, isLeft ? -3 : 3, 0],
            scale: prefersReducedMotion ? 1 : [0.98, 1.01, 1],
            transition: {
              duration: 0.8,
              delay: index * 0.1 + 0.15,
              ease: [0.22, 1, 0.36, 1]
            }
          } : {}}
          whileHover={{
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
            className="group relative overflow-hidden bg-white/90 backdrop-blur-xl border-none shadow-2xl hover:shadow-3xl transition-all duration-500"
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
              <div className="h-full w-full rounded-lg bg-white" />
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
                  <CardTitle className="text-2xl md:text-3xl text-gray-900 font-bold mb-2">
                    {member.name}
                  </CardTitle>
                  {member.role && (
                    <CardDescription className="text-base md:text-lg bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent font-semibold">
                      {member.role}
                    </CardDescription>
                  )}
                </m.div>
              </CardHeader>

              <CardContent className="text-gray-700 space-y-4">
                <m.p
                  className="leading-relaxed text-base md:text-lg"
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
                        className: member.link?.includes('github.com')
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
                    {member.link?.includes('github.com') && (
                      <m.div
                        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-[-20deg]"
                        initial={{ x: '-150%' }}
                        whileHover={{ x: '150%' }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                      />
                    )}
                    <span className="mr-2 relative z-10">
                      {member.linkLabel || t('about.team.learnMore', 'Learn More')}
                    </span>
                    {member.link?.includes('github.com') ? (
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
  const { t } = useTranslation();

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
        <div className="relative">
          <div className="absolute inset-0 -z-10 bg-gradient-to-br from-green-50 via-white to-blue-50" />
          <div className="absolute top-10 right-10 h-72 w-72 rounded-full bg-green-200/40 blur-3xl -z-10" />
          <div className="absolute bottom-10 left-10 h-72 w-72 rounded-full bg-blue-200/40 blur-3xl -z-10" />

          <header className="relative px-4 py-24">
            <div className="max-w-5xl mx-auto text-center">
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
                {hero.title || 'About CarbonTrack'}
              </h1>
              {hero.subtitle && (
                <p className="text-lg md:text-xl text-gray-700 leading-relaxed mb-8">
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
                <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
                  {team?.title || 'Our Team'}
                </h2>
                {team?.intro && (
                  <p className="text-lg text-gray-600 max-w-3xl mx-auto leading-relaxed">
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
                      t={t}
                    />
                  ))}
                </div>
              </div>
            </section>

            <section className="max-w-5xl mx-auto">
              <Card className="bg-white/80 backdrop-blur border-none shadow-lg shadow-blue-100">
                <CardHeader>
                  <CardTitle className="text-3xl text-gray-900">
                    {mission?.title || 'Our Mission'}
                  </CardTitle>
                  {mission?.description && (
                    <CardDescription className="text-base text-gray-600">
                      {mission.description}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-3">
                    {(mission?.items || []).map((item) => (
                      <li key={item} className="flex items-start gap-3">
                        <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-gradient-to-r from-green-500 to-blue-500" />
                        <span className="text-gray-700 leading-relaxed">{item}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </section>

            <section className="max-w-6xl mx-auto">
              <div className="mb-10 text-center">
                <h2 className="text-3xl font-semibold text-gray-900 mb-4">
                  {achievements?.title || 'Our Achievements'}
                </h2>
                {achievements?.description && (
                  <p className="text-gray-600 max-w-3xl mx-auto">
                    {achievements.description}
                  </p>
                )}
              </div>
              <div className="grid gap-6 md:grid-cols-3">
                {achievementStats.map((stat) => (
                  <Card
                    key={stat.label}
                    className="bg-white/80 backdrop-blur border-none shadow-lg shadow-purple-100 hover:shadow-xl transition-shadow duration-300"
                  >
                    <CardHeader>
                      <CardTitle className="text-xl text-gray-900">{stat.label}</CardTitle>
                      {stat.highlight && (
                        <CardDescription className="text-green-600 font-semibold">
                          {stat.highlight}
                        </CardDescription>
                      )}
                    </CardHeader>
                    <CardContent>
                      {stat.value && (
                        <div className="text-3xl font-bold text-gray-900 mb-4">
                          {stat.value}
                        </div>
                      )}
                      {stat.description && (
                        <p className="text-gray-600 leading-relaxed">
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
                            'bg-white text-pink-600 hover:bg-white/90 border-none justify-center',
                        })
                      )}
                    >
                      {specialThanks.linkLabel || t('about.specialThanks.visit', 'Visit Website')}
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
