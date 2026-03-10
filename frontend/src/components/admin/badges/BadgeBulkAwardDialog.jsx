import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Loader2, Award, UserPlus, Users as UsersIcon, X, UserMinus } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { useQuery } from 'react-query';
import { adminAPI } from '@/lib/api';
import { toast } from 'react-hot-toast';
import { cn } from '@/lib/utils';

function useDebouncedValue(value, delay = 400) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

const getUserRows = (response) => {
  const nested = response?.data?.data ?? response?.data ?? {};
  if (Array.isArray(nested?.users)) {
    return nested.users;
  }
  if (Array.isArray(nested?.data?.users)) {
    return nested.data.users;
  }
  return [];
};

const countLabel = (t, count, key) => t(key, '{{count}} 个', { count });

export function BadgeBulkAwardDialog({
  open,
  onOpenChange,
  badges = [],
  defaultSelectedBadgeIds = [],
  presetUsers = [],
  onCompleted,
  mode = 'award',
}) {
  const { t } = useTranslation();
  const isRevoke = mode === 'revoke';
  const i18nBase = ['admin', 'badges', isRevoke ? 'bulkRevokeDialog' : 'bulkAwardDialog'];
  const [selectedBadgeIds, setSelectedBadgeIds] = useState(() => new Set(defaultSelectedBadgeIds));
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUsers, setSelectedUsers] = useState(presetUsers);
  const [submitting, setSubmitting] = useState(false);
  const [progressState, setProgressState] = useState(null);

  const debouncedSearch = useDebouncedValue(searchTerm.trim(), 400);

  useEffect(() => {
    if (open) {
      setSelectedBadgeIds(new Set(defaultSelectedBadgeIds));
      if (presetUsers?.length) {
        setSelectedUsers((prev) => {
          const merged = new Map();
          [...presetUsers, ...prev].forEach((user) => {
            if (user && typeof user.id !== 'undefined') {
              merged.set(user.id, user);
            }
          });
          return Array.from(merged.values());
        });
      }
    } else {
      setProgressState(null);
      setSearchTerm('');
    }
  }, [open, defaultSelectedBadgeIds, presetUsers]);

  const badgeMap = useMemo(() => new Map(badges.map((badge) => [badge.id, badge])), [badges]);
  const badgeChoices = useMemo(() => [...badges].sort((a, b) => (b?.sort_order ?? 0) - (a?.sort_order ?? 0)), [badges]);

  const badgeSummary = useMemo(() => {
    const selected = Array.from(selectedBadgeIds);
    if (!selected.length) {
      return t([...i18nBase, 'noBadgeSelected'].join('.'));
    }
    if (selected.length === 1) {
      const badge = badgeMap.get(selected[0]);
      return badge?.name_zh || badge?.name_en || ('#' + selected[0]);
    }
    return countLabel(t, selected.length, [...i18nBase, 'badgeCountSummary'].join('.'));
  }, [badgeMap, selectedBadgeIds, t, i18nBase]);

  const { data: usersData, isLoading: isUsersLoading, isFetching: isUsersFetching } = useQuery(
    ['admin', 'users', isRevoke ? 'badge-revoke-search' : 'badge-award-search', debouncedSearch],
    async () => {
      const response = await adminAPI.getUsers({ search: debouncedSearch, limit: 20 });
      return getUserRows(response);
    },
    {
      enabled: open && debouncedSearch.length >= 1,
      keepPreviousData: true,
    }
  );

  const usersResult = usersData || [];

  const toggleBadge = (badgeId) => {
    setSelectedBadgeIds((prev) => {
      const next = new Set(prev);
      if (next.has(badgeId)) {
        next.delete(badgeId);
      } else {
        next.add(badgeId);
      }
      return next;
    });
  };

  const handleSelectAllBadges = () => {
    if (selectedBadgeIds.size === badgeChoices.length) {
      setSelectedBadgeIds(new Set());
    } else {
      setSelectedBadgeIds(new Set(badgeChoices.map((badge) => badge.id)));
    }
  };

  const handleAddUser = (user) => {
    if (!user || typeof user.id === 'undefined') return;
    setSelectedUsers((prev) => {
      if (prev.some((item) => item.id === user.id)) {
        return prev;
      }
      return [...prev, user];
    });
  };

  const handleRemoveUser = (userId) => {
    setSelectedUsers((prev) => prev.filter((item) => item.id !== userId));
  };

  const executeAction = isRevoke ? adminAPI.revokeBadge : adminAPI.awardBadge;

  const handleSubmit = async () => {
    const badgeIds = Array.from(selectedBadgeIds);
    if (!badgeIds.length) {
      toast.error(t([...i18nBase, 'selectBadgeError'].join('.')));
      return;
    }
    if (!selectedUsers.length) {
      toast.error(t([...i18nBase, 'selectUserError'].join('.')));
      return;
    }

    setSubmitting(true);
    setProgressState({ processed: 0, total: badgeIds.length * selectedUsers.length, success: 0, failed: 0 });

    let success = 0;
    let failed = 0;
    const failures = [];

    for (const badgeId of badgeIds) {
      for (const user of selectedUsers) {
        try {
          await executeAction(badgeId, { user_id: user.id });
          success += 1;
        } catch (err) {
          failed += 1;
          failures.push({
            badgeId,
            user,
            message: err?.response?.data?.message || err?.message || 'Unknown error',
          });
        } finally {
          setProgressState((prev) => {
            const processed = (prev?.processed ?? 0) + 1;
            return { processed, total: badgeIds.length * selectedUsers.length, success, failed };
          });
        }
      }
    }

    setSubmitting(false);

    if (success) {
      toast.success(
        t([...i18nBase, 'success'].join('.'),  { count: success })
      );
    }
    if (failed) {
      toast.error(
        t([...i18nBase, 'partialFailed'].join('.'),  { failed })
      );
    }

    onCompleted?.({ success, failed, failures });
    if (!failed) {
      onOpenChange(false);
    }
  };

  const renderBadgeCard = (badge) => {
    const checked = selectedBadgeIds.has(badge.id);
    const handleKeyDown = (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        toggleBadge(badge.id);
      }
    };

    return (
      <div
        key={badge.id}
        role="button"
        tabIndex={0}
        aria-pressed={checked}
        className={cn(
          'flex w-full flex-col items-start gap-2 rounded-lg border p-4 text-left transition hover:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40',
          checked ? 'border-primary bg-primary/5' : 'border-border'
        )}
        onClick={() => toggleBadge(badge.id)}
        onKeyDown={handleKeyDown}
      >
        <div className="flex w-full items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Award className={cn('h-5 w-5', checked ? 'text-primary' : 'text-muted-foreground')} />
            <span className="font-medium leading-tight">{badge.name_zh || badge.name_en}</span>
          </div>
          <Checkbox
            checked={checked}
            onCheckedChange={() => toggleBadge(badge.id)}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
          />
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2">
          {badge.description_zh || badge.description_en || t([...i18nBase, 'noDescription'].join('.'))}
        </p>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant={badge.is_active ? 'success' : 'secondary'}>
            {badge.is_active ? t('admin.badges.active') : t('admin.badges.inactive')}
          </Badge>
          {badge.auto_grant_enabled ? (
            <Badge variant="outline">{t('admin.badges.autoEnabled')}</Badge>
          ) : null}
        </div>
      </div>
    );
  };

  const renderUserResult = (user) => {
    const alreadySelected = selectedUsers.some((item) => item.id === user.id);
    return (
      <div key={user.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
        <div className="min-w-0">
          <p className="text-sm font-medium leading-tight">{user.username || user.email || ('#' + user.id)}</p>
          <p className="text-xs text-muted-foreground">
            {user.email || t([...i18nBase, 'noEmail'].join('.'))} · ID: {user.id}
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant={alreadySelected ? 'secondary' : 'outline'}
          onClick={() => (alreadySelected ? handleRemoveUser(user.id) : handleAddUser(user))}
        >
          {alreadySelected ? t('common.remove') : t('common.add')}
        </Button>
      </div>
    );
  };

  const IconAction = isRevoke ? UserMinus : UserPlus;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>
            {t([...i18nBase, 'dialogTitle'].join('.'))}
          </DialogTitle>
          <DialogDescription>
            {t([...i18nBase, 'dialogDescription'].join('.'))}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold leading-none tracking-tight">
                {t([...i18nBase, 'badgeSelection'].join('.'))}
              </h3>
              <Button variant="ghost" size="sm" onClick={handleSelectAllBadges}>
                {selectedBadgeIds.size === badgeChoices.length
                  ? t([...i18nBase, 'clearAllBadges'].join('.'))
                  : t([...i18nBase, 'selectAllBadges'].join('.'))}
              </Button>
            </div>
            <ScrollArea className="h-72 rounded-lg border">
              <div className="grid gap-3 p-3">
                {badgeChoices.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    {t([...i18nBase, 'noBadges'].join('.'))}
                  </p>
                )}
                {badgeChoices.map(renderBadgeCard)}
              </div>
            </ScrollArea>
            <p className="text-xs text-muted-foreground">
              {t([...i18nBase, 'selectedSummary'].join('.'),  { summary: badgeSummary })}
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold leading-none tracking-tight">
                {t([...i18nBase, 'userSelection'].join('.'))}
              </h3>
              <p className="text-xs text-muted-foreground">
                {t([...i18nBase, 'userSelectionHint'].join('.'))}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t([...i18nBase, 'userSearchPlaceholder'].join('.'))}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => setSearchTerm('')}
              >
                {t('common.reset')}
              </Button>
            </div>
            <ScrollArea className="h-32 rounded-lg border">
              <div className="space-y-2 p-3">
                {Boolean(searchTerm) && (isUsersLoading || isUsersFetching) && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t('common.loading')}
                  </div>
                )}
                {Boolean(searchTerm) && !isUsersLoading && !isUsersFetching && usersResult.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    {t([...i18nBase, 'noUserFound'].join('.'))}
                  </p>
                )}
                {usersResult.map(renderUserResult)}
                {!searchTerm && selectedUsers.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    {t([...i18nBase, 'startSearchHint'].join('.'))}
                  </p>
                )}
              </div>
            </ScrollArea>

            <Separator />

            <div>
              <div className="flex items-center gap-2">
                <UsersIcon className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold leading-none tracking-tight">
                  {t([...i18nBase, 'selectedUsers'].join('.'))}
                </h3>
              </div>
              <div className="mt-3 grid gap-2">
                {selectedUsers.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    {t([...i18nBase, 'noUserSelected'].join('.'))}
                  </p>
                )}
                {selectedUsers.map((user) => (
                  <div key={user.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium leading-tight">{user.username || user.email || ('#' + user.id)}</p>
                      <p className="text-xs text-muted-foreground">ID: {user.id}</p>
                    </div>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => handleRemoveUser(user.id)}
                    >
                      <X className="h-4 w-4" />
                      </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t pt-4">
          {progressState && (
            <p className="text-xs text-muted-foreground">
              {t([...i18nBase, 'progress'].join('.'),  {
                processed: progressState.processed,
                total: progressState.total,
                success: progressState.success,
                failed: progressState.failed,
              })}
            </p>
          )}
          <div className="flex flex-col gap-2 text-xs text-muted-foreground">
            <p>
              <IconAction className="mr-1 inline-block h-3 w-3" />
              {t([...i18nBase, 'tipUsers'].join('.'))}
            </p>
            <p>
              <Award className="mr-1 inline-block h-3 w-3" />
              {t([...i18nBase, 'tipBadges'].join('.'))}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 justify-end">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t([...i18nBase, 'confirm'].join('.'))}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default BadgeBulkAwardDialog;
