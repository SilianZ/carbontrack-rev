import React from 'react';
import { m, LazyMotion, domAnimation } from 'framer-motion';
import { Trans } from 'react-i18next';
import { Card, CardContent } from '../components/ui/Card';
import { Scale, FileText, AlertTriangle, UserCheck, Gavel, ShieldAlert } from 'lucide-react';
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
            {Icon && <Icon className="h-6 w-6 text-blue-600" />}
            {title}
        </h2>
        <div className="text-gray-600 leading-relaxed space-y-4">
            {children}
        </div>
    </m.div>
);

const TermsOfServicePage = () => {
    const { t } = useTranslation();
    const currentDate = new Date().toLocaleDateString();

    const responsibilityItems = t('legal.terms.sections.responsibility.items', { returnObjects: true });

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
                        <h1 className="text-4xl font-extrabold text-gray-900 mb-4">{t('legal.terms.title')}</h1>
                        <p className="text-lg text-gray-600">
                            {t('legal.lastUpdated', { date: currentDate })}
                        </p>
                        <p className="mt-4 text-gray-500 max-w-2xl mx-auto">
                            {t('legal.terms.intro')}
                        </p>
                    </m.div>

                    <Card className="bg-white/80 backdrop-blur shadow-xl border-none">
                        <CardContent className="p-8 md:p-12">
                            <Section title={t('legal.terms.sections.agreement.title')} icon={FileText}>
                                <p>
                                    <Trans i18nKey="legal.terms.sections.agreement.content1" components={{ strong: <strong /> }} />
                                </p>
                                <p>
                                    <Trans i18nKey="legal.terms.sections.agreement.content2" components={{ strong: <strong /> }} />
                                </p>
                            </Section>

                            <Section title={t('legal.terms.sections.responsibility.title')} icon={UserCheck}>
                                <p>{t('legal.terms.sections.responsibility.intro')}</p>
                                <ul className="list-disc pl-5 space-y-2">
                                    {Array.isArray(responsibilityItems) && responsibilityItems.map((item, index) => (
                                        <li key={index}>
                                            <Trans defaults={item} components={{ strong: <strong /> }} />
                                        </li>
                                    ))}
                                </ul>
                            </Section>

                            <Section title={t('legal.terms.sections.ip.title')} icon={Scale}>
                                <p>
                                    {t('legal.terms.sections.ip.content')}
                                </p>
                            </Section>

                            <Section title={t('legal.terms.sections.liability.title')} icon={AlertTriangle}>
                                <p>
                                    {t('legal.terms.sections.liability.content')}
                                </p>
                            </Section>

                            <Section title={t('legal.terms.sections.law.title')} icon={Gavel}>
                                <p>
                                    <Trans i18nKey="legal.terms.sections.law.content1" components={{ strong: <strong /> }} />
                                </p>
                                <p>
                                    {t('legal.terms.sections.law.content2')}
                                </p>
                            </Section>

                            <Section title={t('legal.terms.sections.changes.title')} icon={ShieldAlert}>
                                <p>
                                    {t('legal.terms.sections.changes.content')}
                                </p>
                            </Section>

                            <Section title={t('legal.terms.sections.contact.title')} icon={FileText}>
                                <p>
                                    <Trans i18nKey="legal.terms.sections.contact.content" values={{ email: import.meta.env.VITE_LEGAL_EMAIL }} components={{ a: <a className="text-blue-600 hover:underline" /> }} />
                                </p>
                            </Section>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </LazyMotion>
    );
};

export default TermsOfServicePage;
