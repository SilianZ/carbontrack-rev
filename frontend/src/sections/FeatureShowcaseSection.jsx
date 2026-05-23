import Silian_React from 'react';
import { Leaf as Silian_Leaf, BarChart2 as Silian_BarChart2, Gift as Silian_Gift, Users as Silian_Users } from 'lucide-react';
import { Card as Silian_Card, CardContent as Silian_CardContent, CardHeader as Silian_CardHeader, CardTitle as Silian_CardTitle, CardDescription as Silian_CardDescription } from '../components/ui/Card';
import { useTranslation as Silian_useTranslation } from '../hooks/useTranslation';
import { cn as Silian_cn } from '../lib/utils';

const Silian_ICONS = {
  footprint: Silian_Leaf,
  analytics: Silian_BarChart2,
  rewards: Silian_Gift,
  community: Silian_Users,
};

export default function FeatureShowcaseSection() {
  const { t: Silian_t } = Silian_useTranslation(['home']);
  const Silian_cards = Silian_t('home.featureShowcase.cards', { returnObjects: true }) || [];

  return (
    <section className="relative isolate overflow-hidden bg-gradient-to-br from-background via-background to-secondary/35 px-4 py-24">
      <div className="mx-auto max-w-6xl space-y-12">
        <div className="relative z-10 mx-auto max-w-4xl text-center">
          <h2 className="bg-gradient-to-r from-blue-600 via-emerald-500 to-teal-500 bg-clip-text text-3xl font-bold leading-tight text-transparent md:text-5xl md:leading-[1.12]">
            {Silian_t('home.featureShowcase.title')}
          </h2>
          <p className="mx-auto mt-5 max-w-3xl text-lg leading-8 text-muted-foreground">
            {Silian_t('home.featureShowcase.subtitle')}
          </p>
        </div>

        <div className="relative z-10 grid gap-6 md:grid-cols-2">
          {Silian_cards.map((Silian_card, Silian_index) => {
            const Silian_Icon = Silian_ICONS[Silian_card.id] ?? Silian_Leaf;
            return (
              <Silian_Card
                key={Silian_card.id || Silian_index}
                className={Silian_cn(
                  'relative overflow-hidden border-none shadow-lg transition-transform duration-500 hover:-translate-y-1',
                  Silian_index % 2 === 0
                    ? 'border border-border/60 bg-card/85 backdrop-blur'
                    : 'bg-gradient-to-br from-blue-600 to-emerald-500 text-white'
                )}
              >
                <div
                  className={Silian_cn(
                    'absolute inset-0 opacity-[0.05]',
                    Silian_index % 2 === 0 ? 'bg-[radial-gradient(circle_at_top,#22d3ee,transparent_60%)]' : ''
                  )}
                />
                <Silian_CardHeader className="relative flex flex-row items-start gap-4">
                  <div className={Silian_cn(
                    'flex h-12 w-12 items-center justify-center rounded-xl',
                    Silian_index % 2 === 0
                      ? 'bg-gradient-to-br from-emerald-100 to-blue-100 text-emerald-600'
                      : 'bg-white/20 text-white'
                  )}>
                    <Silian_Icon className="h-6 w-6" />
                  </div>
                  <div>
                    <Silian_CardTitle className={Silian_cn(
                      'text-xl font-semibold',
                      Silian_index % 2 !== 0 && 'text-white'
                    )}>
                      {Silian_card.title}
                    </Silian_CardTitle>
                    {Silian_card.subtitle && (
                      <Silian_CardDescription className={Silian_cn(
                        Silian_index % 2 === 0 ? 'text-muted-foreground' : 'text-white/70'
                      )}>
                        {Silian_card.subtitle}
                      </Silian_CardDescription>
                    )}
                  </div>
                </Silian_CardHeader>
                <Silian_CardContent className="relative space-y-3 text-sm leading-relaxed">
                  <p className={Silian_cn(
                    Silian_index % 2 === 0 ? 'text-muted-foreground' : 'text-white/90'
                  )}>
                    {Silian_card.description}
                  </p>
                  {Array.isArray(Silian_card.highlights) && (
                    <ul className="space-y-2">
                      {Silian_card.highlights.map((Silian_highlight, Silian_highlightIndex) => (
                        <li
                          key={Silian_highlightIndex}
                          className={Silian_cn(
                            'flex items-start gap-2',
                            Silian_index % 2 === 0 ? 'text-foreground/85' : 'text-white/90'
                          )}
                        >
                          <span className="mt-1 h-2 w-2 rounded-full bg-emerald-400" />
                          <span>{Silian_highlight}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Silian_CardContent>
              </Silian_Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
