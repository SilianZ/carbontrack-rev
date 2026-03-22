import React from 'react';
import { Megaphone, Award, Leaf, Shield } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { useTranslation } from '../hooks/useTranslation';
import { cn } from '../lib/utils';

const ICONS = {
  feedback: Megaphone,
  rewards: Award,
  community: Leaf,
  integrity: Shield,
};

export default function AnnouncementSection() {
  const { t } = useTranslation();
  const announcements = t('home.announcements.items', { returnObjects: true }) || [];

  return (
    <section className="py-16 px-4 relative">
      <div className="max-w-6xl mx-auto">
        <Card className="border border-black/5 bg-card text-card-foreground shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:bg-white/5 dark:border-white/10 dark:shadow-none dark:backdrop-blur-md">
          <CardHeader className="text-center space-y-2">
            <CardTitle className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-gray-900 to-gray-600 dark:from-white dark:to-white/60">
              {t('home.announcements.title')}
            </CardTitle>
            <p className="text-muted-foreground">{t('home.announcements.subtitle')}</p>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-2">
            {announcements.map((item, index) => {
              const Icon = ICONS[item.id] ?? Megaphone;
              return (
                <div
                  key={item.id || index}
                  className={cn(
                    'group relative rounded-2xl border border-black/5 bg-background/50 p-6 shadow-sm transition-all duration-300 dark:border-white/10 dark:bg-white/5',
                    'hover:-translate-y-1 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] dark:hover:bg-white/10 dark:hover:shadow-none'
                  )}
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/10 to-blue-500/10 text-emerald-600 group-hover:scale-105 transition-transform">
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="space-y-1.5">
                      <h3 className="text-lg font-semibold text-foreground">{item.title}</h3>
                      <p className="text-muted-foreground text-sm leading-relaxed">
                        {item.description}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
