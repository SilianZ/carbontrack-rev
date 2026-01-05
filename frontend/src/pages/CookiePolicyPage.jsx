import React from 'react';
import { m, LazyMotion, domAnimation } from 'framer-motion';
import { Trans } from 'react-i18next';
import { Card, CardContent } from '../components/ui/Card';
import { Cookie, Settings, Shield, Info, Eye, RefreshCw } from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';

const Section = ({ title, icon: Icon, children }) => (
    <m.div
        className="mb-8"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
    >
        <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            {Icon && <Icon className="h-6 w-6 text-orange-600" />}
            {title}
        </h2>
        <div className="text-gray-600 leading-relaxed space-y-4">
            {children}
        </div>
    </m.div>
);

const CookiePolicyPage = () => {
    const { t } = useTranslation();
    const currentDate = new Date().toLocaleDateString();

    const thirdPartyItems = t('legal.cookies.sections.thirdParty.items', { returnObjects: true });

    return (
        <LazyMotion features={domAnimation}>
            <div className="min-h-screen bg-gray-50 py-20 px-4 sm:px-6 lg:px-8">
                <div className="max-w-4xl mx-auto">
                    <m.div
                        className="text-center mb-12"
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                    >
                        <h1 className="text-4xl font-extrabold text-gray-900 mb-4">{t('legal.cookies.title')}</h1>
                        <p className="text-lg text-gray-600">
                            {t('legal.lastUpdated', { date: currentDate })}
                        </p>
                        <p className="mt-4 text-gray-500 max-w-2xl mx-auto">
                            {t('legal.cookies.intro')}
                        </p>
                    </m.div>

                    <Card className="bg-white/80 backdrop-blur shadow-xl border-none">
                        <CardContent className="p-8 md:p-12">
                            <Section title={t('legal.cookies.sections.what.title')} icon={Info}>
                                <p>{t('legal.cookies.sections.what.content')}</p>
                            </Section>

                            <Section title={t('legal.cookies.sections.how.title')} icon={Cookie}>
                                <p>{t('legal.cookies.sections.how.intro')}</p>
                                <div className="space-y-4 mt-4">
                                    <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                                        <h3 className="font-bold text-gray-900 mb-2">
                                            {t('legal.cookies.sections.how.types.essential.title')}
                                        </h3>
                                        <p className="text-sm">
                                            {t('legal.cookies.sections.how.types.essential.desc')}
                                        </p>
                                    </div>
                                    <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                                        <h3 className="font-bold text-gray-900 mb-2">
                                            {t('legal.cookies.sections.how.types.performance.title')}
                                        </h3>
                                        <p className="text-sm">
                                            {t('legal.cookies.sections.how.types.performance.desc')}
                                        </p>
                                    </div>
                                    <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                                        <h3 className="font-bold text-gray-900 mb-2">
                                            {t('legal.cookies.sections.how.types.functionality.title')}
                                        </h3>
                                        <p className="text-sm">
                                            {t('legal.cookies.sections.how.types.functionality.desc')}
                                        </p>
                                    </div>
                                </div>
                            </Section>

                            <Section title={t('legal.cookies.sections.thirdParty.title')} icon={Eye}>
                                <p>{t('legal.cookies.sections.thirdParty.intro')}</p>
                                <ul className="list-disc pl-5">
                                    {Array.isArray(thirdPartyItems) && thirdPartyItems.map((item, index) => (
                                        <li key={index}>
                                            <Trans defaults={item} components={{ strong: <strong /> }} />
                                        </li>
                                    ))}
                                </ul>
                            </Section>

                            <Section title={t('legal.cookies.sections.managing.title')} icon={Settings}>
                                <p>
                                    {t('legal.cookies.sections.managing.content1')}
                                </p>
                                <p>
                                    {t('legal.cookies.sections.managing.content2')}
                                </p>
                            </Section>

                            <Section title={t('legal.cookies.sections.updates.title')} icon={Info}>
                                <p>
                                    {t('legal.cookies.sections.updates.content')}
                                </p>
                            </Section>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </LazyMotion>
    );
};

export default CookiePolicyPage;
