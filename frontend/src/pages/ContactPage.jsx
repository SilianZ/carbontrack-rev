import Silian_React, { useMemo as Silian_useMemo } from 'react';
import { Link as Silian_Link } from 'react-router-dom';
import { motion as Silian_Motion } from 'framer-motion';
import { ArrowRight as Silian_ArrowRight, AtSign as Silian_AtSign, Building2 as Silian_Building2, MapPin as Silian_MapPin, Phone as Silian_Phone } from 'lucide-react';

import { useTranslation as Silian_useTranslation } from '../hooks/useTranslation';

const Silian_supportEmail = import.meta.env?.VITE_SUPPORT_EMAIL || 'support@carbontrack.org';
const Silian_supportPhone = '+1 475-280-7571';

export default function ContactPage() {
  const { t: Silian_t } = Silian_useTranslation(['contact', 'footer']);

  const Silian_contactLinks = Silian_useMemo(() => {
    const Silian_translated = Silian_t('contact.links', {
      returnObjects: true,
      email: Silian_supportEmail,
    });
    return Array.isArray(Silian_translated) ? Silian_translated : [];
  }, [Silian_t]);

  const Silian_contactCards = [
    {
      icon: Silian_AtSign,
      eyebrow: Silian_t('contact.methods.emailTitle'),
      title: Silian_supportEmail,
      description: Silian_t('contact.methods.emailDescription'),
      href: `mailto:${Silian_supportEmail}`,
    },
    {
      icon: Silian_Phone,
      eyebrow: Silian_t('contact.methods.phoneTitle'),
      title: Silian_supportPhone,
      description: Silian_t('contact.methods.phoneDescription'),
      href: `tel:${Silian_supportPhone.replaceAll(' ', '')}`,
    },
    {
      icon: Silian_MapPin,
      eyebrow: Silian_t('contact.methods.addressTitle'),
      title: Silian_t('footer.address'),
      description: Silian_t('contact.methods.addressDescription'),
      href: null,
    },
  ];

  return (
    <div className="bg-background text-foreground">
      <section className="border-b border-border bg-muted/30">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)] lg:px-8 lg:py-18">
          <Silian_Motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-600 dark:text-emerald-300">
              {Silian_t('contact.hero.eyebrow')}
            </p>
            <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
              {Silian_t('contact.hero.title')}
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              {Silian_t('contact.hero.subtitle')}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href={`mailto:${Silian_supportEmail}`}
                className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-emerald-500"
              >
                <Silian_AtSign className="h-4 w-4" />
                {Silian_t('contact.hero.primaryAction')}
              </a>
              <Silian_Link
                to="/help"
                className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-3 text-sm font-medium text-foreground transition hover:bg-muted"
              >
                {Silian_t('contact.hero.secondaryAction')}
                <Silian_ArrowRight className="h-4 w-4" />
              </Silian_Link>
            </div>
          </Silian_Motion.div>

          <Silian_Motion.div
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut', delay: 0.05 }}
            className="rounded-[2rem] border border-border bg-card p-6 shadow-sm"
          >
            <div className="flex items-center gap-3 text-emerald-700 dark:text-emerald-300">
              <Silian_Building2 className="h-5 w-5" />
              <span className="text-sm font-medium">{Silian_t('contact.panel.title')}</span>
            </div>
            <p className="mt-4 text-lg font-medium">{Silian_t('contact.panel.body')}</p>
          </Silian_Motion.div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-4">
          {Silian_contactCards.map((Silian_card) => {
            const Silian_Icon = Silian_card.icon;
            const Silian_content = (
              <div className="group flex items-start justify-between gap-4 rounded-[1.75rem] border border-border bg-card/70 px-5 py-5 shadow-sm transition duration-200 hover:border-emerald-300 hover:bg-card">
                <div className="flex items-start gap-4">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                    <Silian_Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.26em] text-muted-foreground">
                      {Silian_card.eyebrow}
                    </p>
                    <p className="mt-2 text-lg font-medium text-foreground">{Silian_card.title}</p>
                    <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">{Silian_card.description}</p>
                  </div>
                </div>
                {Silian_card.href ? <Silian_ArrowRight className="mt-1 h-4 w-4 text-muted-foreground transition group-hover:text-emerald-600" /> : null}
              </div>
            );

            return Silian_card.href ? (
              <a key={Silian_card.eyebrow} href={Silian_card.href} className="block">
                {Silian_content}
              </a>
            ) : (
              <div key={Silian_card.eyebrow}>{Silian_content}</div>
            );
          })}
        </div>

        <div className="mt-8 rounded-[1.8rem] border border-border/80 bg-card/70 p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-muted-foreground">
            {Silian_t('contact.linksTitle')}
          </p>
          <div className="mt-4 grid gap-3">
            {Silian_contactLinks.map((Silian_link, Silian_index) => (
              <a
                key={`${Silian_link.type}-${Silian_index}`}
                href={Silian_link.href}
                target={Silian_link.external ? '_blank' : undefined}
                rel={Silian_link.external ? 'noopener noreferrer' : undefined}
                className="flex items-center justify-between gap-3 rounded-[1.3rem] border border-transparent bg-background px-4 py-3 text-sm font-medium text-foreground transition hover:border-emerald-300"
              >
                <span>{Silian_link.label}</span>
                <Silian_ArrowRight className="h-4 w-4 text-muted-foreground" />
              </a>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
