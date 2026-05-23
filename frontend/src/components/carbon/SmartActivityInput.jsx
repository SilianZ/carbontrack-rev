import Silian_React, { useState as Silian_useState } from 'react';
import { Sparkles as Silian_Sparkles, ArrowRight as Silian_ArrowRight, Loader2 as Silian_Loader2 } from 'lucide-react';
import { useTranslation as Silian_useTranslation } from '../../hooks/useTranslation';
import { Button as Silian_Button } from '../ui/Button';
import { Textarea as Silian_Textarea } from '../ui/textarea';
import { Card as Silian_Card, CardContent as Silian_CardContent } from '../ui/Card';
import { Alert as Silian_Alert, AlertDescription as Silian_AlertDescription } from '../ui/Alert';
import { carbonAPI as Silian_carbonAPI } from '../../lib/api';

export function SmartActivityInput({ onSuggestion: Silian_onSuggestion }) {
    const { t: Silian_t } = Silian_useTranslation(['activities', 'common', 'errors']);
    const [Silian_query, Silian_setQuery] = Silian_useState('');
    const [Silian_loading, Silian_setLoading] = Silian_useState(false);
    const [Silian_error, Silian_setError] = Silian_useState('');

    const Silian_handleSubmit = async (Silian_e) => {
        Silian_e.preventDefault();
        if (!Silian_query.trim()) return;

        Silian_setLoading(true);
        Silian_setError('');

        try {
            const Silian_timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            const Silian_response = await Silian_carbonAPI.suggestActivity(Silian_query, {
                client_time: new Date().toISOString(),
                client_timezone: Silian_timezone,
                entry: 'smart-activity-input'
            });
            if (Silian_response.data.success) {
                Silian_onSuggestion(Silian_response.data.prediction);
                Silian_setQuery(''); // Clear input on success
            } else {
                Silian_setError(Silian_response.data.error || 'Failed to analyze input');
            }
        } catch (Silian_err) {
            Silian_setError(Silian_err.response?.data?.error || Silian_err.message || 'Error communicating with AI assistant');
        } finally {
            Silian_setLoading(false);
        }
    };

    return (
        <Silian_Card className="mb-8 border-green-500/20 bg-gradient-to-r from-green-500/10 via-background to-sky-500/10">
            <Silian_CardContent className="pt-6">
                <div className="mb-4 flex items-center gap-2 text-green-500">
                    <Silian_Sparkles className="h-5 w-5" />
                    <h3 className="font-semibold">{Silian_t('activities.smartAdd.title') || 'Smart Add Activity'}</h3>
                </div>

                <form onSubmit={Silian_handleSubmit} className="space-y-4">
                    <div className="relative">
                        <Silian_Textarea
                            value={Silian_query}
                            onChange={(Silian_e) => Silian_setQuery(Silian_e.target.value)}
                            placeholder={Silian_t('activities.smartAdd.placeholder') || "Describe your activity, e.g., 'I took a 5km bus ride'"}
                            className="min-h-[80px] bg-background/80 pr-12 backdrop-blur-sm transition-all focus:bg-background"
                            maxLength={500}
                        />
                        <div className="absolute bottom-3 right-3 text-xs text-muted-foreground">
                            {Silian_query.length}/500
                        </div>
                    </div>

                    {Silian_error && (
                        <Silian_Alert variant="destructive" className="py-2">
                            <Silian_AlertDescription className="text-xs">{Silian_error}</Silian_AlertDescription>
                        </Silian_Alert>
                    )}

                    <div className="flex justify-end">
                        <Silian_Button
                            type="submit"
                            disabled={!Silian_query.trim() || Silian_loading}
                            className="bg-green-600 hover:bg-green-700 text-white shadow-md hover:shadow-lg transition-all"
                        >
                            {Silian_loading ? (
                                <>
                                    <Silian_Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    {Silian_t('common.processing') || 'Analyzing...'}
                                </>
                            ) : (
                                <>
                                    {Silian_t('activities.smartAdd.button') || 'Magic Fill'}
                                    <Silian_Sparkles className="ml-2 h-4 w-4" />
                                </>
                            )}
                        </Silian_Button>
                    </div>
                </form>
            </Silian_CardContent>
        </Silian_Card>
    );
}
