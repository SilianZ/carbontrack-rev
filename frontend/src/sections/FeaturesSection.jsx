import React from 'react';
import { useTranslation } from '../hooks/useTranslation';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Calculator, Award, TrendingUp, Users } from 'lucide-react';

export default function FeaturesSection(){
  const { t } = useTranslation();
  return (
    <section className="py-20 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-foreground mb-4">{t('home.features.title')}</h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">{t('home.features.subtitle')}</p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          <Card>
            <CardHeader className="text-center">
              <Calculator className="h-12 w-12 text-green-600 mx-auto mb-4" />
              <CardTitle>{t('home.features.calculate.title')}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-center">{t('home.features.calculate.description')}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="text-center">
              <Award className="h-12 w-12 text-blue-600 mx-auto mb-4" />
              <CardTitle>{t('home.features.rewards.title')}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-center">{t('home.features.rewards.description')}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="text-center">
              <TrendingUp className="h-12 w-12 text-purple-600 mx-auto mb-4" />
              <CardTitle>{t('home.features.tracking.title')}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-center">{t('home.features.tracking.description')}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="text-center">
              <Users className="h-12 w-12 text-orange-600 mx-auto mb-4" />
              <CardTitle>{t('home.features.community.title')}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-center">{t('home.features.community.description')}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
