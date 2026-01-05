import React from 'react';
import { m, LazyMotion, domAnimation } from 'framer-motion';
import { Trans } from 'react-i18next';
import { Card, CardContent } from '../components/ui/Card';
import { ShieldCheck, Lock, AlertCircle, Bug, Server, FileCheck } from 'lucide-react';
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
            {Icon && <Icon className="h-6 w-6 text-green-600" />}
            {title}
        </h2>
        <div className="text-gray-600 leading-relaxed space-y-4">
            {children}
        </div>
    </m.div>
);

const SecurityPage = () => {
    const { t } = useTranslation();

    const infraItems = t('legal.security.sections.infrastructure.items', { returnObjects: true });
    const appItems = t('legal.security.sections.app.items', { returnObjects: true });
    const vulnItems = t('legal.security.sections.vuln.items', { returnObjects: true });

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
                        <h1 className="text-4xl font-extrabold text-gray-900 mb-4">{t('legal.security.title')}</h1>
                        <p className="text-lg text-gray-600">
                            {t('legal.security.subtitle')}
                        </p>
                    </m.div>
                    <Card className="bg-white/80 backdrop-blur shadow-xl border-none">
                        <CardContent className="p-8 md:p-12">
                            <Section title={t('legal.security.sections.commitment.title')} icon={ShieldCheck}>
                                <p>
                                    {t('legal.security.sections.commitment.content')}
                                </p>
                            </Section>

                            <Section title={t('legal.security.sections.infrastructure.title')} icon={Server}>
                                <p>
                                    {t('legal.security.sections.infrastructure.intro')}
                                </p>
                                <ul className="list-disc pl-5 mt-2 space-y-2">
                                    {Array.isArray(infraItems) && infraItems.map((item, index) => (
                                        <li key={index}>
                                            <Trans defaults={item} components={{ strong: <strong /> }} />
                                        </li>
                                    ))}
                                </ul>
                            </Section>

                            <Section title={t('legal.security.sections.app.title')} icon={Lock}>
                                <ul className="list-disc pl-5 mt-2 space-y-2">
                                    {Array.isArray(appItems) && appItems.map((item, index) => (
                                        <li key={index}>
                                            <Trans defaults={item} components={{ strong: <strong /> }} />
                                        </li>
                                    ))}
                                </ul>
                            </Section>

                            <Section title={t('legal.security.sections.vuln.title')} icon={Bug}>
                                <p>
                                    {t('legal.security.sections.vuln.intro')}
                                </p>
                                <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg mt-4">
                                    <h3 className="font-bold text-blue-900 mb-2">{t('legal.security.sections.vuln.policyTitle')}</h3>
                                    <p className="text-sm text-blue-800 mb-2">
                                        <Trans
                                            i18nKey="legal.security.sections.vuln.contact"
                                            values={{ email: import.meta.env.VITE_SECURITY_EMAIL }}
                                            components={{ a: <a className="underline font-semibold" /> }}
                                        />
                                    </p>
                                    <ul className="list-disc pl-5 text-sm text-blue-800">
                                        {Array.isArray(vulnItems) && vulnItems.map((item, index) => (
                                            <li key={index}>{item}</li>
                                        ))}
                                    </ul>
                                </div>
                            </Section>

                            <Section title={t('legal.security.sections.breach.title')} icon={AlertCircle}>
                                <p>
                                    <Trans i18nKey="legal.security.sections.breach.content" components={{ strong: <strong /> }} />
                                </p>
                            </Section>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </LazyMotion>
    );
};

export default SecurityPage;
