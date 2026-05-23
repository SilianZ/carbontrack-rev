import Silian_React from 'react';
import { Megaphone as Silian_Megaphone, Award as Silian_Award, Leaf as Silian_Leaf, Shield as Silian_Shield } from 'lucide-react';
import { Card as Silian_Card, CardContent as Silian_CardContent, CardHeader as Silian_CardHeader, CardTitle as Silian_CardTitle } from '../components/ui/Card';
import { useTranslation as Silian_useTranslation } from '../hooks/useTranslation';
import { cn as Silian_cn } from '../lib/utils';

const Silian_ICONS = {
  feedback: Silian_Megaphone,
  rewards: Silian_Award,
  community: Silian_Leaf,
  integrity: Silian_Shield,
};

export default function AnnouncementSection() {
  const { t: Silian_t } = Silian_useTranslation(['home']);
  const Silian_announcements = Silian_t('home.announcements.items', { returnObjects: true }) || [];

  return (
    <section className="py-16 px-4 relative">
      <div className="max-w-6xl mx-auto">
        <Silian_Card className="border border-black/5 bg-card text-card-foreground shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:bg-white/5 dark:border-white/10 dark:shadow-none dark:backdrop-blur-md">
          <Silian_CardHeader className="text-center space-y-2">
            <Silian_CardTitle className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-gray-900 to-gray-600 dark:from-white dark:to-white/60">
              {Silian_t('home.announcements.title')}
            </Silian_CardTitle>
            <p className="text-muted-foreground">{Silian_t('home.announcements.subtitle')}</p>
          </Silian_CardHeader>
          <Silian_CardContent className="grid gap-6 md:grid-cols-2">
            {Silian_announcements.map((Silian_item, Silian_index) => {
              const Silian_Icon = Silian_ICONS[Silian_item.id] ?? Silian_Megaphone;
              return (
                <div
                  key={Silian_item.id || Silian_index}
                  className={Silian_cn(
                    'group relative rounded-2xl border border-black/5 bg-background/50 p-6 shadow-sm transition-all duration-300 dark:border-white/10 dark:bg-white/5',
                    'hover:-translate-y-1 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] dark:hover:bg-white/10 dark:hover:shadow-none'
                  )}
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/10 to-blue-500/10 text-emerald-600 group-hover:scale-105 transition-transform">
                      <Silian_Icon className="h-6 w-6" />
                    </div>
                    <div className="space-y-1.5">
                      <h3 className="text-lg font-semibold text-foreground">{Silian_item.title}</h3>
                      <p className="text-muted-foreground text-sm leading-relaxed">
                        {Silian_item.description}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </Silian_CardContent>
        </Silian_Card>
      </div>
    </section>
  );
}
