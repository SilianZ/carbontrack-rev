import Silian_React from 'react';
import { m as Silian_Motion, LazyMotion as Silian_LazyMotion, domAnimation as Silian_domAnimation } from 'framer-motion';
import { Trans as Silian_Trans } from 'react-i18next';
import { Card as Silian_Card, CardContent as Silian_CardContent } from '../components/ui/Card';
import { Scale as Silian_Scale, FileText as Silian_FileText, AlertTriangle as Silian_AlertTriangle, UserCheck as Silian_UserCheck, Gavel as Silian_Gavel, ShieldAlert as Silian_ShieldAlert } from 'lucide-react';
import { useTranslation as Silian_useTranslation } from '../hooks/useTranslation';

const Silian_Section = ({ title: Silian_title, icon: Silian_Icon, children: Silian_children }) => (
    <Silian_Motion.div
        className="mb-8"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
    >
        <h2 className="text-xl md:text-2xl font-bold text-foreground mb-4 flex items-center gap-2">
            {Silian_Icon && <Silian_Icon className="h-6 w-6 text-blue-600" />}
            {Silian_title}
        </h2>
        <div className="text-muted-foreground leading-relaxed space-y-4">
            {Silian_children}
        </div>
    </Silian_Motion.div>
);

const Silian_TermsOfServicePage = () => {
    const { t: Silian_t } = Silian_useTranslation(['contact', 'legal']);
    const Silian_currentDate = new Date().toLocaleDateString();

    const Silian_responsibilityItems = Silian_t('legal.terms.sections.responsibility.items', { returnObjects: true });

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
                        <h1 className="text-4xl font-extrabold text-foreground mb-4">{Silian_t('legal.terms.title')}</h1>
                        <p className="text-lg text-muted-foreground">
                            {Silian_t('legal.lastUpdated', { date: Silian_currentDate })}
                        </p>
                        <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
                            {Silian_t('legal.terms.intro')}
                        </p>
                    </Silian_Motion.div>

                    <Silian_Card className="border-border/60 bg-card/85 backdrop-blur shadow-xl">
                        <Silian_CardContent className="p-8 md:p-12">
                            <Silian_Section title={Silian_t('legal.terms.sections.agreement.title')} icon={Silian_FileText}>
                                <p>
                                    <Silian_Trans i18nKey="legal.terms.sections.agreement.content1" components={{ strong: <strong /> }} />
                                </p>
                                <p>
                                    <Silian_Trans i18nKey="legal.terms.sections.agreement.content2" components={{ strong: <strong /> }} />
                                </p>
                            </Silian_Section>

                            <Silian_Section title={Silian_t('legal.terms.sections.responsibility.title')} icon={Silian_UserCheck}>
                                <p>{Silian_t('legal.terms.sections.responsibility.intro')}</p>
                                <ul className="list-disc pl-5 space-y-2">
                                    {Array.isArray(Silian_responsibilityItems) && Silian_responsibilityItems.map((Silian_item, Silian_index) => (
                                        <li key={Silian_index}>
                                            <Silian_Trans defaults={Silian_item} components={{ strong: <strong /> }} />
                                        </li>
                                    ))}
                                </ul>
                            </Silian_Section>

                            <Silian_Section title={Silian_t('legal.terms.sections.ip.title')} icon={Silian_Scale}>
                                <p>
                                    {Silian_t('legal.terms.sections.ip.content')}
                                </p>
                            </Silian_Section>

                            <Silian_Section title={Silian_t('legal.terms.sections.liability.title')} icon={Silian_AlertTriangle}>
                                <p>
                                    {Silian_t('legal.terms.sections.liability.content')}
                                </p>
                            </Silian_Section>

                            <Silian_Section title={Silian_t('legal.terms.sections.law.title')} icon={Silian_Gavel}>
                                <p>
                                    <Silian_Trans i18nKey="legal.terms.sections.law.content1" components={{ strong: <strong /> }} />
                                </p>
                                <p>
                                    {Silian_t('legal.terms.sections.law.content2')}
                                </p>
                            </Silian_Section>

                            <Silian_Section title={Silian_t('legal.terms.sections.changes.title')} icon={Silian_ShieldAlert}>
                                <p>
                                    {Silian_t('legal.terms.sections.changes.content')}
                                </p>
                            </Silian_Section>

                            <Silian_Section title={Silian_t('legal.terms.sections.contact.title')} icon={Silian_FileText}>
                                <p>
                                    <Silian_Trans i18nKey="legal.terms.sections.contact.content" values={{ email: import.meta.env.VITE_LEGAL_EMAIL }} components={{ a: <a className="text-blue-600 hover:underline dark:text-blue-400" /> }} />
                                </p>
                            </Silian_Section>
                        </Silian_CardContent>
                    </Silian_Card>
                </div>
            </div>
        </Silian_LazyMotion>
    );
};

export default Silian_TermsOfServicePage;
