import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import ActivityLibrary from '../../components/admin/ActivityLibrary';
import { ActivityReview } from '../../components/admin/ActivityReview';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/Tabs';
import { useTranslation } from '../../hooks/useTranslation';

export default function AdminActivitiesPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState('library');

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if ((tabParam === 'library' || tabParam === 'review') && tabParam !== tab) {
      setTab(tabParam);
    }
  }, [searchParams, tab]);

  const handleTabChange = (nextTab) => {
    setTab(nextTab);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (nextTab === 'library') {
        next.delete('tab');
      } else {
        next.set('tab', nextTab);
      }
      return next;
    });
  };

  return (
    <Tabs value={tab} onValueChange={handleTabChange} className="space-y-6">
      <TabsList className="mb-6 inline-flex rounded-[0.8rem] border border-border bg-muted/60 p-1.5 shadow-inner">
        <TabsTrigger
          value="library"
          className="rounded-lg py-2 text-sm font-semibold transition-all duration-200 data-[state=active]:bg-card data-[state=active]:shadow"
        >
          {t('admin.activities.tab.library', 'Activity Library')}
        </TabsTrigger>
        <TabsTrigger
          value="review"
          className="rounded-lg py-2 text-sm font-semibold transition-all duration-200 data-[state=active]:bg-card data-[state=active]:shadow"
        >
          {t('admin.activities.tab.review', 'Record Review')}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="library">
        <ActivityLibrary />
      </TabsContent>
      <TabsContent value="review">
        <ActivityReview />
      </TabsContent>
    </Tabs>
  );
}
