import React from 'react';
import { m as Motion, LazyMotion, domAnimation } from 'framer-motion';
import PropTypes from 'prop-types';
import { Trans } from 'react-i18next';
import { Card, CardContent } from '../components/ui/Card';
import { Cookie, Settings, Info, Eye } from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';

const toItemKey = (prefix, item) => `${prefix}-${String(item).trim()}`;

const Section = ({ title, icon: Icon, children }) => (
    <Motion.div
        className="mb-8"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
    >
        <h2 className="text-xl md:text-2xl font-bold text-foreground mb-4 flex items-center gap-2">
            {Icon && <Icon className="h-6 w-6 text-orange-600" />}
            {title}
        </h2>
        <div className="text-muted-foreground leading-relaxed space-y-4">
            {children}
        </div>
    </Motion.div>
);

Section.propTypes = {
    title: PropTypes.node.isRequired,
    icon: PropTypes.elementType,
    children: PropTypes.node,
};

const CookiePolicyPage = () => {
    const { t } = useTranslation();
    const currentDate = new Date().toLocaleDateString();

    const thirdPartyItems = t('legal.cookies.sections.thirdParty.items', { returnObjects: true });

    return (
        <LazyMotion features={domAnimation}>
            <div className="min-h-screen bg-background text-foreground py-20 px-4 sm:px-6 lg:px-8">
                <div className="max-w-4xl mx-auto">
                    <Motion.div
                        className="text-center mb-12"
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                    >
                        <h1 className="text-4xl font-extrabold text-foreground mb-4">{t('legal.cookies.title')}</h1>
                        <p className="text-lg text-muted-foreground">
                            {t('legal.lastUpdated', { date: currentDate })}
                        </p>
                        <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
                            {t('legal.cookies.intro')}
                        </p>
                    </Motion.div>

                    <Card className="border-border/60 bg-card/85 backdrop-blur shadow-xl">
                        <CardContent className="p-8 md:p-12">
                            <Section title={t('legal.cookies.sections.what.title')} icon={Info}>
                                <p>{t('legal.cookies.sections.what.content')}</p>
                            </Section>

                            <Section title={t('legal.cookies.sections.how.title')} icon={Cookie}>
                                <p>{t('legal.cookies.sections.how.intro')}</p>
                                <div className="space-y-4 mt-4">
                                    <div className="rounded-lg border border-border bg-muted/50 p-4">
                                        <h3 className="font-bold text-foreground mb-2">
                                            {t('legal.cookies.sections.how.types.essential.title')}
                                        </h3>
                                        <p className="text-sm">
                                            {t('legal.cookies.sections.how.types.essential.desc')}
                                        </p>
                                    </div>
                                    <div className="rounded-lg border border-border bg-muted/50 p-4">
                                        <h3 className="font-bold text-foreground mb-2">
                                            {t('legal.cookies.sections.how.types.performance.title')}
                                        </h3>
                                        <p className="text-sm">
                                            {t('legal.cookies.sections.how.types.performance.desc')}
                                        </p>
                                    </div>
                                    <div className="rounded-lg border border-border bg-muted/50 p-4">
                                        <h3 className="font-bold text-foreground mb-2">
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
                                        <li key={toItemKey(`third-party-${index}`, item)}>
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
