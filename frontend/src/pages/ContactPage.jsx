import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion as Motion } from 'framer-motion';
import { ArrowRight, AtSign, Building2, MapPin, Phone } from 'lucide-react';

import { useTranslation } from '../hooks/useTranslation';

const supportEmail = import.meta.env?.VITE_SUPPORT_EMAIL || 'support@carbontrack.org';
const supportPhone = '+1 475-280-7571';

export default function ContactPage() {
  const { t } = useTranslation(['contact', 'footer']);

  const contactLinks = useMemo(() => {
    const translated = t('contact.links', {
      returnObjects: true,
      email: supportEmail,
    });
    return Array.isArray(translated) ? translated : [];
  }, [t]);

  const contactCards = [
    {
      icon: AtSign,
      eyebrow: t('contact.methods.emailTitle'),
      title: supportEmail,
      description: t('contact.methods.emailDescription'),
      href: `mailto:${supportEmail}`,
    },
    {
      icon: Phone,
      eyebrow: t('contact.methods.phoneTitle'),
      title: supportPhone,
      description: t('contact.methods.phoneDescription'),
      href: `tel:${supportPhone.replaceAll(' ', '')}`,
    },
    {
      icon: MapPin,
      eyebrow: t('contact.methods.addressTitle'),
      title: t('footer.address'),
      description: t('contact.methods.addressDescription'),
      href: null,
    },
  ];

  return (
    <div className="bg-background text-foreground">
      <section className="border-b border-border bg-muted/30">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)] lg:px-8 lg:py-18">
          <Motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-600 dark:text-emerald-300">
              {t('contact.hero.eyebrow')}
            </p>
            <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
              {t('contact.hero.title')}
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              {t('contact.hero.subtitle')}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href={`mailto:${supportEmail}`}
                className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-emerald-500"
              >
                <AtSign className="h-4 w-4" />
                {t('contact.hero.primaryAction')}
              </a>
              <Link
                to="/help"
                className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-3 text-sm font-medium text-foreground transition hover:bg-muted"
              >
                {t('contact.hero.secondaryAction')}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </Motion.div>

          <Motion.div
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut', delay: 0.05 }}
            className="rounded-[2rem] border border-border bg-card p-6 shadow-sm"
          >
            <div className="flex items-center gap-3 text-emerald-700 dark:text-emerald-300">
              <Building2 className="h-5 w-5" />
              <span className="text-sm font-medium">{t('contact.panel.title')}</span>
            </div>
            <p className="mt-4 text-lg font-medium">{t('contact.panel.body')}</p>
          </Motion.div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-4">
          {contactCards.map((card) => {
            const Icon = card.icon;
            const content = (
              <div className="group flex items-start justify-between gap-4 rounded-[1.75rem] border border-border bg-card/70 px-5 py-5 shadow-sm transition duration-200 hover:border-emerald-300 hover:bg-card">
                <div className="flex items-start gap-4">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.26em] text-muted-foreground">
                      {card.eyebrow}
                    </p>
                    <p className="mt-2 text-lg font-medium text-foreground">{card.title}</p>
                    <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">{card.description}</p>
                  </div>
                </div>
                {card.href ? <ArrowRight className="mt-1 h-4 w-4 text-muted-foreground transition group-hover:text-emerald-600" /> : null}
              </div>
            );

            return card.href ? (
              <a key={card.eyebrow} href={card.href} className="block">
                {content}
              </a>
            ) : (
              <div key={card.eyebrow}>{content}</div>
            );
          })}
        </div>

        <div className="mt-8 rounded-[1.8rem] border border-border/80 bg-card/70 p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-muted-foreground">
            {t('contact.linksTitle')}
          </p>
          <div className="mt-4 grid gap-3">
            {contactLinks.map((link, index) => (
              <a
                key={`${link.type}-${index}`}
                href={link.href}
                target={link.external ? '_blank' : undefined}
                rel={link.external ? 'noopener noreferrer' : undefined}
                className="flex items-center justify-between gap-3 rounded-[1.3rem] border border-transparent bg-background px-4 py-3 text-sm font-medium text-foreground transition hover:border-emerald-300"
              >
                <span>{link.label}</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </a>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
