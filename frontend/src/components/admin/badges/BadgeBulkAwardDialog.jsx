import Silian_React, { useEffect as Silian_useEffect, useMemo as Silian_useMemo, useState as Silian_useState } from 'react';
import { Dialog as Silian_Dialog, DialogContent as Silian_DialogContent, DialogDescription as Silian_DialogDescription, DialogHeader as Silian_DialogHeader, DialogTitle as Silian_DialogTitle } from '@/components/ui/dialog';
import { Button as Silian_Button } from '@/components/ui/Button';
import { Input as Silian_Input } from '@/components/ui/Input';
import { Badge as Silian_Badge } from '@/components/ui/badge';
import { Checkbox as Silian_Checkbox } from '@/components/ui/checkbox';
import { ScrollArea as Silian_ScrollArea } from '@/components/ui/scroll-area';
import { Separator as Silian_Separator } from '@/components/ui/separator';
import { Loader2 as Silian_Loader2, Award as Silian_Award, UserPlus as Silian_UserPlus, Users as Silian_UsersIcon, X as Silian_X, UserMinus as Silian_UserMinus } from 'lucide-react';
import { useTranslation as Silian_useTranslation } from '@/hooks/useTranslation';
import { useQuery as Silian_useQuery } from 'react-query';
import { adminAPI as Silian_adminAPI } from '@/lib/api';
import { toast as Silian_toast } from 'react-hot-toast';
import { cn as Silian_cn } from '@/lib/utils';

function Silian_useDebouncedValue(Silian_value, Silian_delay = 400) {
  const [Silian_debounced, Silian_setDebounced] = Silian_useState(Silian_value);
  Silian_useEffect(() => {
    const Silian_timer = setTimeout(() => Silian_setDebounced(Silian_value), Silian_delay);
    return () => clearTimeout(Silian_timer);
  }, [Silian_value, Silian_delay]);
  return Silian_debounced;
}

const Silian_getUserRows = (Silian_response) => {
  const Silian_nested = Silian_response?.data?.data ?? Silian_response?.data ?? {};
  if (Array.isArray(Silian_nested?.users)) {
    return Silian_nested.users;
  }
  if (Array.isArray(Silian_nested?.data?.users)) {
    return Silian_nested.data.users;
  }
  return [];
};

const Silian_countLabel = (Silian_t, Silian_count, Silian_key) => Silian_t(Silian_key, '{{count}} 个', { count: Silian_count });

