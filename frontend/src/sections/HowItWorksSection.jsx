import React from 'react';
import { useTranslation } from '../hooks/useTranslation';

export default function HowItWorksSection(){
  const { t } = useTranslation(['home']);
  return (
    <section className="bg-muted/35 py-20 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-foreground mb-4">{t('home.howItWorks.title')}</h2>
          <p className="text-xl text-muted-foreground">{t('home.howItWorks.subtitle')}</p>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-2xl font-bold text-green-600">1</span>
            </div>
            <h3 className="text-xl font-semibold mb-4">{t('home.howItWorks.step1.title')}</h3>
            <p className="text-muted-foreground">{t('home.howItWorks.step1.description')}</p>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-2xl font-bold text-blue-600">2</span>
            </div>
            <h3 className="text-xl font-semibold mb-4">{t('home.howItWorks.step2.title')}</h3>
            <p className="text-muted-foreground">{t('home.howItWorks.step2.description')}</p>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-2xl font-bold text-purple-600">3</span>
            </div>
            <h3 className="text-xl font-semibold mb-4">{t('home.howItWorks.step3.title')}</h3>
            <p className="text-muted-foreground">{t('home.howItWorks.step3.description')}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
