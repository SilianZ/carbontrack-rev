import React from 'react';
import { m, LazyMotion, domAnimation } from 'framer-motion';
import { Trans } from 'react-i18next';
import { Card, CardContent } from '../components/ui/Card';
import { Lock, Globe, Shield, Eye, Database, Server, Mail } from 'lucide-react';
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

const PrivacyPolicyPage = () => {
    const { t } = useTranslation();
    const currentDate = new Date().toLocaleDateString();

    const collectionItems = t('legal.privacy.sections.collection.items', { returnObjects: true });
    const usageItems = t('legal.privacy.sections.usage.items', { returnObjects: true });
    const storageItems = t('legal.privacy.sections.storage.items', { returnObjects: true });
    const rightsItems = t('legal.privacy.sections.rights.items', { returnObjects: true });

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
                        <h1 className="text-4xl font-extrabold text-gray-900 mb-4">{t('legal.privacy.title')}</h1>
                        <p className="text-lg text-gray-600">
                            {t('legal.lastUpdated', { date: currentDate })}
                        </p>
                        <p className="mt-4 text-gray-500 max-w-2xl mx-auto">
                            <Trans i18nKey="legal.privacy.intro" components={{ strong: <strong /> }} />
                        </p>
                    </m.div>

                    <Card className="bg-white/80 backdrop-blur shadow-xl border-none">
                        <CardContent className="p-8 md:p-12">
                            <Section title={t('legal.privacy.sections.identity.title')} icon={Globe}>
                                <p>
                                    <Trans i18nKey="legal.privacy.sections.identity.content1" components={{ strong: <strong /> }} />
                                </p>
                                <p>
                                    <Trans i18nKey="legal.privacy.sections.identity.content2" components={{ strong: <strong /> }} />
                                </p>
                            </Section>

                            <Section title={t('legal.privacy.sections.collection.title')} icon={Database}>
                                <p><Trans i18nKey="legal.privacy.sections.collection.intro" components={{ strong: <strong /> }} /></p>
                                <ul className="list-disc pl-5 space-y-2">
                                    {Array.isArray(collectionItems) && collectionItems.map((item, index) => (
                                        <li key={index}>
                                            <Trans defaults={item} components={{ strong: <strong /> }} />
                                        </li>
                                    ))}
                                </ul>
                            </Section>

                            <Section title={t('legal.privacy.sections.usage.title')} icon={Eye}>
                                <p><Trans i18nKey="legal.privacy.sections.usage.intro" components={{ strong: <strong /> }} /></p>
                                <ul className="list-disc pl-5 space-y-2">
                                    {Array.isArray(usageItems) && usageItems.map((item, index) => (
                                        <li key={index}>
                                            <Trans defaults={item} components={{ strong: <strong /> }} />
                                        </li>
                                    ))}
                                </ul>
                                <p>
                                    <Trans i18nKey="legal.privacy.sections.usage.marketing" components={{ strong: <strong /> }} />
                                </p>
                            </Section>

                            <Section title={t('legal.privacy.sections.storage.title')} icon={Server}>
                                <p>
                                    <Trans i18nKey="legal.privacy.sections.storage.content1" components={{ strong: <strong /> }} />
                                </p>
                                <p>
                                    <Trans i18nKey="legal.privacy.sections.storage.content2" components={{ strong: <strong /> }} />
                                </p>
                                <ul className="list-disc pl-5 mt-2">
                                    {Array.isArray(storageItems) && storageItems.map((item, index) => (
                                        <li key={index}>{item}</li>
                                    ))}
                                </ul>
                            </Section>

                            <Section title={t('legal.privacy.sections.rights.title')} icon={Shield}>
                                <p><Trans i18nKey="legal.privacy.sections.rights.intro" components={{ strong: <strong /> }} /></p>
                                <ul className="list-disc pl-5 space-y-2">
                                    {Array.isArray(rightsItems) && rightsItems.map((item, index) => (
                                        <li key={index}>
                                            <Trans defaults={item} components={{ strong: <strong /> }} />
                                        </li>
                                    ))}
                                </ul>
                                <p className="mt-4 text-sm bg-gray-100 p-4 rounded-lg">
                                    <Trans
                                        i18nKey="legal.privacy.sections.rights.contact"
                                        values={{ email: import.meta.env.VITE_PRIVACY_EMAIL }}
                                        components={{ a: <a className="text-blue-600 hover:underline" /> }}
                                    />
                                </p>
                            </Section>

                            <Section title={t('legal.privacy.sections.retention.title')} icon={Lock}>
                                <p>
                                    {t('legal.privacy.sections.retention.content1')}
                                </p>
                                <p>
                                    <Trans i18nKey="legal.privacy.sections.retention.content2" components={{ strong: <strong /> }} />
                                </p>
                            </Section>

                            <Section title={t('legal.privacy.sections.contact.title')} icon={Mail}>
                                <p>
                                    {t('legal.privacy.sections.contact.intro')}
                                </p>
                                <div className="mt-2">
                                    <Trans
                                        i18nKey="legal.privacy.sections.contact.details"
                                        values={{ email: import.meta.env.VITE_PRIVACY_EMAIL }}
                                        components={{ strong: <strong />, a: <a className="text-blue-600 hover:underline" />, br: <br /> }}
                                    />
                                </div>
                            </Section>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </LazyMotion>
    );
};

export default PrivacyPolicyPage;
