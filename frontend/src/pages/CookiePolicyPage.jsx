import Silian_React from 'react';
import { m as Silian_Motion, LazyMotion as Silian_LazyMotion, domAnimation as Silian_domAnimation } from 'framer-motion';
import Silian_PropTypes from 'prop-types';
import { Trans as Silian_Trans } from 'react-i18next';
import { Card as Silian_Card, CardContent as Silian_CardContent } from '../components/ui/Card';
import { Cookie as Silian_Cookie, Settings as Silian_Settings, Info as Silian_Info, Eye as Silian_Eye } from 'lucide-react';
import { useTranslation as Silian_useTranslation } from '../hooks/useTranslation';

const Silian_toItemKey = (Silian_prefix, Silian_item) => `${Silian_prefix}-${String(Silian_item).trim()}`;

const Silian_Section = ({ title: Silian_title, icon: Silian_Icon, children: Silian_children }) => (
    <Silian_Motion.div
        className="mb-8"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
    >
        <h2 className="text-xl md:text-2xl font-bold text-foreground mb-4 flex items-center gap-2">
            {Silian_Icon && <Silian_Icon className="h-6 w-6 text-orange-600" />}
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

const Silian_CookiePolicyPage = () => {
    const { t: Silian_t } = Silian_useTranslation(['legal']);
    const Silian_currentDate = new Date().toLocaleDateString();

    const Silian_thirdPartyItems = Silian_t('legal.cookies.sections.thirdParty.items', { returnObjects: true });

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
                        <h1 className="text-4xl font-extrabold text-foreground mb-4">{Silian_t('legal.cookies.title')}</h1>
                        <p className="text-lg text-muted-foreground">
                            {Silian_t('legal.lastUpdated', { date: Silian_currentDate })}
                        </p>
                        <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
                            {Silian_t('legal.cookies.intro')}
                        </p>
                    </Silian_Motion.div>

                    <Silian_Card className="border-border/60 bg-card/85 backdrop-blur shadow-xl">
                        <Silian_CardContent className="p-8 md:p-12">
                            <Silian_Section title={Silian_t('legal.cookies.sections.what.title')} icon={Silian_Info}>
                                <p>{Silian_t('legal.cookies.sections.what.content')}</p>
                            </Silian_Section>

                            <Silian_Section title={Silian_t('legal.cookies.sections.how.title')} icon={Silian_Cookie}>
                                <p>{Silian_t('legal.cookies.sections.how.intro')}</p>
                                <div className="space-y-4 mt-4">
                                    <div className="rounded-lg border border-border bg-muted/50 p-4">
                                        <h3 className="font-bold text-foreground mb-2">
                                            {Silian_t('legal.cookies.sections.how.types.essential.title')}
                                        </h3>
                                        <p className="text-sm">
                                            {Silian_t('legal.cookies.sections.how.types.essential.desc')}
                                        </p>
                                    </div>
                                    <div className="rounded-lg border border-border bg-muted/50 p-4">
                                        <h3 className="font-bold text-foreground mb-2">
                                            {Silian_t('legal.cookies.sections.how.types.performance.title')}
                                        </h3>
                                        <p className="text-sm">
                                            {Silian_t('legal.cookies.sections.how.types.performance.desc')}
                                        </p>
                                    </div>
                                    <div className="rounded-lg border border-border bg-muted/50 p-4">
                                        <h3 className="font-bold text-foreground mb-2">
                                            {Silian_t('legal.cookies.sections.how.types.functionality.title')}
                                        </h3>
                                        <p className="text-sm">
                                            {Silian_t('legal.cookies.sections.how.types.functionality.desc')}
                                        </p>
                                    </div>
                                </div>
                            </Silian_Section>

                            <Silian_Section title={Silian_t('legal.cookies.sections.thirdParty.title')} icon={Silian_Eye}>
                                <p>{Silian_t('legal.cookies.sections.thirdParty.intro')}</p>
                                <ul className="list-disc pl-5">
                                    {Array.isArray(Silian_thirdPartyItems) && Silian_thirdPartyItems.map((Silian_item, Silian_index) => (
                                        <li key={Silian_toItemKey(`third-party-${Silian_index}`, Silian_item)}>
                                            <Silian_Trans defaults={Silian_item} components={{ strong: <strong /> }} />
                                        </li>
                                    ))}
                                </ul>
                            </Silian_Section>

                            <Silian_Section title={Silian_t('legal.cookies.sections.managing.title')} icon={Silian_Settings}>
                                <p>
                                    {Silian_t('legal.cookies.sections.managing.content1')}
                                </p>
                                <p>
                                    {Silian_t('legal.cookies.sections.managing.content2')}
                                </p>
                            </Silian_Section>

                            <Silian_Section title={Silian_t('legal.cookies.sections.updates.title')} icon={Silian_Info}>
                                <p>
                                    {Silian_t('legal.cookies.sections.updates.content')}
                                </p>
                            </Silian_Section>
                        </Silian_CardContent>
                    </Silian_Card>
                </div>
            </div>
        </Silian_LazyMotion>
    );
};

export default Silian_CookiePolicyPage;
