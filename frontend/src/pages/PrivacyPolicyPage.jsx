import Silian_React from 'react';
import { m as Silian_Motion, LazyMotion as Silian_LazyMotion, domAnimation as Silian_domAnimation } from 'framer-motion';
import Silian_PropTypes from 'prop-types';
import { Trans as Silian_Trans } from 'react-i18next';
import { Card as Silian_Card, CardContent as Silian_CardContent } from '../components/ui/Card';
import { Lock as Silian_Lock, Globe as Silian_Globe, Shield as Silian_Shield, Eye as Silian_Eye, Database as Silian_Database, Server as Silian_Server, Mail as Silian_Mail } from 'lucide-react';
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

const Silian_PrivacyPolicyPage = () => {
    const { t: Silian_t } = Silian_useTranslation(['contact', 'legal']);
    const Silian_currentDate = new Date().toLocaleDateString();

    const Silian_collectionItems = Silian_t('legal.privacy.sections.collection.items', { returnObjects: true });
    const Silian_usageItems = Silian_t('legal.privacy.sections.usage.items', { returnObjects: true });
    const Silian_storageItems = Silian_t('legal.privacy.sections.storage.items', { returnObjects: true });
    const Silian_rightsItems = Silian_t('legal.privacy.sections.rights.items', { returnObjects: true });

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
                        <h1 className="text-4xl font-extrabold text-foreground mb-4">{Silian_t('legal.privacy.title')}</h1>
                        <p className="text-lg text-muted-foreground">
                            {Silian_t('legal.lastUpdated', { date: Silian_currentDate })}
                        </p>
                        <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
                            <Silian_Trans i18nKey="legal.privacy.intro" components={{ strong: <strong /> }} />
                        </p>
                    </Silian_Motion.div>

                    <Silian_Card className="border-border/60 bg-card/85 backdrop-blur shadow-xl">
                        <Silian_CardContent className="p-8 md:p-12">
                            <Silian_Section title={Silian_t('legal.privacy.sections.identity.title')} icon={Silian_Globe}>
                                <p>
                                    <Silian_Trans i18nKey="legal.privacy.sections.identity.content1" components={{ strong: <strong /> }} />
                                </p>
                                <p>
                                    <Silian_Trans i18nKey="legal.privacy.sections.identity.content2" components={{ strong: <strong /> }} />
                                </p>
                            </Silian_Section>

                            <Silian_Section title={Silian_t('legal.privacy.sections.collection.title')} icon={Silian_Database}>
                                <p><Silian_Trans i18nKey="legal.privacy.sections.collection.intro" components={{ strong: <strong /> }} /></p>
                                <ul className="list-disc pl-5 space-y-2">
                                    {Array.isArray(Silian_collectionItems) && Silian_collectionItems.map((Silian_item, Silian_index) => (
                                        <li key={Silian_toItemKey(`collection-${Silian_index}`, Silian_item)}>
                                            <Silian_Trans defaults={Silian_item} components={{ strong: <strong /> }} />
                                        </li>
                                    ))}
                                </ul>
                            </Silian_Section>

                            <Silian_Section title={Silian_t('legal.privacy.sections.usage.title')} icon={Silian_Eye}>
                                <p><Silian_Trans i18nKey="legal.privacy.sections.usage.intro" components={{ strong: <strong /> }} /></p>
                                <ul className="list-disc pl-5 space-y-2">
                                    {Array.isArray(Silian_usageItems) && Silian_usageItems.map((Silian_item, Silian_index) => (
                                        <li key={Silian_toItemKey(`usage-${Silian_index}`, Silian_item)}>
                                            <Silian_Trans defaults={Silian_item} components={{ strong: <strong /> }} />
                                        </li>
                                    ))}
                                </ul>
                                <p>
                                    <Silian_Trans i18nKey="legal.privacy.sections.usage.marketing" components={{ strong: <strong /> }} />
                                </p>
                            </Silian_Section>

                            <Silian_Section title={Silian_t('legal.privacy.sections.storage.title')} icon={Silian_Server}>
                                <p>
                                    <Silian_Trans i18nKey="legal.privacy.sections.storage.content1" components={{ strong: <strong /> }} />
                                </p>
                                <p>
                                    <Silian_Trans i18nKey="legal.privacy.sections.storage.content2" components={{ strong: <strong /> }} />
                                </p>
                                <ul className="list-disc pl-5 mt-2">
                                    {Array.isArray(Silian_storageItems) && Silian_storageItems.map((Silian_item, Silian_index) => (
                                        <li key={Silian_toItemKey(`storage-${Silian_index}`, Silian_item)}>{Silian_item}</li>
                                    ))}
                                </ul>
                            </Silian_Section>

                            <Silian_Section title={Silian_t('legal.privacy.sections.rights.title')} icon={Silian_Shield}>
                                <p><Silian_Trans i18nKey="legal.privacy.sections.rights.intro" components={{ strong: <strong /> }} /></p>
                                <ul className="list-disc pl-5 space-y-2">
                                    {Array.isArray(Silian_rightsItems) && Silian_rightsItems.map((Silian_item, Silian_index) => (
                                        <li key={Silian_toItemKey(`rights-${Silian_index}`, Silian_item)}>
                                            <Silian_Trans defaults={Silian_item} components={{ strong: <strong /> }} />
                                        </li>
                                    ))}
                                </ul>
                                <p className="mt-4 rounded-lg bg-muted/60 p-4 text-sm">
                                    <Silian_Trans
                                        i18nKey="legal.privacy.sections.rights.contact"
                                        values={{ email: import.meta.env.VITE_PRIVACY_EMAIL }}
                                        components={{ a: <a href={Silian_toMailtoLink(import.meta.env.VITE_PRIVACY_EMAIL)} className="text-blue-600 hover:underline dark:text-blue-400" /> }}
                                    />
                                </p>
                            </Silian_Section>

                            <Silian_Section title={Silian_t('legal.privacy.sections.retention.title')} icon={Silian_Lock}>
                                <p>
                                    {Silian_t('legal.privacy.sections.retention.content1')}
                                </p>
                                <p>
                                    <Silian_Trans i18nKey="legal.privacy.sections.retention.content2" components={{ strong: <strong /> }} />
                                </p>
                            </Silian_Section>

                            <Silian_Section title={Silian_t('legal.privacy.sections.contact.title')} icon={Silian_Mail}>
                                <p>
                                    {Silian_t('legal.privacy.sections.contact.intro')}
                                </p>
                                <div className="mt-2">
                                    <Silian_Trans
                                        i18nKey="legal.privacy.sections.contact.details"
                                        values={{ email: import.meta.env.VITE_PRIVACY_EMAIL }}
                                        components={{ strong: <strong />, a: <a href={Silian_toMailtoLink(import.meta.env.VITE_PRIVACY_EMAIL)} className="text-blue-600 hover:underline dark:text-blue-400" />, br: <br /> }}
                                    />
                                </div>
                            </Silian_Section>
                        </Silian_CardContent>
                    </Silian_Card>
                </div>
            </div>
        </Silian_LazyMotion>
    );
};

export default Silian_PrivacyPolicyPage;
