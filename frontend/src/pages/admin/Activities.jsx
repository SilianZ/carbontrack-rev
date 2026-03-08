import React, { useState } from 'react';
import ActivityLibrary from '../../components/admin/ActivityLibrary';
import { ActivityReview } from '../../components/admin/ActivityReview';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/Tabs';
import { useTranslation } from '../../hooks/useTranslation';

export default function AdminActivitiesPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState('library');

  return (
    <Tabs value={tab} onValueChange={setTab} className="space-y-6">
      <TabsList className="mb-6 inline-flex bg-slate-100/50 dark:bg-slate-800/50 p-1.5 rounded-[0.8rem] border border-slate-200 dark:border-slate-800 shadow-inner">
        <TabsTrigger
          value="library"
          className="rounded-lg py-2 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow text-sm font-semibold transition-all duration-200"
        >
          {t('admin.activities.tab.library', 'Activity Library')}
        </TabsTrigger>
        <TabsTrigger
          value="review"
          className="rounded-lg py-2 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow text-sm font-semibold transition-all duration-200"
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
