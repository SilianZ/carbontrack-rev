import Silian_React from 'react';
import { m as Silian_Motion, LazyMotion as Silian_LazyMotion, domAnimation as Silian_domAnimation } from 'framer-motion';
import Silian_PropTypes from 'prop-types';
import { Trans as Silian_Trans } from 'react-i18next';
import { Card as Silian_Card, CardContent as Silian_CardContent } from '../components/ui/Card';
import { ShieldCheck as Silian_ShieldCheck, Lock as Silian_Lock, AlertCircle as Silian_AlertCircle, Bug as Silian_Bug, Server as Silian_Server } from 'lucide-react';
import { useTranslation as Silian_useTranslation } from '../hooks/useTranslation';

const Silian_toItemKey = (Silian_prefix, Silian_item) => `${Silian_prefix}-${String(Silian_item).trim()}`;

const Silian_toMailtoLink = (Silian_email) => `mailto:${String(Silian_email || '').trim()}`;

const Silian_Section = ({ title: Silian_title, icon: Silian_Icon, children: Silian_children }) => (
    <Silian_Motion.div
        className="mb-8"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
    >
        <h2 className="text-xl md:text-2xl font-bold text-foreground mb-4 flex items-center gap-2">
            {Silian_Icon && <Silian_Icon className="h-6 w-6 text-green-600" />}
            {Silian_title}
        </h2>
        <div className="text-muted-foreground leading-relaxed space-y-4">
            {Silian_children}
        </div>
    </Silian_Motion.div>
);

Silian_Section.propTypes = {
    title: Silian_PropTypes.node.isRequired,
    icon: Silian_PropTypes.elementType,
    children: Silian_PropTypes.node,
};

const Silian_SecurityPage = () => {
    const { t: Silian_t } = Silian_useTranslation(['app', 'legal']);

    const Silian_infraItems = Silian_t('legal.security.sections.infrastructure.items', { returnObjects: true });
    const Silian_appItems = Silian_t('legal.security.sections.app.items', { returnObjects: true });
    const Silian_vulnItems = Silian_t('legal.security.sections.vuln.items', { returnObjects: true });

    return (
        <Silian_LazyMotion features={Silian_domAnimation}>
            <div className="min-h-screen bg-background text-foreground py-20 px-4 sm:px-6 lg:px-8">
                <div className="max-w-4xl mx-auto">
                    <Silian_Motion.div
                        className="text-center mb-12"
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                    >
                        <h1 className="text-4xl font-extrabold text-foreground mb-4">{Silian_t('legal.security.title')}</h1>
                        <p className="text-lg text-muted-foreground">
                            {Silian_t('legal.security.subtitle')}
                        </p>
                    </Silian_Motion.div>
                    <Silian_Card className="border-border/60 bg-card/85 backdrop-blur shadow-xl">
                        <Silian_CardContent className="p-8 md:p-12">
                            <Silian_Section title={Silian_t('legal.security.sections.commitment.title')} icon={Silian_ShieldCheck}>
                                <p>
                                    {Silian_t('legal.security.sections.commitment.content')}
                                </p>
                            </Silian_Section>

                            <Silian_Section title={Silian_t('legal.security.sections.infrastructure.title')} icon={Silian_Server}>
                                <p>
                                    {Silian_t('legal.security.sections.infrastructure.intro')}
                                </p>
                                <ul className="list-disc pl-5 mt-2 space-y-2">
                                    {Array.isArray(Silian_infraItems) && Silian_infraItems.map((Silian_item, Silian_index) => (
                                        <li key={Silian_toItemKey(`infra-${Silian_index}`, Silian_item)}>
                                            <Silian_Trans defaults={Silian_item} components={{ strong: <strong /> }} />
                                        </li>
                                    ))}
                                </ul>
                            </Silian_Section>

                            <Silian_Section title={Silian_t('legal.security.sections.app.title')} icon={Silian_Lock}>
                                <ul className="list-disc pl-5 mt-2 space-y-2">
                                    {Array.isArray(Silian_appItems) && Silian_appItems.map((Silian_item, Silian_index) => (
                                        <li key={Silian_toItemKey(`app-${Silian_index}`, Silian_item)}>
                                            <Silian_Trans defaults={Silian_item} components={{ strong: <strong /> }} />
                                        </li>
                                    ))}
                                </ul>
                            </Silian_Section>

                            <Silian_Section title={Silian_t('legal.security.sections.vuln.title')} icon={Silian_Bug}>
                                <p>
                                    {Silian_t('legal.security.sections.vuln.intro')}
                                </p>
                                <div className="mt-4 rounded-lg border border-blue-500/20 bg-blue-500/10 p-4">
                                    <h3 className="font-bold text-blue-700 dark:text-blue-300 mb-2">{Silian_t('legal.security.sections.vuln.policyTitle')}</h3>
                                    <p className="mb-2 text-sm text-blue-700 dark:text-blue-300">
                                        <Silian_Trans
                                            i18nKey="legal.security.sections.vuln.contact"
                                            values={{ email: import.meta.env.VITE_SECURITY_EMAIL }}
                                            components={{ a: <a href={Silian_toMailtoLink(import.meta.env.VITE_SECURITY_EMAIL)} className="underline font-semibold" /> }}
                                        />
                                    </p>
                                    <ul className="list-disc pl-5 text-sm text-blue-700 dark:text-blue-300">
                                        {Array.isArray(Silian_vulnItems) && Silian_vulnItems.map((Silian_item, Silian_index) => (
                                            <li key={Silian_toItemKey(`vuln-${Silian_index}`, Silian_item)}>{Silian_item}</li>
                                        ))}
                                    </ul>
                                </div>
                            </Silian_Section>

                            <Silian_Section title={Silian_t('legal.security.sections.breach.title')} icon={Silian_AlertCircle}>
                                <p>
                                    <Silian_Trans i18nKey="legal.security.sections.breach.content" components={{ strong: <strong /> }} />
                                </p>
                            </Silian_Section>
                        </Silian_CardContent>
                    </Silian_Card>
                </div>
            </div>
        </Silian_LazyMotion>
    );
};

export default Silian_SecurityPage;
