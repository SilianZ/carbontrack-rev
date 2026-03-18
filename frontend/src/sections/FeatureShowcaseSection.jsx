import React from 'react';
import { Leaf, BarChart2, Gift, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { useTranslation } from '../hooks/useTranslation';
import { cn } from '../lib/utils';

const ICONS = {
  footprint: Leaf,
  analytics: BarChart2,
  rewards: Gift,
  community: Users,
};

export default function FeatureShowcaseSection() {
  const { t } = useTranslation();
  const cards = t('home.featureShowcase.cards', { returnObjects: true }) || [];

  return (
    <section className="relative isolate overflow-hidden bg-gradient-to-br from-background via-background to-secondary/35 px-4 py-24">
      <div className="mx-auto max-w-6xl space-y-12">
        <div className="relative z-10 mx-auto max-w-4xl text-center">
          <h2 className="bg-gradient-to-r from-blue-600 via-emerald-500 to-teal-500 bg-clip-text text-3xl font-bold leading-tight text-transparent md:text-5xl md:leading-[1.12]">
            {t('home.featureShowcase.title')}
          </h2>
          <p className="mx-auto mt-5 max-w-3xl text-lg leading-8 text-muted-foreground">
            {t('home.featureShowcase.subtitle')}
          </p>
        </div>

        <div className="relative z-10 grid gap-6 md:grid-cols-2">
          {cards.map((card, index) => {
            const Icon = ICONS[card.id] ?? Leaf;
            return (
              <Card
                key={card.id || index}
                className={cn(
                  'relative overflow-hidden border-none shadow-lg transition-transform duration-500 hover:-translate-y-1',
                  index % 2 === 0
                    ? 'border border-border/60 bg-card/85 backdrop-blur'
                    : 'bg-gradient-to-br from-blue-600 to-emerald-500 text-white'
                )}
              >
                <div
                  className={cn(
                    'absolute inset-0 opacity-[0.05]',
                    index % 2 === 0 ? 'bg-[radial-gradient(circle_at_top,#22d3ee,transparent_60%)]' : ''
                  )}
                />
                <CardHeader className="relative flex flex-row items-start gap-4">
                  <div className={cn(
                    'flex h-12 w-12 items-center justify-center rounded-xl',
                    index % 2 === 0
                      ? 'bg-gradient-to-br from-emerald-100 to-blue-100 text-emerald-600'
                      : 'bg-white/20 text-white'
                  )}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <div>
                    <CardTitle className={cn(
                      'text-xl font-semibold',
                      index % 2 !== 0 && 'text-white'
                    )}>
                      {card.title}
                    </CardTitle>
                    {card.subtitle && (
                      <CardDescription className={cn(
                        index % 2 === 0 ? 'text-muted-foreground' : 'text-white/70'
                      )}>
                        {card.subtitle}
                      </CardDescription>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="relative space-y-3 text-sm leading-relaxed">
                  <p className={cn(
                    index % 2 === 0 ? 'text-muted-foreground' : 'text-white/90'
                  )}>
                    {card.description}
                  </p>
                  {Array.isArray(card.highlights) && (
                    <ul className="space-y-2">
                      {card.highlights.map((highlight, highlightIndex) => (
                        <li
                          key={highlightIndex}
                          className={cn(
                            'flex items-start gap-2',
                            index % 2 === 0 ? 'text-foreground/85' : 'text-white/90'
                          )}
                        >
                          <span className="mt-1 h-2 w-2 rounded-full bg-emerald-400" />
                          <span>{highlight}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
