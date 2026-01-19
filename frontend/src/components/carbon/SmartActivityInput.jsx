import React, { useState } from 'react';
import { Sparkles, ArrowRight, Loader2 } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { Button } from '../ui/Button';
import { Textarea } from '../ui/textarea';
import { Card, CardContent } from '../ui/Card';
import { Alert, AlertDescription } from '../ui/Alert';
import { carbonAPI } from '../../lib/api';

export function SmartActivityInput({ onSuggestion }) {
    const { t } = useTranslation();
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!query.trim()) return;

        setLoading(true);
        setError('');

        try {
            const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            const response = await carbonAPI.suggestActivity(query, {
                client_time: new Date().toISOString(),
                client_timezone: timezone
            });
            if (response.data.success) {
                onSuggestion(response.data.prediction);
                setQuery(''); // Clear input on success
            } else {
                setError(response.data.error || 'Failed to analyze input');
            }
        } catch (err) {
            setError(err.response?.data?.error || err.message || 'Error communicating with AI assistant');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card className="bg-gradient-to-r from-green-50 to-blue-50 border-green-100 mb-8">
            <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-4 text-green-800">
                    <Sparkles className="h-5 w-5" />
                    <h3 className="font-semibold">{t('activities.smartAdd.title') || 'Smart Add Activity'}</h3>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="relative">
                        <Textarea
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder={t('activities.smartAdd.placeholder') || "Describe your activity, e.g., 'I took a 5km bus ride'"}
                            className="min-h-[80px] pr-12 bg-white/80 backdrop-blur-sm focus:bg-white transition-all"
                            maxLength={500}
                        />
                        <div className="absolute bottom-3 right-3 text-xs text-gray-400">
                            {query.length}/500
                        </div>
                    </div>

                    {error && (
                        <Alert variant="destructive" className="py-2">
                            <AlertDescription className="text-xs">{error}</AlertDescription>
                        </Alert>
                    )}

                    <div className="flex justify-end">
                        <Button
                            type="submit"
                            disabled={!query.trim() || loading}
                            className="bg-green-600 hover:bg-green-700 text-white shadow-md hover:shadow-lg transition-all"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    {t('common.processing') || 'Analyzing...'}
                                </>
                            ) : (
                                <>
                                    {t('activities.smartAdd.button') || 'Magic Fill'}
                                    <Sparkles className="ml-2 h-4 w-4" />
                                </>
                            )}
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}
