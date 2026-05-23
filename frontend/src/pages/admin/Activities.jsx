import Silian_React, { useEffect as Silian_useEffect, useState as Silian_useState } from 'react';
import { useSearchParams as Silian_useSearchParams } from 'react-router-dom';
import Silian_ActivityLibrary from '../../components/admin/ActivityLibrary';
import { ActivityReview as Silian_ActivityReview } from '../../components/admin/ActivityReview';
import { Tabs as Silian_Tabs, TabsList as Silian_TabsList, TabsTrigger as Silian_TabsTrigger, TabsContent as Silian_TabsContent } from '../../components/ui/Tabs';
import { useTranslation as Silian_useTranslation } from '../../hooks/useTranslation';

export default function AdminActivitiesPage() {
  const { t: Silian_t } = Silian_useTranslation(['activities', 'admin']);
  const [Silian_searchParams, Silian_setSearchParams] = Silian_useSearchParams();
  const [Silian_tab, Silian_setTab] = Silian_useState('library');

  Silian_useEffect(() => {
    const Silian_tabParam = Silian_searchParams.get('tab');
    if ((Silian_tabParam === 'library' || Silian_tabParam === 'review') && Silian_tabParam !== Silian_tab) {
      Silian_setTab(Silian_tabParam);
    }
  }, [Silian_searchParams, Silian_tab]);

  const Silian_handleTabChange = (Silian_nextTab) => {
    Silian_setTab(Silian_nextTab);
    Silian_setSearchParams((Silian_prev) => {
      const Silian_next = new URLSearchParams(Silian_prev);
      if (Silian_nextTab === 'library') {
        Silian_next.delete('tab');
      } else {
        Silian_next.set('tab', Silian_nextTab);
      }
      return Silian_next;
    });
  };

  return (
    <Silian_Tabs value={Silian_tab} onValueChange={Silian_handleTabChange} className="space-y-6">
      <Silian_TabsList className="mb-6 inline-flex rounded-[0.8rem] border border-border bg-muted/60 p-1.5 shadow-inner">
        <Silian_TabsTrigger
          value="library"
          className="rounded-lg py-2 text-sm font-semibold transition-all duration-200 data-[state=active]:bg-card data-[state=active]:shadow"
        >
          {Silian_t('admin.activities.tab.library', 'Activity Library')}
        </Silian_TabsTrigger>
        <Silian_TabsTrigger
          value="review"
          className="rounded-lg py-2 text-sm font-semibold transition-all duration-200 data-[state=active]:bg-card data-[state=active]:shadow"
        >
          {Silian_t('admin.activities.tab.review', 'Record Review')}
        </Silian_TabsTrigger>
      </Silian_TabsList>
      <Silian_TabsContent value="library">
        <Silian_ActivityLibrary />
      </Silian_TabsContent>
      <Silian_TabsContent value="review">
        <Silian_ActivityReview />
      </Silian_TabsContent>
    </Silian_Tabs>
  );
}
