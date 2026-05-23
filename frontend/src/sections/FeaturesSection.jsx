import Silian_React from 'react';
import { useTranslation as Silian_useTranslation } from '../hooks/useTranslation';
import { Card as Silian_Card, CardContent as Silian_CardContent, CardHeader as Silian_CardHeader, CardTitle as Silian_CardTitle } from '../components/ui/Card';
import { Calculator as Silian_Calculator, Award as Silian_Award, TrendingUp as Silian_TrendingUp, Users as Silian_Users } from 'lucide-react';

export default function FeaturesSection(){
  const { t: Silian_t } = Silian_useTranslation(['home']);
  return (
    <section className="py-20 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-foreground mb-4">{Silian_t('home.features.title')}</h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">{Silian_t('home.features.subtitle')}</p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          <Silian_Card>
            <Silian_CardHeader className="text-center">
              <Silian_Calculator className="h-12 w-12 text-green-600 mx-auto mb-4" />
              <Silian_CardTitle>{Silian_t('home.features.calculate.title')}</Silian_CardTitle>
            </Silian_CardHeader>
            <Silian_CardContent>
              <p className="text-muted-foreground text-center">{Silian_t('home.features.calculate.description')}</p>
            </Silian_CardContent>
          </Silian_Card>
          <Silian_Card>
            <Silian_CardHeader className="text-center">
              <Silian_Award className="h-12 w-12 text-blue-600 mx-auto mb-4" />
              <Silian_CardTitle>{Silian_t('home.features.rewards.title')}</Silian_CardTitle>
            </Silian_CardHeader>
            <Silian_CardContent>
              <p className="text-muted-foreground text-center">{Silian_t('home.features.rewards.description')}</p>
            </Silian_CardContent>
          </Silian_Card>
          <Silian_Card>
            <Silian_CardHeader className="text-center">
              <Silian_TrendingUp className="h-12 w-12 text-purple-600 mx-auto mb-4" />
              <Silian_CardTitle>{Silian_t('home.features.tracking.title')}</Silian_CardTitle>
            </Silian_CardHeader>
            <Silian_CardContent>
              <p className="text-muted-foreground text-center">{Silian_t('home.features.tracking.description')}</p>
            </Silian_CardContent>
          </Silian_Card>
          <Silian_Card>
            <Silian_CardHeader className="text-center">
              <Silian_Users className="h-12 w-12 text-orange-600 mx-auto mb-4" />
              <Silian_CardTitle>{Silian_t('home.features.community.title')}</Silian_CardTitle>
            </Silian_CardHeader>
            <Silian_CardContent>
              <p className="text-muted-foreground text-center">{Silian_t('home.features.community.description')}</p>
            </Silian_CardContent>
          </Silian_Card>
        </div>
      </div>
    </section>
  );
}