export function BadgeBulkAwardDialog({
  open: Silian_open,
  onOpenChange: Silian_onOpenChange,
  badges: Silian_badges = [],
  defaultSelectedBadgeIds: Silian_defaultSelectedBadgeIds = [],
  presetUsers: Silian_presetUsers = [],
  onCompleted: Silian_onCompleted,
  mode: Silian_mode = 'award',
}) {
  const { t: Silian_t } = Silian_useTranslation(['admin', 'common']);
  const Silian_isRevoke = Silian_mode === 'revoke';
  const Silian_i18nBase = Silian_useMemo(
    () => ['admin', 'badges', Silian_isRevoke ? 'bulkRevokeDialog' : 'bulkAwardDialog'],
    [Silian_isRevoke]
  );
  const [Silian_selectedBadgeIds, Silian_setSelectedBadgeIds] = Silian_useState(() => new Set(Silian_defaultSelectedBadgeIds));
  const [Silian_searchTerm, Silian_setSearchTerm] = Silian_useState('');
  const [Silian_selectedUsers, Silian_setSelectedUsers] = Silian_useState(Silian_presetUsers);
  const [Silian_submitting, Silian_setSubmitting] = Silian_useState(false);
  const [Silian_progressState, Silian_setProgressState] = Silian_useState(null);

  const Silian_debouncedSearch = Silian_useDebouncedValue(Silian_searchTerm.trim(), 400);

  Silian_useEffect(() => {
    if (Silian_open) {
      Silian_setSelectedBadgeIds(new Set(Silian_defaultSelectedBadgeIds));
      if (Silian_presetUsers?.length) {
        Silian_setSelectedUsers((Silian_prev) => {
          const Silian_merged = new Map();
          [...Silian_presetUsers, ...Silian_prev].forEach((Silian_user) => {
            if (Silian_user && typeof Silian_user.id !== 'undefined') {
              Silian_merged.set(Silian_user.id, Silian_user);
            }
          });
          return Array.from(Silian_merged.values());
        });
      }
    } else {
      Silian_setProgressState(null);
      Silian_setSearchTerm('');
    }
  }, [Silian_open, Silian_defaultSelectedBadgeIds, Silian_presetUsers]);

  const Silian_badgeMap = Silian_useMemo(() => new Map(Silian_badges.map((Silian_badge) => [Silian_badge.id, Silian_badge])), [Silian_badges]);
  const Silian_badgeChoices = Silian_useMemo(() => [...Silian_badges].sort((Silian_a, Silian_b) => (Silian_b?.sort_order ?? 0) - (Silian_a?.sort_order ?? 0)), [Silian_badges]);

  const Silian_badgeSummary = Silian_useMemo(() => {
    const Silian_selected = Array.from(Silian_selectedBadgeIds);
    if (!Silian_selected.length) {
      return Silian_t([...Silian_i18nBase, 'noBadgeSelected'].join('.'));
    }
    if (Silian_selected.length === 1) {
      const Silian_badge = Silian_badgeMap.get(Silian_selected[0]);
      return Silian_badge?.name_zh || Silian_badge?.name_en || ('#' + Silian_selected[0]);
    }
    return Silian_countLabel(Silian_t, Silian_selected.length, [...Silian_i18nBase, 'badgeCountSummary'].join('.'));
  }, [Silian_badgeMap, Silian_selectedBadgeIds, Silian_t, Silian_i18nBase]);

  const { data: Silian_usersData, isLoading: Silian_isUsersLoading, isFetching: Silian_isUsersFetching } = Silian_useQuery(
    ['admin', 'users', Silian_isRevoke ? 'badge-revoke-search' : 'badge-award-search', Silian_debouncedSearch],
    async () => {
      const Silian_response = await Silian_adminAPI.getUsers({ search: Silian_debouncedSearch, limit: 20 });
      return Silian_getUserRows(Silian_response);
    },
    {
      enabled: Silian_open && Silian_debouncedSearch.length >= 1,
      keepPreviousData: true,
    }
  );

  const Silian_usersResult = Silian_usersData || [];

  const Silian_toggleBadge = (Silian_badgeId) => {
    Silian_setSelectedBadgeIds((Silian_prev) => {
      const Silian_next = new Set(Silian_prev);
      if (Silian_next.has(Silian_badgeId)) {
        Silian_next.delete(Silian_badgeId);
      } else {
        Silian_next.add(Silian_badgeId);
      }
      return Silian_next;
    });
  };

  const Silian_handleSelectAllBadges = () => {
    if (Silian_selectedBadgeIds.size === Silian_badgeChoices.length) {
      Silian_setSelectedBadgeIds(new Set());
    } else {
      Silian_setSelectedBadgeIds(new Set(Silian_badgeChoices.map((Silian_badge) => Silian_badge.id)));
    }
  };

  const Silian_handleAddUser = (Silian_user) => {
    if (!Silian_user || typeof Silian_user.id === 'undefined') return;
    Silian_setSelectedUsers((Silian_prev) => {
      if (Silian_prev.some((Silian_item) => Silian_item.id === Silian_user.id)) {
        return Silian_prev;
      }
      return [...Silian_prev, Silian_user];
    });
  };

  const Silian_handleRemoveUser = (Silian_userId) => {
    Silian_setSelectedUsers((Silian_prev) => Silian_prev.filter((Silian_item) => Silian_item.id !== Silian_userId));
  };

  const Silian_executeAction = Silian_isRevoke ? Silian_adminAPI.revokeBadge : Silian_adminAPI.awardBadge;

  const Silian_handleSubmit = async () => {
    const Silian_badgeIds = Array.from(Silian_selectedBadgeIds);
    if (!Silian_badgeIds.length) {
      Silian_toast.error(Silian_t([...Silian_i18nBase, 'selectBadgeError'].join('.')));
      return;
    }
    if (!Silian_selectedUsers.length) {
      Silian_toast.error(Silian_t([...Silian_i18nBase, 'selectUserError'].join('.')));
      return;
    }

    Silian_setSubmitting(true);
    Silian_setProgressState({ processed: 0, total: Silian_badgeIds.length * Silian_selectedUsers.length, success: 0, failed: 0 });

    let Silian_success = 0;
    let Silian_failed = 0;
    const Silian_failures = [];

    for (const Silian_badgeId of Silian_badgeIds) {
      for (const Silian_user of Silian_selectedUsers) {
        try {
          await Silian_executeAction(Silian_badgeId, { user_id: Silian_user.id });
          Silian_success += 1;
        } catch (Silian_err) {
          Silian_failed += 1;
          Silian_failures.push({
            badgeId: Silian_badgeId,
            user: Silian_user,
            message: Silian_err?.response?.data?.message || Silian_err?.message || 'Unknown error',
          });
        } finally {
          Silian_setProgressState((Silian_prev) => {
            const Silian_processed = (Silian_prev?.processed ?? 0) + 1;
            return { processed: Silian_processed, total: Silian_badgeIds.length * Silian_selectedUsers.length, success: Silian_success, failed: Silian_failed };
          });
        }
      }
    }

    Silian_setSubmitting(false);

    if (Silian_success) {
      Silian_toast.success(
        Silian_t([...Silian_i18nBase, 'success'].join('.'),  { count: Silian_success })
      );
    }
    if (Silian_failed) {
      Silian_toast.error(
        Silian_t([...Silian_i18nBase, 'partialFailed'].join('.'),  { failed: Silian_failed })
      );
    }

    Silian_onCompleted?.({ success: Silian_success, failed: Silian_failed, failures: Silian_failures });
    if (!Silian_failed) {
      Silian_onOpenChange(false);
    }
  };

  const Silian_renderBadgeCard = (Silian_badge) => {
    const Silian_checked = Silian_selectedBadgeIds.has(Silian_badge.id);
    const Silian_handleKeyDown = (Silian_event) => {
      if (Silian_event.key === 'Enter' || Silian_event.key === ' ') {
        Silian_event.preventDefault();
        Silian_toggleBadge(Silian_badge.id);
      }
    };

    return (
      <div
        key={Silian_badge.id}
        role="button"
        tabIndex={0}
        aria-pressed={Silian_checked}
        className={Silian_cn(
          'flex w-full flex-col items-start gap-2 rounded-lg border p-4 text-left transition hover:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40',
          Silian_checked ? 'border-primary bg-primary/5' : 'border-border'
        )}
        onClick={() => Silian_toggleBadge(Silian_badge.id)}
        onKeyDown={Silian_handleKeyDown}
      >
        <div className="flex w-full items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Silian_Award className={Silian_cn('h-5 w-5', Silian_checked ? 'text-primary' : 'text-muted-foreground')} />
            <span className="font-medium leading-tight">{Silian_badge.name_zh || Silian_badge.name_en}</span>
          </div>
          <Silian_Checkbox
            checked={Silian_checked}
            onCheckedChange={() => Silian_toggleBadge(Silian_badge.id)}
            onClick={(Silian_event) => Silian_event.stopPropagation()}
            onKeyDown={(Silian_event) => Silian_event.stopPropagation()}
          />
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2">
          {Silian_badge.description_zh || Silian_badge.description_en || Silian_t([...Silian_i18nBase, 'noDescription'].join('.'))}
        </p>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Silian_Badge variant={Silian_badge.is_active ? 'success' : 'secondary'}>
            {Silian_badge.is_active ? Silian_t('admin.badges.active') : Silian_t('admin.badges.inactive')}
          </Silian_Badge>
          {Silian_badge.auto_grant_enabled ? (
            <Silian_Badge variant="outline">{Silian_t('admin.badges.autoEnabled')}</Silian_Badge>
          ) : null}
        </div>
      </div>
    );
  };

  const Silian_renderUserResult = (Silian_user) => {
    const Silian_alreadySelected = Silian_selectedUsers.some((Silian_item) => Silian_item.id === Silian_user.id);
    return (
      <div key={Silian_user.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
        <div className="min-w-0">
          <p className="text-sm font-medium leading-tight">{Silian_user.username || Silian_user.email || ('#' + Silian_user.id)}</p>
          <p className="text-xs text-muted-foreground">
            {Silian_user.email || Silian_t([...Silian_i18nBase, 'noEmail'].join('.'))} · ID: {Silian_user.id}
          </p>
        </div>
        <Silian_Button
          type="button"
          size="sm"
          variant={Silian_alreadySelected ? 'secondary' : 'outline'}
          onClick={() => (Silian_alreadySelected ? Silian_handleRemoveUser(Silian_user.id) : Silian_handleAddUser(Silian_user))}
        >
          {Silian_alreadySelected ? Silian_t('common.remove') : Silian_t('common.add')}
        </Silian_Button>
      </div>
    );
  };

  const Silian_IconAction = Silian_isRevoke ? Silian_UserMinus : Silian_UserPlus;

  return (
    <Silian_Dialog open={Silian_open} onOpenChange={Silian_onOpenChange}>
      <Silian_DialogContent className="max-w-4xl">
        <Silian_DialogHeader>
          <Silian_DialogTitle>
            {Silian_t([...Silian_i18nBase, 'dialogTitle'].join('.'))}
          </Silian_DialogTitle>
          <Silian_DialogDescription>
            {Silian_t([...Silian_i18nBase, 'dialogDescription'].join('.'))}
          </Silian_DialogDescription>
        </Silian_DialogHeader>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold leading-none tracking-tight">
                {Silian_t([...Silian_i18nBase, 'badgeSelection'].join('.'))}
              </h3>
              <Silian_Button variant="ghost" size="sm" onClick={Silian_handleSelectAllBadges}>
                {Silian_selectedBadgeIds.size === Silian_badgeChoices.length
                  ? Silian_t([...Silian_i18nBase, 'clearAllBadges'].join('.'))
                  : Silian_t([...Silian_i18nBase, 'selectAllBadges'].join('.'))}
              </Silian_Button>
            </div>
            <Silian_ScrollArea className="h-72 rounded-lg border">
              <div className="grid gap-3 p-3">
                {Silian_badgeChoices.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    {Silian_t([...Silian_i18nBase, 'noBadges'].join('.'))}
                  </p>
                )}
                {Silian_badgeChoices.map(Silian_renderBadgeCard)}
              </div>
            </Silian_ScrollArea>
            <p className="text-xs text-muted-foreground">
              {Silian_t([...Silian_i18nBase, 'selectedSummary'].join('.'),  { summary: Silian_badgeSummary })}
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold leading-none tracking-tight">
                {Silian_t([...Silian_i18nBase, 'userSelection'].join('.'))}
              </h3>
              <p className="text-xs text-muted-foreground">
                {Silian_t([...Silian_i18nBase, 'userSelectionHint'].join('.'))}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Silian_Input
                value={Silian_searchTerm}
                onChange={(Silian_e) => Silian_setSearchTerm(Silian_e.target.value)}
                placeholder={Silian_t([...Silian_i18nBase, 'userSearchPlaceholder'].join('.'))}
              />
              <Silian_Button
                type="button"
                variant="outline"
                onClick={() => Silian_setSearchTerm('')}
              >
                {Silian_t('common.reset')}
              </Silian_Button>
            </div>
            <Silian_ScrollArea className="h-32 rounded-lg border">
              <div className="space-y-2 p-3">
                {Boolean(Silian_searchTerm) && (Silian_isUsersLoading || Silian_isUsersFetching) && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Silian_Loader2 className="h-4 w-4 animate-spin" />
                    {Silian_t('common.loading')}
                  </div>
                )}
                {Boolean(Silian_searchTerm) && !Silian_isUsersLoading && !Silian_isUsersFetching && Silian_usersResult.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    {Silian_t([...Silian_i18nBase, 'noUserFound'].join('.'))}
                  </p>
                )}
                {Silian_usersResult.map(Silian_renderUserResult)}
                {!Silian_searchTerm && Silian_selectedUsers.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    {Silian_t([...Silian_i18nBase, 'startSearchHint'].join('.'))}
                  </p>
                )}
              </div>
            </Silian_ScrollArea>

            <Silian_Separator />

            <div>
              <div className="flex items-center gap-2">
                <Silian_UsersIcon className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold leading-none tracking-tight">
                  {Silian_t([...Silian_i18nBase, 'selectedUsers'].join('.'))}
                </h3>
              </div>
              <div className="mt-3 grid gap-2">
                {Silian_selectedUsers.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    {Silian_t([...Silian_i18nBase, 'noUserSelected'].join('.'))}
                  </p>
                )}
                {Silian_selectedUsers.map((Silian_user) => (
                  <div key={Silian_user.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium leading-tight">{Silian_user.username || Silian_user.email || ('#' + Silian_user.id)}</p>
                      <p className="text-xs text-muted-foreground">ID: {Silian_user.id}</p>
                    </div>
                    <Silian_Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => Silian_handleRemoveUser(Silian_user.id)}
                    >
                      <Silian_X className="h-4 w-4" />
                      </Silian_Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t pt-4">
          {Silian_progressState && (
            <p className="text-xs text-muted-foreground">
              {Silian_t([...Silian_i18nBase, 'progress'].join('.'),  {
                processed: Silian_progressState.processed,
                total: Silian_progressState.total,
                success: Silian_progressState.success,
                failed: Silian_progressState.failed,
              })}
            </p>
          )}
          <div className="flex flex-col gap-2 text-xs text-muted-foreground">
            <p>
              <Silian_IconAction className="mr-1 inline-block h-3 w-3" />
              {Silian_t([...Silian_i18nBase, 'tipUsers'].join('.'))}
            </p>
            <p>
              <Silian_Award className="mr-1 inline-block h-3 w-3" />
              {Silian_t([...Silian_i18nBase, 'tipBadges'].join('.'))}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 justify-end">
            <Silian_Button variant="ghost" onClick={() => Silian_onOpenChange(false)} disabled={Silian_submitting}>
              {Silian_t('common.cancel')}
            </Silian_Button>
            <Silian_Button onClick={Silian_handleSubmit} disabled={Silian_submitting}>
              {Silian_submitting && <Silian_Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {Silian_t([...Silian_i18nBase, 'confirm'].join('.'))}
            </Silian_Button>
          </div>
        </div>
      </Silian_DialogContent>
    </Silian_Dialog>
  );
}

export default BadgeBulkAwardDialog;
