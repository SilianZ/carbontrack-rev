import Silian_React, { useMemo as Silian_useMemo, useState as Silian_useState, useCallback as Silian_useCallback } from "react";
import { useMutation as Silian_useMutation, useQuery as Silian_useQuery } from "react-query";
import { toast as Silian_toast } from "react-hot-toast";
import { useNavigate as Silian_useNavigate } from "react-router-dom";
import {
  ResponsiveContainer as Silian_ResponsiveContainer,
  LineChart as Silian_LineChart,
  Line as Silian_Line,
  CartesianGrid as Silian_CartesianGrid,
  XAxis as Silian_XAxis,
  YAxis as Silian_YAxis,
  Legend as Silian_Legend,
  Tooltip as Silian_RechartsTooltip,
  BarChart as Silian_BarChart,
  Bar as Silian_Bar,
  Cell as Silian_Cell,
} from "recharts";
import { useTranslation as Silian_useTranslation } from "../../hooks/useTranslation";
import { adminAPI as Silian_adminAPI } from "../../lib/api";
import { Button as Silian_Button } from "../ui/Button";
import {
  Card as Silian_Card,
  CardContent as Silian_CardContent,
  CardDescription as Silian_CardDescription,
  CardHeader as Silian_CardHeader,
  CardTitle as Silian_CardTitle,
} from "../ui/Card";
import { Input as Silian_Input } from "../ui/Input";
import { Textarea as Silian_Textarea } from "../ui/textarea";
import { Alert as Silian_Alert, AlertDescription as Silian_AlertDescription, AlertTitle as Silian_AlertTitle } from "../ui/Alert";
import { Badge as Silian_Badge } from "../ui/badge";
import { Switch as Silian_Switch } from "../ui/switch";
import { Checkbox as Silian_Checkbox } from "../ui/checkbox";
import { Pagination as Silian_Pagination } from "../ui/Pagination";
import { Tabs as Silian_Tabs, TabsContent as Silian_TabsContent, TabsList as Silian_TabsList, TabsTrigger as Silian_TabsTrigger } from "../ui/Tabs";
import { cn as Silian_cn } from "../../lib/utils";
import {
  HoverCard as Silian_HoverCard,
  HoverCardContent as Silian_HoverCardContent,
  HoverCardTrigger as Silian_HoverCardTrigger,
} from "../ui/hover-card";
import { AnnouncementContent as Silian_AnnouncementContent } from "../content/AnnouncementContent";
import { AnnouncementEmailPreview as Silian_AnnouncementEmailPreview } from "../content/AnnouncementEmailPreview";
import { AnnouncementPromptHelper as Silian_AnnouncementPromptHelper } from "../content/AnnouncementPromptHelper";
import { AnnouncementTemplateEditor as Silian_AnnouncementTemplateEditor } from "../content/AnnouncementTemplateEditor";
import { ANNOUNCEMENT_PROMPT_ACTION_GENERATE as Silian_ANNOUNCEMENT_PROMPT_ACTION_GENERATE } from "../../lib/announcementPrompt";
import {
  ANNOUNCEMENT_CONTENT_FORMAT_HTML as Silian_ANNOUNCEMENT_CONTENT_FORMAT_HTML,
  ANNOUNCEMENT_CONTENT_FORMAT_TEXT as Silian_ANNOUNCEMENT_CONTENT_FORMAT_TEXT,
  ANNOUNCEMENT_RENDER_PROFILE_HTML as Silian_ANNOUNCEMENT_RENDER_PROFILE_HTML,
  normalizeAnnouncementContentFormat as Silian_normalizeAnnouncementContentFormat,
} from "../../lib/announcementHtml";

const Silian_PRIORITIES = ["low", "normal", "high", "urgent"];
const Silian_PRIORITY_COLORS = {
  urgent: "#ef4444",
  high: "#f97316",
  normal: "#3b82f6",
  low: "#10b981",
  default: "#6b7280",
};
const Silian_INITIAL_FORM = {
  title: "",
  content: "",
  content_format: Silian_ANNOUNCEMENT_CONTENT_FORMAT_TEXT,
  priority: "normal",
  scope: "all",
  target_users_text: "",
};
const Silian_MAX_USERS_PREVIEW = 20;
const Silian_HISTORY_DEFAULT_PARAMS = { page: 1, limit: 20 };
const Silian_FILTERS_DEFAULT = {
  search: "",
  priority: "any",
  scope: "any",
  unreadOnly: false,
};

const Silian_RECIPIENT_SEARCH_DEFAULT = {
  search: "",
  fields: "username,email,school,location",
  school: "",
  emailSuffix: "",
  status: "any",
  isAdmin: "any",
  limit: 25,
};

const Silian_RECIPIENT_FIELD_LABEL_KEYS = {
  email: "admin.broadcast.recipientSearch.fields.email",
  school: "admin.broadcast.recipientSearch.fields.school",
  location: "admin.broadcast.recipientSearch.fields.location",
  username: "admin.broadcast.recipientSearch.fields.username",
};

const Silian_parseTargetUserIds = (Silian_raw) => {
  if (!Silian_raw) {
    return [];
  }
  const Silian_tokens = Silian_raw
    .split(/[\s,]+/)
    .map((Silian_value) => Silian_value.trim())
    .filter(Boolean);

  const Silian_unique = new Set();
  Silian_tokens.forEach((Silian_token) => {
    const Silian_numeric = Number(Silian_token);
    if (Number.isInteger(Silian_numeric) && Silian_numeric > 0) {
      Silian_unique.add(Silian_numeric);
    }
  });
  return Array.from(Silian_unique);
};

const Silian_formatDateTime = (Silian_value, Silian_locale) => {
  if (!Silian_value) return "";
  const Silian_date = new Date(Silian_value);
  if (Number.isNaN(Silian_date.getTime())) {
    return Silian_value;
  }
  return Silian_date.toLocaleString(Silian_locale);
};

const Silian_truncateUsers = (Silian_users, Silian_max = Silian_MAX_USERS_PREVIEW) => {
  if (!Array.isArray(Silian_users)) {
    return { list: [], more: 0 };
  }
  if (Silian_users.length <= Silian_max) {
    return { list: Silian_users, more: 0 };
  }
  return { list: Silian_users.slice(0, Silian_max), more: Silian_users.length - Silian_max };
};

const Silian_getRecipientUuid = (Silian_entry) => {
  if (typeof Silian_entry?.uuid === "string" && Silian_entry.uuid.trim()) {
    return Silian_entry.uuid.trim().toLowerCase();
  }
  if (typeof Silian_entry?.user_id === "string" && Silian_entry.user_id.trim()) {
    return Silian_entry.user_id.trim().toLowerCase();
  }
  return "";
};

const Silian_getRecipientLegacyId = (Silian_entry) => {
  const Silian_candidates = [Silian_entry?.legacy_user_id, Silian_entry?.id, Silian_entry?.user_id];
  for (const Silian_candidate of Silian_candidates) {
    const Silian_parsed = Number(Silian_candidate);
    if (Number.isInteger(Silian_parsed) && Silian_parsed > 0) {
      return Silian_parsed;
    }
  }
  return null;
};

const Silian_getRecipientFallbackLabel = (Silian_entry) => {
  const Silian_uuid = Silian_getRecipientUuid(Silian_entry);
  if (Silian_uuid) {
    return Silian_uuid;
  }
  const Silian_legacyId = Silian_getRecipientLegacyId(Silian_entry);
  return Silian_legacyId ? `#${Silian_legacyId}` : "#?";
};

function Silian_ResultStat({ label: Silian_label, value: Silian_value, tone: Silian_tone = "default" }) {
  return (
    <div className="bg-card rounded-md border px-4 py-3">
      <p className="text-sm text-muted-foreground">{Silian_label}</p>
      <p
        className={Silian_cn(
          "mt-1 text-xl font-semibold",
          Silian_tone === "success" && "text-green-600",
          Silian_tone === "warning" && "text-yellow-600",
          Silian_tone === "danger" && "text-red-600",
        )}
      >
        {Silian_value}
      </p>
    </div>
  );
}

function Silian_UserChips({ users: Silian_users, onViewUser: Silian_onViewUser, t: Silian_t }) {
  if (!Array.isArray(Silian_users) || Silian_users.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {Silian_t("admin.broadcast.result.none")}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {Silian_users.map((Silian_entry, Silian_index) => {
        const Silian_uuid = Silian_getRecipientUuid(Silian_entry);
        const Silian_legacyId = Silian_getRecipientLegacyId(Silian_entry);
        const Silian_identity = Silian_uuid || Silian_legacyId || Silian_index;
        if (!Silian_uuid && !Silian_legacyId) {
          return null;
        }

        const Silian_label =
          Silian_entry?.username ?? Silian_entry?.email ?? Silian_getRecipientFallbackLabel(Silian_entry);
        const Silian_email = Silian_entry?.email ?? Silian_entry?.user_email ?? null;
        const Silian_statusValue =
          typeof Silian_entry?.status === "string" ? Silian_entry.status.toLowerCase() : "";
        const Silian_statusLabel =
          Silian_statusValue === "active"
            ? Silian_t("admin.users.statusActive")
            : Silian_statusValue === "inactive"
              ? Silian_t("admin.users.statusInactive")
              : Silian_statusValue === "suspended"
                ? Silian_t("admin.users.statusSuspended")
                : null;
        const Silian_hasAdminFlag =
          Silian_entry?.is_admin !== undefined &&
          Silian_entry?.is_admin !== null &&
          `${Silian_entry.is_admin}` !== "";
        const Silian_isAdmin =
          Silian_entry?.is_admin === true ||
          Silian_entry?.is_admin === 1 ||
          Silian_entry?.is_admin === "1" ||
          Silian_entry?.is_admin === "true";

        const Silian_handleNavigate = (Silian_event) => {
          if (Silian_onViewUser) {
            Silian_onViewUser(Silian_event, { ...Silian_entry, id: Silian_legacyId, uuid: Silian_uuid });
          }
        };

        return (
          <div
            key={`${Silian_identity}-${Silian_index}`}
            className="bg-muted/40 flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
          >
            <Silian_HoverCard>
              <Silian_HoverCardTrigger asChild>
                <span className="cursor-help text-sm font-medium text-foreground hover:text-green-600">
                  {Silian_label}
                </span>
              </Silian_HoverCardTrigger>
              <Silian_HoverCardContent className="w-64 space-y-1 text-xs text-muted-foreground">
                {Silian_legacyId && (
                  <div>
                    <span className="font-medium text-foreground/80">
                      {Silian_t("admin.broadcast.recipientSearch.hover.userId")}
                    </span>{" "}
                    #{Silian_legacyId}
                  </div>
                )}
                {Silian_uuid && (
                  <div>
                    <span className="font-medium text-foreground/80">UUID</span>{" "}
                    {Silian_uuid}
                  </div>
                )}
                {Silian_email && (
                  <div>
                    <span className="font-medium text-foreground/80">
                      {Silian_t("common.email")}
                    </span>{" "}
                    {Silian_email}
                  </div>
                )}
                {Silian_statusLabel && (
                  <div>
                    <span className="font-medium text-foreground/80">
                      {Silian_t("admin.broadcast.recipientSearch.hover.status")}
                    </span>{" "}
                    {Silian_statusLabel}
                  </div>
                )}
                {Silian_hasAdminFlag && (
                  <div>
                    <span className="font-medium text-foreground/80">
                      {Silian_t("admin.broadcast.recipientSearch.hover.role")}
                    </span>{" "}
                    {Silian_isAdmin
                      ? Silian_t("admin.users.roleAdmin")
                      : Silian_t("admin.users.roleUser")}
                  </div>
                )}
              </Silian_HoverCardContent>
            </Silian_HoverCard>
            <Silian_Button
              type="button"
              size="sm"
              variant="outline"
              onClick={Silian_handleNavigate}
            >
              {Silian_t("admin.broadcast.recipientSearch.viewProfile")}
            </Silian_Button>
          </div>
        );
      })}
    </div>
  );
}

export function BroadcastCenter() {
  const { t: Silian_t, currentLanguage: Silian_currentLanguage } = Silian_useTranslation(['admin', 'common', 'date', 'errors', 'messages', 'pagination', 'validation']);
  const Silian_numberFormatter = Silian_useMemo(() => new Intl.NumberFormat(Silian_currentLanguage), [Silian_currentLanguage]);
  const Silian_percentFormatter = Silian_useMemo(
    () =>
      new Intl.NumberFormat(Silian_currentLanguage, {
        style: "percent",
        maximumFractionDigits: 1,
      }),
    [Silian_currentLanguage],
  );
  const Silian_shortDateFormatter = Silian_useMemo(
    () =>
      new Intl.DateTimeFormat(Silian_currentLanguage, { month: "short", day: "numeric" }),
    [Silian_currentLanguage],
  );
  const Silian_navigate = Silian_useNavigate();
  const [Silian_activeTab, Silian_setActiveTab] = Silian_useState("compose");
  const [Silian_form, Silian_setForm] = Silian_useState(Silian_INITIAL_FORM);
  const [Silian_preview, Silian_setPreview] = Silian_useState(null);
  const [Silian_result, Silian_setResult] = Silian_useState(null);
  const [Silian_errors, Silian_setErrors] = Silian_useState({});
  const [Silian_expanded, Silian_setExpanded] = Silian_useState({});
  const [Silian_historyParams, Silian_setHistoryParams] = Silian_useState(Silian_HISTORY_DEFAULT_PARAMS);
  const [Silian_filters, Silian_setFilters] = Silian_useState(Silian_FILTERS_DEFAULT);
  const [Silian_recipientForm, Silian_setRecipientForm] = Silian_useState(Silian_RECIPIENT_SEARCH_DEFAULT);
  const [Silian_recipientResults, Silian_setRecipientResults] = Silian_useState({
    items: [],
    pagination: {
      page: 1,
      has_more: false,
      limit: Silian_RECIPIENT_SEARCH_DEFAULT.limit,
    },
  });
  const [Silian_recipientLoading, Silian_setRecipientLoading] = Silian_useState(false);
  const [Silian_recipientError, Silian_setRecipientError] = Silian_useState(null);
  const [Silian_selectedRecipients, Silian_setSelectedRecipients] = Silian_useState(() => new Map());
  const [Silian_appliedFilters, Silian_setAppliedFilters] = Silian_useState([]);
  const [Silian_announcementAiAction, Silian_setAnnouncementAiAction] = Silian_useState(
    Silian_ANNOUNCEMENT_PROMPT_ACTION_GENERATE,
  );
  const [Silian_announcementAiInstruction, Silian_setAnnouncementAiInstruction] =
    Silian_useState("");

  const Silian_hasRecipientCriteria = Silian_useMemo(() => {
    return Boolean(
      Silian_recipientForm.search.trim() ||
      Silian_recipientForm.school.trim() ||
      Silian_recipientForm.emailSuffix.trim() ||
      (Silian_recipientForm.status && Silian_recipientForm.status !== "any") ||
      (Silian_recipientForm.isAdmin && Silian_recipientForm.isAdmin !== "any"),
    );
  }, [Silian_recipientForm]);

  const Silian_customTargetIds = Silian_useMemo(() => {
    if (Silian_form.scope !== "custom") {
      return [];
    }
    return Silian_parseTargetUserIds(Silian_form.target_users_text);
  }, [Silian_form.scope, Silian_form.target_users_text]);

  const Silian_selectedRecipientList = Silian_useMemo(
    () => Array.from(Silian_selectedRecipients.values()),
    [Silian_selectedRecipients],
  );
  const Silian_selectedRecipientIds = Silian_useMemo(
    () =>
      Silian_selectedRecipientList
        .map((Silian_entry) => Number(Silian_entry?.id ?? 0))
        .filter((Silian_id) => Number.isInteger(Silian_id) && Silian_id > 0),
    [Silian_selectedRecipientList],
  );
  const Silian_selectedContentFormat = Silian_useMemo(
    () => Silian_normalizeAnnouncementContentFormat(Silian_form.content_format),
    [Silian_form.content_format],
  );

  const {
    data: Silian_adminStatsData,
    isLoading: Silian_isMessageStatsLoading,
    isFetching: Silian_isMessageStatsFetching,
    isError: Silian_isMessageStatsError,
    error: Silian_messageStatsError,
    refetch: Silian_refetchMessageStats,
  } = Silian_useQuery(
    ["admin-message-stats"],
    () => Silian_adminAPI.getStats().then((Silian_res) => Silian_res.data?.data ?? {}),
    {
      staleTime: 60000,
      refetchOnWindowFocus: false,
    },
  );

  const {
    data: Silian_historyResponse,
    isLoading: Silian_isHistoryLoading,
    isFetching: Silian_isHistoryFetching,
    error: Silian_historyError,
    refetch: Silian_refetchHistory,
  } = Silian_useQuery(
    ["admin-broadcast-history", Silian_historyParams],
    () => Silian_adminAPI.getBroadcasts(Silian_historyParams).then((Silian_res) => Silian_res.data),
    {
      keepPreviousData: true,
      staleTime: 60000,
    },
  );

  const Silian_pagination = Silian_historyResponse?.pagination ?? {};
  const Silian_messageOverview = Silian_useMemo(() => {
    const Silian_stats = Silian_adminStatsData?.messages ?? {};
    const Silian_totalRaw = Number(Silian_stats?.total_messages ?? 0);
    const Silian_unreadRaw = Number(Silian_stats?.unread_messages ?? 0);
    let Silian_readRaw = Number(Silian_stats?.read_messages ?? 0);
    const Silian_total = Number.isFinite(Silian_totalRaw) ? Math.max(0, Silian_totalRaw) : 0;
    const Silian_unread = Number.isFinite(Silian_unreadRaw) ? Math.max(0, Silian_unreadRaw) : 0;
    if (!Number.isFinite(Silian_readRaw) || (Silian_readRaw === 0 && Silian_total >= Silian_unread)) {
      Silian_readRaw = Silian_total - Silian_unread;
    }
    const Silian_read = Math.max(
      0,
      Number.isFinite(Silian_readRaw) ? Silian_readRaw : Silian_total - Silian_unread,
    );
    const Silian_ratioRaw = Number(
      Silian_stats?.unread_ratio ?? (Silian_total > 0 ? Silian_unread / Math.max(Silian_total, 1) : 0),
    );
    const Silian_unreadRatio = Math.min(
      Math.max(Number.isFinite(Silian_ratioRaw) ? Silian_ratioRaw : 0, 0),
      1,
    );
    return { total: Silian_total, unread: Silian_unread, read: Silian_read, unreadRatio: Silian_unreadRatio };
  }, [Silian_adminStatsData]);

  const Silian_messagePriorityData = Silian_useMemo(() => {
    const Silian_rows = Silian_adminStatsData?.messages?.priority_breakdown;
    if (!Array.isArray(Silian_rows)) {
      return [];
    }
    return Silian_rows.map((Silian_row) => {
      const Silian_priorityRaw =
        typeof Silian_row?.priority === "string" ? Silian_row.priority : "normal";
      const Silian_priority = Silian_priorityRaw.toLowerCase() || "normal";
      const Silian_totalRaw = Number(Silian_row?.total ?? 0);
      const Silian_unreadRaw = Number(Silian_row?.unread ?? 0);
      let Silian_readRaw = Number(Silian_row?.read ?? 0);
      const Silian_total = Number.isFinite(Silian_totalRaw) ? Math.max(0, Silian_totalRaw) : 0;
      const Silian_unread = Number.isFinite(Silian_unreadRaw) ? Math.max(0, Silian_unreadRaw) : 0;
      if (!Number.isFinite(Silian_readRaw) || (Silian_readRaw === 0 && Silian_total >= Silian_unread)) {
        Silian_readRaw = Silian_total - Silian_unread;
      }
      const Silian_read = Math.max(
        0,
        Number.isFinite(Silian_readRaw) ? Silian_readRaw : Silian_total - Silian_unread,
      );
      const Silian_ratioRaw = Number(
        Silian_row?.unread_ratio ?? (Silian_total > 0 ? Silian_unread / Math.max(Silian_total, 1) : 0),
      );
      const Silian_unreadRatio = Math.min(
        Math.max(Number.isFinite(Silian_ratioRaw) ? Silian_ratioRaw : 0, 0),
        1,
      );
      return { priority: Silian_priority, total: Silian_total, unread: Silian_unread, read: Silian_read, unreadRatio: Silian_unreadRatio };
    });
  }, [Silian_adminStatsData]);

  const Silian_messageTrendData = Silian_useMemo(() => {
    const Silian_rows = Silian_adminStatsData?.messages?.daily_counts;
    if (!Array.isArray(Silian_rows)) {
      return [];
    }
    return Silian_rows.map((Silian_row) => {
      const Silian_date = typeof Silian_row?.date === "string" ? Silian_row.date : "";
      const Silian_totalRaw = Number(Silian_row?.total ?? 0);
      const Silian_unreadRaw = Number(Silian_row?.unread ?? 0);
      let Silian_readRaw = Number(Silian_row?.read ?? 0);
      const Silian_total = Number.isFinite(Silian_totalRaw) ? Math.max(0, Silian_totalRaw) : 0;
      const Silian_unread = Number.isFinite(Silian_unreadRaw) ? Math.max(0, Silian_unreadRaw) : 0;
      if (!Number.isFinite(Silian_readRaw) || (Silian_readRaw === 0 && Silian_total >= Silian_unread)) {
        Silian_readRaw = Silian_total - Silian_unread;
      }
      const Silian_read = Math.max(
        0,
        Number.isFinite(Silian_readRaw) ? Silian_readRaw : Silian_total - Silian_unread,
      );
      return { date: Silian_date, total: Silian_total, unread: Silian_unread, read: Silian_read };
    });
  }, [Silian_adminStatsData]);

  const Silian_messageTrendHasData = Silian_useMemo(
    () => Silian_messageTrendData.some((Silian_item) => Silian_item.total > 0 || Silian_item.unread > 0),
    [Silian_messageTrendData],
  );
  const Silian_messagePriorityHasData = Silian_useMemo(
    () => Silian_messagePriorityData.some((Silian_item) => Silian_item.total > 0 || Silian_item.unread > 0),
    [Silian_messagePriorityData],
  );
  const Silian_messagePriorityChartData = Silian_useMemo(
    () =>
      Silian_messagePriorityData.map((Silian_item) => {
        return {
          ...Silian_item,
          name: Silian_t(`messages.priority.${Silian_item.priority}`),
          color: Silian_PRIORITY_COLORS[Silian_item.priority] ?? Silian_PRIORITY_COLORS.default,
        };
      }),
    [Silian_messagePriorityData, Silian_t],
  );
  const Silian_messageStatsInitialLoading = Silian_isMessageStatsLoading && !Silian_adminStatsData;

  const Silian_filteredItems = Silian_useMemo(() => {
    const Silian_historyItems = Array.isArray(Silian_historyResponse?.data)
      ? Silian_historyResponse.data
      : [];
    if (Silian_historyItems.length === 0) {
      return [];
    }
    const Silian_search = Silian_filters.search.trim().toLowerCase();
    return Silian_historyItems.filter((Silian_item) => {
      if (Silian_filters.priority !== "any" && Silian_item.priority !== Silian_filters.priority) {
        return false;
      }
      if (Silian_filters.scope !== "any") {
        const Silian_scopeKey = Silian_item.scope === "custom" ? "custom" : "all";
        if (Silian_scopeKey !== Silian_filters.scope) {
          return false;
        }
      }
      if (Silian_filters.unreadOnly && (Silian_item.unread_count ?? 0) === 0) {
        return false;
      }
      if (!Silian_search) {
        return true;
      }
      const Silian_pooled = [
        Silian_item.title,
        Silian_item.content,
        Silian_item.actor_username,
        Silian_item.actor_user_id && `#${Silian_item.actor_user_id}`,
      ]
        .filter(Boolean)
        .map((Silian_value) => String(Silian_value).toLowerCase());
      return Silian_pooled.some((Silian_value) => Silian_value.includes(Silian_search));
    });
  }, [Silian_historyResponse, Silian_filters]);

  const Silian_summary = Silian_useMemo(() => {
    const Silian_totals = {
      broadcasts: Silian_filteredItems.length,
      targets: 0,
      sent: 0,
      read: 0,
      unread: 0,
    };
    Silian_filteredItems.forEach((Silian_item) => {
      Silian_totals.targets += Silian_item.target_count ?? 0;
      Silian_totals.sent += Silian_item.sent_count ?? 0;
      Silian_totals.read += Silian_item.read_count ?? 0;
      Silian_totals.unread += Silian_item.unread_count ?? 0;
    });
    return Silian_totals;
  }, [Silian_filteredItems]);

  const Silian_setField = (Silian_key, Silian_value) => {
    Silian_setForm((Silian_prev) => {
      const Silian_next = { ...Silian_prev, [Silian_key]: Silian_value };
      if (
        Silian_key === "target_users_text" &&
        typeof Silian_value === "string" &&
        Silian_value.trim().length > 0
      ) {
        Silian_next.scope = "custom";
      }
      return Silian_next;
    });
  };

  const Silian_updateFilters = (Silian_partial) => {
    Silian_setFilters((Silian_prev) => ({ ...Silian_prev, ...Silian_partial }));
    Silian_setHistoryParams((Silian_prev) => ({ ...Silian_prev, page: 1 }));
  };

  const Silian_resetFilters = () => {
    Silian_setFilters(Silian_FILTERS_DEFAULT);
    Silian_setHistoryParams((Silian_prev) => ({ ...Silian_prev, page: 1 }));
  };

  const Silian_setRecipientField = (Silian_key, Silian_value) => {
    Silian_setRecipientForm((Silian_prev) => ({ ...Silian_prev, [Silian_key]: Silian_value }));
  };

  const Silian_ensureCustomScope = Silian_useCallback(() => {
    Silian_setForm((Silian_prev) =>
      Silian_prev.scope === "custom" ? Silian_prev : { ...Silian_prev, scope: "custom" },
    );
  }, [Silian_setForm]);

  const Silian_buildRecipientParams = Silian_useCallback(
    (Silian_overrides = {}) => {
      const Silian_params = {};
      const Silian_search = Silian_recipientForm.search.trim();
      if (Silian_search) {
        Silian_params.search = Silian_search;
      }
      const Silian_fields = Silian_recipientForm.fields.trim();
      if (Silian_fields) {
        Silian_params.fields = Silian_fields;
      }
      const Silian_school = Silian_recipientForm.school.trim();
      if (Silian_school) {
        Silian_params.school = Silian_school;
      }
      const Silian_emailSuffix = Silian_recipientForm.emailSuffix.trim();
      if (Silian_emailSuffix) {
        Silian_params.email_suffix = Silian_emailSuffix;
      }
      if (Silian_recipientForm.status && Silian_recipientForm.status !== "any") {
        Silian_params.status = Silian_recipientForm.status;
      }
      if (Silian_recipientForm.isAdmin && Silian_recipientForm.isAdmin !== "any") {
        Silian_params.is_admin = Silian_recipientForm.isAdmin;
      }
      const Silian_limitRaw = Silian_overrides.limit ?? Silian_recipientForm.limit ?? 25;
      const Silian_limit = Math.max(10, Math.min(500, Number(Silian_limitRaw) || 25));
      Silian_params.limit = Silian_limit;
      const Silian_pageRaw = Silian_overrides.page ?? 1;
      Silian_params.page = Math.max(1, Number(Silian_pageRaw) || 1);
      return Silian_params;
    },
    [Silian_recipientForm],
  );

  const Silian_buildFilterPayload = Silian_useCallback(() => {
    const Silian_payload = {};
    const Silian_search = Silian_recipientForm.search.trim();
    const Silian_school = Silian_recipientForm.school.trim();
    const Silian_emailSuffix = Silian_recipientForm.emailSuffix.trim();
    const Silian_limit = Math.max(
      10,
      Math.min(500, Number(Silian_recipientForm.limit) || 25),
    );

    Silian_payload.limit = Silian_limit;

    if (Silian_search) {
      Silian_payload.search = Silian_search;
      if (
        Silian_recipientForm.fields &&
        Silian_recipientForm.fields !== Silian_RECIPIENT_SEARCH_DEFAULT.fields
      ) {
        Silian_payload.fields = Silian_recipientForm.fields;
      }
    }
    if (Silian_school) {
      Silian_payload.school = Silian_school;
    }
    if (Silian_emailSuffix) {
      Silian_payload.email_suffix = Silian_emailSuffix;
    }
    if (Silian_recipientForm.status && Silian_recipientForm.status !== "any") {
      Silian_payload.status = Silian_recipientForm.status;
    }
    if (Silian_recipientForm.isAdmin && Silian_recipientForm.isAdmin !== "any") {
      Silian_payload.is_admin = Silian_recipientForm.isAdmin;
    }
    return Silian_payload;
  }, [Silian_recipientForm]);

  const Silian_describeFilter = Silian_useCallback(
    (Silian_filter) => {
      if (!Silian_filter || typeof Silian_filter !== "object") {
        return Silian_t("admin.broadcast.recipientFilters.summary.fallback");
      }

      const Silian_parts = [];
      if (Silian_filter.search) {
        Silian_parts.push(
          Silian_t("admin.broadcast.recipientFilters.summary.search", {
            value: Silian_filter.search,
          }),
        );
        if (Silian_filter.fields) {
          const Silian_labels = Silian_filter.fields
            .split(",")
            .map((Silian_field) => Silian_field.trim())
            .filter(Boolean)
            .map((Silian_field) => {
              const Silian_normalized = Silian_field === "school_name" ? "school" : Silian_field;
              const Silian_labelKey = Silian_RECIPIENT_FIELD_LABEL_KEYS[Silian_normalized];
              return Silian_labelKey ? Silian_t(Silian_labelKey) : null;
            })
            .filter(Boolean);
          if (Silian_labels.length > 0) {
            Silian_parts.push(
              Silian_t("admin.broadcast.recipientFilters.summary.fields", {
                fields: Silian_labels.join(", "),
              }),
            );
          }
        }
      }
      if (Silian_filter.school) {
        Silian_parts.push(
          Silian_t("admin.broadcast.recipientFilters.summary.school", {
            value: Silian_filter.school,
          }),
        );
      }
      if (Silian_filter.email_suffix) {
        Silian_parts.push(
          Silian_t("admin.broadcast.recipientFilters.summary.emailSuffix", {
            value: Silian_filter.email_suffix,
          }),
        );
      }
      if (Silian_filter.status === "active" || Silian_filter.status === "inactive") {
        Silian_parts.push(
          Silian_t("admin.broadcast.recipientFilters.summary.status." + Silian_filter.status),
        );
      }
      if (
        Silian_filter.is_admin === "1" ||
        Silian_filter.is_admin === 1 ||
        Silian_filter.is_admin === true ||
        Silian_filter.is_admin === "true"
      ) {
        Silian_parts.push(Silian_t("admin.broadcast.recipientFilters.summary.role.admin"));
      } else if (
        Silian_filter.is_admin === "0" ||
        Silian_filter.is_admin === 0 ||
        Silian_filter.is_admin === false ||
        Silian_filter.is_admin === "false"
      ) {
        Silian_parts.push(Silian_t("admin.broadcast.recipientFilters.summary.role.user"));
      }
      if (Silian_filter.limit) {
        Silian_parts.push(
          Silian_t("admin.broadcast.recipientFilters.summary.limit", {
            count: Silian_filter.limit,
          }),
        );
      }

      if (Silian_parts.length === 0) {
        return Silian_t("admin.broadcast.recipientFilters.summary.fallback");
      }

      const Silian_joiner = Silian_t("admin.broadcast.recipientFilters.summary.joiner");
      return Silian_parts.join(Silian_joiner);
    },
    [Silian_t],
  );

  const Silian_loadRecipients = Silian_useCallback(
    async (Silian_overrides = {}) => {
      const Silian_params = Silian_buildRecipientParams(Silian_overrides);
      Silian_setRecipientLoading(true);
      Silian_setRecipientError(null);
      try {
        const Silian_res = await Silian_adminAPI.searchBroadcastRecipients(Silian_params);
        const Silian_payload = Silian_res?.data ?? {};
        const Silian_list = Array.isArray(Silian_payload.data) ? Silian_payload.data : [];
        const Silian_pagination = Silian_payload.pagination ?? {};
        const Silian_page = Silian_pagination.page ?? Silian_params.page ?? 1;
        const Silian_limit =
          Silian_pagination.limit ?? Silian_params.limit ?? Silian_recipientForm.limit ?? 25;
        const Silian_hasMore = Boolean(Silian_pagination.has_more);
        Silian_setRecipientResults({
          items: Silian_list,
          pagination: { page: Silian_page, limit: Silian_limit, has_more: Silian_hasMore },
        });
      } catch (Silian_error) {
        Silian_setRecipientError(Silian_error);
        Silian_setRecipientResults((Silian_prev) => ({ ...Silian_prev, items: [] }));
      } finally {
        Silian_setRecipientLoading(false);
      }
    },
    [Silian_buildRecipientParams, Silian_recipientForm.limit],
  );

  const Silian_handleRecipientSearch = async () => {
    await Silian_loadRecipients({ page: 1 });
  };

  const Silian_handleRecipientPageChange = (Silian_direction) => {
    if (Silian_direction === "prev") {
      const Silian_prevPage = Math.max(1, Silian_recipientResults.pagination.page - 1);
      if (Silian_prevPage !== Silian_recipientResults.pagination.page) {
        Silian_loadRecipients({ page: Silian_prevPage });
      }
      return;
    }
    if (Silian_recipientResults.pagination.has_more) {
      Silian_loadRecipients({ page: Silian_recipientResults.pagination.page + 1 });
    }
  };

  const Silian_clearRecipientSearch = () => {
    Silian_setRecipientForm(Silian_RECIPIENT_SEARCH_DEFAULT);
    Silian_setRecipientResults({
      items: [],
      pagination: {
        page: 1,
        has_more: false,
        limit: Silian_RECIPIENT_SEARCH_DEFAULT.limit,
      },
    });
    Silian_setRecipientError(null);
  };

  const Silian_toggleRecipientSelection = Silian_useCallback(
    (Silian_recipient) => {
      if (!Silian_recipient || Silian_recipient.id === undefined || Silian_recipient.id === null) {
        return;
      }
      const Silian_id = Number(Silian_recipient.id);
      if (!Number.isInteger(Silian_id) || Silian_id <= 0) {
        return;
      }
      Silian_ensureCustomScope();
      Silian_setSelectedRecipients((Silian_prev) => {
        const Silian_next = new Map(Silian_prev);
        if (Silian_next.has(Silian_id)) {
          Silian_next.delete(Silian_id);
        } else {
          Silian_next.set(Silian_id, {
            id: Silian_id,
            username: Silian_recipient.username ?? null,
            email: Silian_recipient.email ?? null,
            school: Silian_recipient.school ?? null,
          });
        }
        return Silian_next;
      });
    },
    [Silian_ensureCustomScope],
  );

  const Silian_handleViewUserProfile = Silian_useCallback(
    (Silian_event, Silian_recipient) => {
      if (Silian_event) {
        Silian_event.preventDefault();
        Silian_event.stopPropagation();
      }
      if (!Silian_recipient) {
        Silian_toast.error(Silian_t("admin.broadcast.recipientSearch.invalidUser"));
        return;
      }
      const Silian_userUuid = Silian_getRecipientUuid(Silian_recipient);
      if (Silian_userUuid) {
        Silian_navigate(`/admin/users?userUuid=${Silian_userUuid}`);
        return;
      }
      if (Silian_recipient.id === undefined || Silian_recipient.id === null) {
        Silian_toast.error(Silian_t("admin.broadcast.recipientSearch.invalidUser"));
        return;
      }
      const Silian_userId = Number(Silian_recipient.id);
      if (!Number.isInteger(Silian_userId) || Silian_userId <= 0) {
        Silian_toast.error(Silian_t("admin.broadcast.recipientSearch.invalidUser"));
        return;
      }
      Silian_navigate(`/admin/users?userId=${Silian_userId}`);
    },
    [Silian_navigate, Silian_t],
  );

  const Silian_removeSelectedRecipient = (Silian_id) => {
    Silian_setSelectedRecipients((Silian_prev) => {
      const Silian_next = new Map(Silian_prev);
      Silian_next.delete(Silian_id);
      return Silian_next;
    });
  };

  const Silian_clearSelectedRecipients = () => {
    Silian_setSelectedRecipients(new Map());
  };

  const Silian_addAllRecipientsFromResults = () => {
    if (!Silian_recipientResults.items.length) {
      Silian_toast.error(Silian_t("admin.broadcast.recipients.emptySelection"));
      return;
    }
    Silian_ensureCustomScope();
    Silian_setSelectedRecipients((Silian_prev) => {
      const Silian_next = new Map(Silian_prev);
      Silian_recipientResults.items.forEach((Silian_item) => {
        const Silian_id = Number(Silian_item?.id ?? 0);
        if (Number.isInteger(Silian_id) && Silian_id > 0) {
          Silian_next.set(Silian_id, {
            id: Silian_id,
            username: Silian_item.username ?? null,
            email: Silian_item.email ?? null,
            school: Silian_item.school ?? null,
          });
        }
      });
      return Silian_next;
    });
    Silian_toast.success(Silian_t("admin.broadcast.recipients.addedAll"));
  };

  const Silian_addFilterGroup = () => {
    if (!Silian_hasRecipientCriteria) {
      Silian_toast.error(Silian_t("admin.broadcast.recipientFilters.requireCondition"));
      return;
    }
    Silian_ensureCustomScope();
    const Silian_payload = Silian_buildFilterPayload();
    Silian_setAppliedFilters((Silian_prev) => [...Silian_prev, Silian_payload]);
    Silian_toast.success(Silian_t("admin.broadcast.recipientFilters.added"));
  };

  const Silian_removeFilterGroup = (Silian_index) => {
    Silian_setAppliedFilters((Silian_prev) => Silian_prev.filter((Silian__, Silian_idx) => Silian_idx !== Silian_index));
  };

  const Silian_validateForm = () => {
    const Silian_addAnnouncementMarkers = (Silian_title) => {
      if (!Silian_title || typeof Silian_title !== "string") return Silian_title;
      const Silian_trimmed = Silian_title.trim();
      const Silian_lower = Silian_trimmed.toLowerCase();
      // If title already contains announcement markers or keywords, don't add
      if (
        /(\[announcement\]|\[公告\]|【公告】|\b(公告|announcement|broadcast|boardcast|system|系统)\b)/i.test(
          Silian_lower,
        )
      ) {
        return Silian_trimmed;
      }
      // Prepend English and Chinese markers for clarity
      return `[Announcement/公告] ${Silian_trimmed}`;
    };

    const Silian_normalizedPriority = Silian_PRIORITIES.includes(Silian_form.priority)
      ? Silian_form.priority
      : "normal";
    const Silian_payload = {
      title: Silian_addAnnouncementMarkers(Silian_form.title.trim()),
      content: Silian_form.content.trim(),
      content_format: Silian_normalizeAnnouncementContentFormat(Silian_form.content_format),
      priority: Silian_normalizedPriority,
    };

    if (Silian_payload.content_format === Silian_ANNOUNCEMENT_CONTENT_FORMAT_HTML) {
      Silian_payload.render_profile = Silian_ANNOUNCEMENT_RENDER_PROFILE_HTML;
    }

    const Silian_nextErrors = {};

    if (!Silian_payload.title) {
      Silian_nextErrors.title = Silian_t("admin.broadcast.validation.titleRequired");
    }
    if (!Silian_payload.content) {
      Silian_nextErrors.content = Silian_t("admin.broadcast.validation.contentRequired");
    }
    if (!Silian_PRIORITIES.includes(Silian_form.priority)) {
      Silian_nextErrors.priority = Silian_t("admin.broadcast.validation.priorityInvalid");
    }

    if (Silian_form.scope === "custom") {
      const Silian_manualInput = Silian_form.target_users_text.trim();
      const Silian_combinedIds = new Set(Silian_selectedRecipientIds);

      if (Silian_customTargetIds.length > 0) {
        Silian_customTargetIds.forEach((Silian_id) => Silian_combinedIds.add(Silian_id));
      } else if (Silian_manualInput.length > 0 && Silian_selectedRecipientIds.length === 0) {
        Silian_nextErrors.target_users_text = Silian_t(
          "admin.broadcast.validation.targetsInvalid",
        );
      }

      if (Silian_combinedIds.size > 0) {
        Silian_payload.target_users = Array.from(Silian_combinedIds);
      }

      if (Silian_combinedIds.size === 0 && Silian_appliedFilters.length === 0) {
        Silian_nextErrors.target_users_text = Silian_t(
          "admin.broadcast.validation.targetsRequired",
        );
      }

      if (Silian_appliedFilters.length > 0) {
        Silian_payload.target_filters = Silian_appliedFilters.map((Silian_filter) => ({
          ...Silian_filter,
        }));
      }
    }

    if (Silian_form.scope !== "custom") {
      const Silian_combined = new Set();
      if (Silian_selectedRecipientIds.length > 0) {
        Silian_selectedRecipientIds.forEach((Silian_id) => Silian_combined.add(Silian_id));
      }
      if (Silian_customTargetIds.length > 0) {
        Silian_customTargetIds.forEach((Silian_id) => Silian_combined.add(Silian_id));
      }
      if (Silian_combined.size > 0) {
        Silian_payload.target_users = Array.from(Silian_combined);
      }
      if (Silian_appliedFilters.length > 0) {
        Silian_payload.target_filters = Silian_appliedFilters.map((Silian_filter) => ({
          ...Silian_filter,
        }));
      }
    }

    Silian_setErrors(Silian_nextErrors);
    const Silian_firstError = Object.values(Silian_nextErrors)[0];
    return {
      payload: Silian_payload,
      isValid: Object.keys(Silian_nextErrors).length === 0,
      firstError: Silian_firstError,
    };
  };

  const Silian_broadcastMutation = Silian_useMutation(
    (Silian_payload) => Silian_adminAPI.broadcastMessage(Silian_payload),
    {
      onSuccess: (Silian_res, Silian_variables) => {
        const Silian_data = Silian_res?.data ?? {};
        const Silian_failedIds = Array.isArray(Silian_data.failed_user_ids)
          ? Silian_data.failed_user_ids
          : [];
        const Silian_invalidIds = Array.isArray(Silian_data.invalid_user_ids)
          ? Silian_data.invalid_user_ids
          : [];
        const Silian_summaryPayload = {
          sent: Silian_data.sent_count ?? 0,
          total:
            Silian_data.total_targets ??
            (Silian_variables?.target_users ? Silian_variables.target_users.length : 0),
          failed: Silian_failedIds,
          invalid: Silian_invalidIds,
          priority: Silian_data.priority ?? Silian_variables?.priority ?? "normal",
          emailDelivery: Silian_data.email_delivery ?? null,
        };

        Silian_toast.success(
          Silian_t("admin.broadcast.sendSuccess", { count: Silian_summaryPayload.sent }),
        );
        Silian_setPreview(null);
        Silian_setForm(Silian_INITIAL_FORM);
        Silian_setErrors({});
        Silian_setResult(Silian_summaryPayload);
        Silian_setExpanded({});
        Silian_setSelectedRecipients(new Map());
        Silian_setAppliedFilters([]);
        Silian_refetchHistory();
      },
      onError: (Silian_error) => {
        const Silian_message =
          Silian_error?.response?.data?.error ||
          Silian_error?.message ||
          Silian_t("admin.broadcast.sendFailed");
        Silian_toast.error(Silian_message);
      },
    },
  );

  const Silian_flushBroadcastMutation = Silian_useMutation(
    (Silian_params = {}) => Silian_adminAPI.flushBroadcastQueue(Silian_params),
    {
      onSuccess: (Silian_res) => {
        const Silian_processed = Array.isArray(Silian_res?.data?.processed)
          ? Silian_res.data.processed
          : [];
        if (Silian_processed.length > 0) {
          Silian_toast.success(
            Silian_t("admin.broadcast.history.flushSuccess", {
              count: Silian_processed.length,
            }),
          );
        } else {
          Silian_toast(Silian_t("admin.broadcast.history.flushEmpty"));
        }
        Silian_refetchHistory();
      },
      onError: (Silian_error) => {
        const Silian_message =
          Silian_error?.response?.data?.error ||
          Silian_error?.message ||
          Silian_t("admin.broadcast.history.flushErrorDefault");
        Silian_toast.error(Silian_t("admin.broadcast.history.flushError", { message: Silian_message }));
      },
    },
  );

  const Silian_announcementDraftMutation = Silian_useMutation((Silian_payload) =>
    Silian_adminAPI.generateAnnouncementDraft(Silian_payload),
  );

  const Silian_handlePreview = () => {
    const { payload: Silian_payload, isValid: Silian_isValid, firstError: Silian_firstError } = Silian_validateForm();
    if (!Silian_isValid) {
      Silian_toast.error(Silian_firstError ?? Silian_t("admin.broadcast.validation.general"));
      return;
    }

    Silian_setPreview({
      title: Silian_payload.title,
      content: Silian_payload.content,
      contentFormat: Silian_payload.content_format,
      renderProfile: Silian_payload.render_profile ?? null,
      priority: Silian_payload.priority,
      scope: Silian_form.scope,
      targetCount:
        Silian_form.scope === "custom" ? (Silian_payload.target_users?.length ?? 0) : null,
    });
  };

  const Silian_handleSend = () => {
    const { payload: Silian_payload, isValid: Silian_isValid, firstError: Silian_firstError } = Silian_validateForm();
    if (!Silian_isValid) {
      Silian_toast.error(Silian_firstError ?? Silian_t("admin.broadcast.validation.general"));
      return;
    }
    Silian_setResult(null);
    Silian_broadcastMutation.mutate(Silian_payload);
  };

  const Silian_handleFlushBroadcasts = Silian_useCallback(() => {
    Silian_flushBroadcastMutation.mutate({ limit: 10 });
  }, [Silian_flushBroadcastMutation]);

  const Silian_handleApplyHtmlTemplate = Silian_useCallback((Silian_template) => {
    if (!Silian_template || typeof Silian_template.content !== "string") {
      return;
    }
    Silian_setField("content", Silian_template.content);
  }, []);

  const Silian_handleRunAnnouncementAi = Silian_useCallback(
    async (Silian_payload) => {
      try {
        const Silian_res = await Silian_announcementDraftMutation.mutateAsync({
          action: Silian_payload?.action ?? Silian_announcementAiAction,
          title: Silian_payload?.title ?? Silian_form.title,
          content: Silian_payload?.content ?? Silian_form.content,
          instruction: Silian_payload?.instruction ?? Silian_announcementAiInstruction,
          priority: Silian_payload?.priority ?? Silian_form.priority,
          content_format: Silian_payload?.content_format ?? Silian_selectedContentFormat,
          source: Silian_payload?.source ?? "admin:/admin/broadcast",
        });
        const Silian_data = Silian_res?.data?.data ?? {};
        Silian_toast.success(Silian_t("admin.broadcast.llmHelper.builtinSuccess"));
        return Silian_data;
      } catch (Silian_error) {
        const Silian_message =
          Silian_error?.response?.data?.error ||
          Silian_error?.message ||
          Silian_t("admin.broadcast.llmHelper.builtinFailed");
        Silian_toast.error(Silian_message);
        throw Silian_error;
      }
    },
    [
      Silian_announcementAiAction,
      Silian_announcementAiInstruction,
      Silian_announcementDraftMutation,
      Silian_form.content,
      Silian_form.priority,
      Silian_form.title,
      Silian_selectedContentFormat,
      Silian_t,
    ],
  );

  const Silian_toggleDetails = (Silian_id) => {
    Silian_setExpanded((Silian_prev) => ({ ...Silian_prev, [Silian_id]: !Silian_prev[Silian_id] }));
  };

  const Silian_handleExport = () => {
    if (!Silian_filteredItems.length) {
      Silian_toast.error(Silian_t("admin.broadcast.export.empty"));
      return;
    }
    try {
      const Silian_headers = [
        "id",
        "title",
        "content",
        "priority",
        "scope",
        "targets",
        "sent",
        "read",
        "unread",
        "failed",
        "invalid",
        "actor",
        "created_at",
        "read_users",
        "unread_users",
      ];
      const Silian_escapeCsv = (Silian_value) => {
        if (Silian_value === null || Silian_value === undefined) {
          return '""';
        }
        const Silian_str = String(Silian_value).replace(/"/g, '""');
        return `"${Silian_str}"`;
      };
      const Silian_rows = Silian_filteredItems.map((Silian_item) => {
        const Silian_actorLabel =
          Silian_item.actor_username ||
          (Silian_item.actor_user_id ? `#${Silian_item.actor_user_id}` : Silian_t("common.unknown"));
        const Silian_readUsers = Array.isArray(Silian_item.read_users)
          ? Silian_item.read_users
              .map(
                (Silian_user) =>
                  Silian_user.username || Silian_user.email || Silian_getRecipientFallbackLabel(Silian_user),
              )
              .join("; ")
          : "";
        const Silian_unreadUsers = Array.isArray(Silian_item.unread_users)
          ? Silian_item.unread_users
              .map(
                (Silian_user) =>
                  Silian_user.username || Silian_user.email || Silian_getRecipientFallbackLabel(Silian_user),
              )
              .join("; ")
          : "";
        return [
          Silian_item.id,
          Silian_item.title,
          Silian_item.content,
          Silian_item.priority,
          Silian_item.scope,
          Silian_item.target_count,
          Silian_item.sent_count,
          Silian_item.read_count,
          Silian_item.unread_count,
          Array.isArray(Silian_item.failed_user_ids)
            ? Silian_item.failed_user_ids.join(" ")
            : "",
          Array.isArray(Silian_item.invalid_user_ids)
            ? Silian_item.invalid_user_ids.join(" ")
            : "",
          Silian_actorLabel,
          Silian_item.created_at,
          Silian_readUsers,
          Silian_unreadUsers,
        ]
          .map(Silian_escapeCsv)
          .join(",");
      });
      const Silian_csvContent = [Silian_headers.join(","), ...Silian_rows].join("\n");
      const Silian_blob = new Blob([Silian_csvContent], { type: "text/csv;charset=utf-8;" });
      const Silian_url = window.URL.createObjectURL(Silian_blob);
      const Silian_link = document.createElement("a");
      Silian_link.href = Silian_url;
      Silian_link.setAttribute("download", `broadcast-history-${Date.now()}.csv`);
      document.body.appendChild(Silian_link);
      Silian_link.click();
      document.body.removeChild(Silian_link);
      window.URL.revokeObjectURL(Silian_url);
      Silian_toast.success(Silian_t("admin.broadcast.export.success"));
    } catch {
      Silian_toast.error(Silian_t("admin.broadcast.export.error"));
    }
  };

  const Silian_handlePageChange = (Silian_page) => {
    Silian_setExpanded({});
    Silian_setHistoryParams((Silian_prev) => ({ ...Silian_prev, page: Silian_page }));
  };

  const Silian_isSubmitting = Silian_broadcastMutation.isLoading;
  const Silian_invalidCount = Silian_result?.invalid?.length ?? 0;
  const Silian_failedCount = Silian_result?.failed?.length ?? 0;
  const Silian_exportDisabled = Silian_filteredItems.length === 0;
  const Silian_emailResult = Silian_useMemo(() => {
    if (!Silian_result?.emailDelivery) {
      return null;
    }
    const Silian_delivery = Silian_result.emailDelivery;
    return {
      status: Silian_delivery.status ?? "skipped",
      triggered: Boolean(Silian_delivery.triggered),
      attempted: Silian_delivery.attempted_recipients ?? 0,
      successfulChunks: Silian_delivery.successful_chunks ?? 0,
      failedChunks: Silian_delivery.failed_chunks ?? 0,
      missing: Array.isArray(Silian_delivery.missing_email_user_ids)
        ? Silian_delivery.missing_email_user_ids
        : [],
      failedRecipients: Array.isArray(Silian_delivery.failed_recipient_ids)
        ? Silian_delivery.failed_recipient_ids
        : [],
      errors: Array.isArray(Silian_delivery.errors) ? Silian_delivery.errors : [],
    };
  }, [Silian_result]);

  const Silian_emailResultVariant = Silian_useMemo(() => {
    if (!Silian_emailResult) {
      return "info";
    }
    switch (Silian_emailResult.status) {
      case "sent":
        return "success";
      case "partial":
        return "warning";
      case "failed":
        return "destructive";
      case "queued":
        return "info";
      default:
        return "info";
    }
  }, [Silian_emailResult]);

  const Silian_livePreview = Silian_useMemo(
    () => ({
      title: Silian_form.title.trim() || Silian_t("admin.broadcast.previewFallbackTitle"),
      content: Silian_form.content,
      contentFormat: Silian_selectedContentFormat,
      priority: Silian_form.priority,
      scope: Silian_form.scope,
    }),
    [
      Silian_form.content,
      Silian_form.priority,
      Silian_form.scope,
      Silian_form.title,
      Silian_selectedContentFormat,
      Silian_t,
    ],
  );

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold tracking-tight">
        {Silian_t("admin.broadcast.title")}
      </h2>
      <p className="text-muted-foreground">
        {Silian_t("admin.broadcast.description")}
      </p>

      <Silian_Tabs value={Silian_activeTab} onValueChange={Silian_setActiveTab} className="w-full">
        <Silian_TabsList className="mb-6 inline-flex rounded-[0.8rem] border border-border bg-muted/60 p-1.5 shadow-inner">
          <Silian_TabsTrigger
            value="compose"
            className="rounded-lg py-2 text-sm font-semibold transition-all duration-200 data-[state=active]:bg-card data-[state=active]:shadow"
          >
            {Silian_t("admin.broadcast.pageTabs.compose")}
          </Silian_TabsTrigger>
          <Silian_TabsTrigger
            value="history"
            className="rounded-lg py-2 text-sm font-semibold transition-all duration-200 data-[state=active]:bg-card data-[state=active]:shadow"
          >
            {Silian_t("admin.broadcast.pageTabs.history")}
          </Silian_TabsTrigger>
        </Silian_TabsList>

        <Silian_TabsContent value="compose" className="mt-0 space-y-6">
          <Silian_Card>
            <Silian_CardHeader className="space-y-2">
              <Silian_CardTitle className="text-xl">
                {Silian_t("admin.broadcast.pageTabs.compose")}
              </Silian_CardTitle>
              <Silian_CardDescription>
                {Silian_t("admin.broadcast.sections.contentDescription")}
              </Silian_CardDescription>
            </Silian_CardHeader>
            <Silian_CardContent className="space-y-6">
              {Object.keys(Silian_errors).length > 0 && (
                <Silian_Alert variant="warning">
                  <Silian_AlertTitle>
                    {Silian_t("admin.broadcast.validation.general")}
                  </Silian_AlertTitle>
                </Silian_Alert>
              )}

              <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
                <div className="xl:col-span-2">
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    {Silian_t("admin.broadcast.form.title")}
                  </label>
                  <Silian_Input
                    value={Silian_form.title}
                    onChange={(Silian_event) => Silian_setField("title", Silian_event.target.value)}
                    error={Boolean(Silian_errors.title)}
                    placeholder={Silian_t("admin.broadcast.form.title")}
                  />
                  {Silian_errors.title && (
                    <p className="mt-1 text-sm text-red-600">{Silian_errors.title}</p>
                  )}
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    {Silian_t("admin.broadcast.form.contentFormat")}
                  </label>
                  <select
                    value={Silian_selectedContentFormat}
                    onChange={(Silian_event) =>
                      Silian_setField("content_format", Silian_event.target.value)
                    }
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value={Silian_ANNOUNCEMENT_CONTENT_FORMAT_TEXT}>
                      {Silian_t("admin.broadcast.format.text")}
                    </option>
                    <option value={Silian_ANNOUNCEMENT_CONTENT_FORMAT_HTML}>
                      {Silian_t("admin.broadcast.format.html")}
                    </option>
                  </select>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {Silian_selectedContentFormat === Silian_ANNOUNCEMENT_CONTENT_FORMAT_HTML
                      ? Silian_t("admin.broadcast.format.profileHint")
                      : Silian_t("admin.broadcast.format.textHint")}
                  </p>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    {Silian_t("admin.broadcast.form.priority")}
                  </label>
                  <select
                    value={Silian_form.priority}
                    onChange={(Silian_event) => Silian_setField("priority", Silian_event.target.value)}
                    className={Silian_cn(
                      "w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-green-500",
                      Silian_errors.priority && "border-red-500 focus:ring-red-500",
                    )}
                  >
                    {Silian_PRIORITIES.map((Silian_value) => (
                      <option key={Silian_value} value={Silian_value}>
                        {Silian_t(`messages.priority.${Silian_value}`)}
                      </option>
                    ))}
                  </select>
                  {Silian_errors.priority && (
                    <p className="mt-1 text-sm text-red-600">{Silian_errors.priority}</p>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-border bg-muted/40 p-4">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-foreground">
                      {Silian_t("admin.broadcast.sections.content")}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {Silian_selectedContentFormat === Silian_ANNOUNCEMENT_CONTENT_FORMAT_HTML
                        ? Silian_t("admin.broadcast.form.contentFormatHtmlHint")
                        : Silian_t("admin.broadcast.form.contentFormatTextHint")}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Silian_Badge variant="outline">
                      {Silian_selectedContentFormat === Silian_ANNOUNCEMENT_CONTENT_FORMAT_HTML
                        ? Silian_t("admin.broadcast.format.html")
                        : Silian_t("admin.broadcast.format.text")}
                    </Silian_Badge>
                    <Silian_Badge variant="secondary">
                      {Silian_t(`messages.priority.${Silian_form.priority}`)}
                    </Silian_Badge>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-lg border bg-background p-4 shadow-sm">
                    <label className="mb-3 block text-sm font-medium text-foreground">
                      {Silian_t("admin.broadcast.form.content")}
                    </label>
                    {Silian_selectedContentFormat === Silian_ANNOUNCEMENT_CONTENT_FORMAT_HTML ? (
                      <div>
                        <Silian_AnnouncementTemplateEditor
                          value={Silian_form.content}
                          onChange={(Silian_value) => Silian_setField("content", Silian_value)}
                          onApplyTemplate={Silian_handleApplyHtmlTemplate}
                          title={Silian_form.title}
                          priority={Silian_form.priority}
                          contentFormat={Silian_selectedContentFormat}
                          action={Silian_announcementAiAction}
                          onActionChange={Silian_setAnnouncementAiAction}
                          instruction={Silian_announcementAiInstruction}
                          onInstructionChange={Silian_setAnnouncementAiInstruction}
                          onRunBuiltin={Silian_handleRunAnnouncementAi}
                          isBuiltinLoading={Silian_announcementDraftMutation.isLoading}
                          onUpdateTitle={(Silian_nextTitle) => Silian_setField("title", Silian_nextTitle)}
                          onUpdateFormat={(Silian_nextFormat) =>
                            Silian_setField(
                              "content_format",
                              Silian_normalizeAnnouncementContentFormat(Silian_nextFormat),
                            )
                          }
                          t={Silian_t}
                        />
                      </div>
                    ) : (
                      <Silian_Textarea
                        value={Silian_form.content}
                        onChange={(Silian_event) => Silian_setField("content", Silian_event.target.value)}
                        className={Silian_cn(
                          "min-h-[320px] resize-y",
                          Silian_errors.content &&
                            "border-red-500 focus-visible:ring-red-500",
                        )}
                        placeholder={Silian_t("admin.broadcast.form.content")}
                      />
                    )}
                    {Silian_errors.content && (
                      <p className="mt-2 text-sm text-red-600">{Silian_errors.content}</p>
                    )}
                  </div>

                  <div className="rounded-lg border bg-background p-4 shadow-sm">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h4 className="text-sm font-semibold text-foreground">
                          {Silian_t("admin.broadcast.livePreview.title")}
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          {Silian_t("admin.broadcast.previewTargets." + (Silian_form.scope === "custom" ? "custom" : "all"), {
                            count: Silian_selectedRecipientIds.length + Silian_customTargetIds.length,
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="grid gap-4 xl:grid-cols-2">
                      <div className="rounded-lg border border-border bg-muted/40 p-4">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <h5 className="text-sm font-semibold text-foreground">
                            {Silian_t("admin.broadcast.livePreview.web")}
                          </h5>
                          <Silian_Badge variant="outline">
                            {Silian_selectedContentFormat === Silian_ANNOUNCEMENT_CONTENT_FORMAT_HTML
                              ? Silian_t("admin.broadcast.format.html")
                              : Silian_t("admin.broadcast.format.text")}
                          </Silian_Badge>
                        </div>
                        <div className="rounded-md border bg-background p-4">
                          <h3 className="text-base font-semibold text-foreground">
                            {Silian_livePreview.title}
                          </h3>
                          <Silian_AnnouncementContent
                            content={Silian_livePreview.content}
                            contentFormat={Silian_livePreview.contentFormat}
                            className="mt-3"
                          />
                        </div>
                      </div>

                      <div className="rounded-lg border border-border bg-muted/40 p-4">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <h5 className="text-sm font-semibold text-foreground">
                            {Silian_t("admin.broadcast.livePreview.email")}
                          </h5>
                          <Silian_Badge variant="secondary">
                            {Silian_t(`messages.priority.${Silian_livePreview.priority}`)}
                          </Silian_Badge>
                        </div>
                        <Silian_AnnouncementEmailPreview
                          title={Silian_livePreview.title}
                          content={Silian_livePreview.content}
                          contentFormat={Silian_livePreview.contentFormat}
                          priority={Silian_livePreview.priority}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {Silian_selectedContentFormat === Silian_ANNOUNCEMENT_CONTENT_FORMAT_HTML && (
                <Silian_AnnouncementPromptHelper
                  title={Silian_form.title}
                  content={Silian_form.content}
                  priority={Silian_form.priority}
                  contentFormat={Silian_selectedContentFormat}
                  action={Silian_announcementAiAction}
                  instruction={Silian_announcementAiInstruction}
                  onActionChange={Silian_setAnnouncementAiAction}
                  onInstructionChange={Silian_setAnnouncementAiInstruction}
                  t={Silian_t}
                />
              )}

              <div className="border-t pt-6 space-y-4">
                <div>
                  <h3 className="text-base font-semibold text-foreground">
                    {Silian_t("admin.broadcast.sections.targeting")}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {Silian_t("admin.broadcast.sections.targetingDescription")}
                  </p>
                </div>

                <div>
              <label className="mb-2 block text-sm font-medium text-foreground">
                {Silian_t("admin.broadcast.form.scope")}
              </label>
              <select
                value={Silian_form.scope}
                onChange={(Silian_event) => Silian_setField("scope", Silian_event.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="all">{Silian_t("admin.broadcast.scope.all")}</option>
                <option value="custom">
                  {Silian_t("admin.broadcast.scope.custom")}
                </option>
              </select>
            </div>

            {Silian_form.scope === "custom" && (
              <div className="space-y-4 rounded-lg border border-border border-dashed bg-muted/40 p-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-foreground">
                      {Silian_t("admin.broadcast.form.targetUsers")}
                    </label>
                    <Silian_Input
                      placeholder={Silian_t(
                        "admin.broadcast.form.targetUsersPlaceholder",
                      )}
                      value={Silian_form.target_users_text}
                      onChange={(Silian_event) =>
                        Silian_setField("target_users_text", Silian_event.target.value)
                      }
                      error={Boolean(Silian_errors.target_users_text)}
                    />
                    {Silian_errors.target_users_text ? (
                      <p className="mt-1 text-sm text-red-600">
                        {Silian_errors.target_users_text}
                      </p>
                    ) : (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {Silian_customTargetIds.length > 0
                          ? Silian_t("admin.broadcast.helper.customCount", {
                              count: Silian_customTargetIds.length,
                            })
                          : Silian_t("admin.broadcast.helper.customEmpty")}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium text-foreground">
                        {Silian_t("admin.broadcast.recipients.selected")}
                      </h4>
                      {Silian_selectedRecipientIds.length > 0 && (
                        <Silian_Button
                          variant="ghost"
                          size="sm"
                          onClick={Silian_clearSelectedRecipients}
                        >
                          {Silian_t("common.clear")}
                        </Silian_Button>
                      )}
                    </div>
                    {Silian_selectedRecipientIds.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        {Silian_t("admin.broadcast.recipients.none")}
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {Silian_selectedRecipientList.map((Silian_entry) => {
                          const Silian_label =
                            Silian_entry.username || Silian_entry.email || `#${Silian_entry.id}`;
                          return (
                            <Silian_Badge
                              key={Silian_entry.id}
                              variant="secondary"
                              className="flex items-center gap-2"
                            >
                              <span>{Silian_label}</span>
                              <button
                                type="button"
                                onClick={() =>
                                  Silian_removeSelectedRecipient(Silian_entry.id)
                                }
                                className="text-xs text-muted-foreground hover:text-red-600"
                                aria-label={Silian_t("common.remove")}
                              >
                                ×
                              </button>
                            </Silian_Badge>
                          );
                        })}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {Silian_t("admin.broadcast.recipients.selectedCount", {
                        count: Silian_selectedRecipientIds.length,
                      })}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium text-foreground">
                      {Silian_t("admin.broadcast.recipientFilters.title")}
                    </h4>
                    {Silian_appliedFilters.length > 0 && (
                      <Silian_Button
                        variant="ghost"
                        size="sm"
                        onClick={() => Silian_setAppliedFilters([])}
                      >
                        {Silian_t("common.clear")}
                      </Silian_Button>
                    )}
                  </div>
                  {Silian_appliedFilters.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {Silian_t("admin.broadcast.recipientFilters.none")}
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {Silian_appliedFilters.map((Silian_filter, Silian_index) => (
                        <Silian_Badge
                          key={Silian_index}
                          variant="outline"
                          className="flex items-center gap-2"
                        >
                          <span>{Silian_describeFilter(Silian_filter)}</span>
                          <button
                            type="button"
                            onClick={() => Silian_removeFilterGroup(Silian_index)}
                            className="text-xs text-muted-foreground hover:text-red-600"
                            aria-label={Silian_t("common.remove")}
                          >
                            ×
                          </button>
                        </Silian_Badge>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium text-foreground">
                        {Silian_t("admin.broadcast.recipientSearch.title")}
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        {Silian_t("admin.broadcast.recipientSearch.description")}
                      </p>
                    </div>
                    <Silian_Button
                      variant="outline"
                      size="sm"
                      onClick={Silian_addFilterGroup}
                      disabled={!Silian_hasRecipientCriteria}
                      title={
                        !Silian_hasRecipientCriteria
                          ? Silian_t("admin.broadcast.recipientFilters.hint")
                          : undefined
                      }
                    >
                      {Silian_t("admin.broadcast.recipientFilters.add")}
                    </Silian_Button>
                  </div>

                  {!Silian_hasRecipientCriteria && (
                    <p className="text-xs text-muted-foreground">
                      {Silian_t("admin.broadcast.recipientFilters.hint")}
                    </p>
                  )}

                  <div className="grid gap-3 md:grid-cols-4">
                    <Silian_Input
                      value={Silian_recipientForm.search}
                      onChange={(Silian_event) =>
                        Silian_setRecipientField("search", Silian_event.target.value)
                      }
                      placeholder={Silian_t(
                        "admin.broadcast.recipientSearch.searchPlaceholder",
                      )}
                    />
                    <select
                      value={Silian_recipientForm.fields}
                      onChange={(Silian_event) =>
                        Silian_setRecipientField("fields", Silian_event.target.value)
                      }
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-transparent"
                    >
                      <option value="username,email,school,location">
                        {Silian_t("admin.broadcast.recipientSearch.fields.all")}
                      </option>
                      <option value="email">
                        {Silian_t("admin.broadcast.recipientSearch.fields.email")}
                      </option>
                      <option value="school,school_name">
                        {Silian_t("admin.broadcast.recipientSearch.fields.school")}
                      </option>
                      <option value="location">
                        {Silian_t("admin.broadcast.recipientSearch.fields.location")}
                      </option>
                      <option value="username">
                        {Silian_t("admin.broadcast.recipientSearch.fields.username")}
                      </option>
                    </select>
                    <Silian_Input
                      value={Silian_recipientForm.school}
                      onChange={(Silian_event) =>
                        Silian_setRecipientField("school", Silian_event.target.value)
                      }
                      placeholder={Silian_t(
                        "admin.broadcast.recipientSearch.schoolPlaceholder",
                      )}
                    />
                    <Silian_Input
                      value={Silian_recipientForm.emailSuffix}
                      onChange={(Silian_event) =>
                        Silian_setRecipientField("emailSuffix", Silian_event.target.value)
                      }
                      placeholder={Silian_t(
                        "admin.broadcast.recipientSearch.emailPlaceholder",
                      )}
                    />
                    <select
                      value={Silian_recipientForm.status}
                      onChange={(Silian_event) =>
                        Silian_setRecipientField("status", Silian_event.target.value)
                      }
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-transparent"
                    >
                      <option value="any">
                        {Silian_t("admin.broadcast.recipientSearch.status.any")}
                      </option>
                      <option value="active">
                        {Silian_t("admin.broadcast.recipientSearch.status.active")}
                      </option>
                      <option value="inactive">
                        {Silian_t("admin.broadcast.recipientSearch.status.inactive")}
                      </option>
                    </select>
                    <select
                      value={Silian_recipientForm.isAdmin}
                      onChange={(Silian_event) =>
                        Silian_setRecipientField("isAdmin", Silian_event.target.value)
                      }
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-transparent"
                    >
                      <option value="any">
                        {Silian_t("admin.broadcast.recipientSearch.role.any")}
                      </option>
                      <option value="1">
                        {Silian_t("admin.broadcast.recipientSearch.role.admin")}
                      </option>
                      <option value="0">
                        {Silian_t("admin.broadcast.recipientSearch.role.user")}
                      </option>
                    </select>
                    <select
                      value={Silian_recipientForm.limit}
                      onChange={(Silian_event) =>
                        Silian_setRecipientField(
                          "limit",
                          Number(Silian_event.target.value) || 25,
                        )
                      }
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-transparent"
                    >
                      {[10, 25, 50, 100].map((Silian_value) => (
                        <option key={Silian_value} value={Silian_value}>
                          {Silian_t("admin.broadcast.recipientSearch.limit", {
                            count: Silian_value,
                          })}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Silian_Button
                      type="button"
                      onClick={Silian_handleRecipientSearch}
                      disabled={Silian_recipientLoading}
                    >
                      {Silian_recipientLoading
                        ? Silian_t("common.loading")
                        : Silian_t("common.search")}
                    </Silian_Button>
                    <Silian_Button
                      type="button"
                      variant="outline"
                      onClick={Silian_addAllRecipientsFromResults}
                      disabled={
                        Silian_recipientLoading || Silian_recipientResults.items.length === 0
                      }
                    >
                      {Silian_t("admin.broadcast.recipientSearch.addAll")}
                    </Silian_Button>
                    <Silian_Button
                      type="button"
                      variant="ghost"
                      onClick={Silian_clearRecipientSearch}
                      disabled={Silian_recipientLoading}
                    >
                      {Silian_t("common.reset")}
                    </Silian_Button>
                  </div>

                  {Silian_recipientError && (
                    <Silian_Alert variant="destructive">
                      <Silian_AlertTitle>
                        {Silian_t("admin.broadcast.recipientSearch.error")}
                      </Silian_AlertTitle>
                      <Silian_AlertDescription>
                        {Silian_recipientError.message ?? Silian_t("common.retry")}
                      </Silian_AlertDescription>
                    </Silian_Alert>
                  )}

                  <div className="space-y-3">
                    {Silian_recipientLoading && (
                      <p className="text-sm text-muted-foreground">
                        {Silian_t("common.loading")}
                      </p>
                    )}
                    {!Silian_recipientLoading &&
                    Silian_recipientResults.items.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        {Silian_t("admin.broadcast.recipientSearch.noResults")}
                      </p>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground">
                          {Silian_t("admin.broadcast.recipientSearch.resultCount", {
                            count: Silian_recipientResults.items.length,
                          })}
                        </p>
                        {Silian_recipientResults.items.map((Silian_item) => {
                          const Silian_id = Number(Silian_item?.id ?? 0);
                          const Silian_checked = Silian_selectedRecipients.has(Silian_id);
                          const Silian_label = Silian_item.username || Silian_item.email || `#${Silian_id}`;
                          const Silian_statusValue =
                            typeof Silian_item?.status === "string"
                              ? Silian_item.status.toLowerCase()
                              : "";
                          const Silian_statusLabel =
                            Silian_statusValue === "active"
                              ? Silian_t("admin.users.statusActive")
                              : Silian_statusValue === "inactive"
                                ? Silian_t("admin.users.statusInactive")
                                : Silian_statusValue === "suspended"
                                  ? Silian_t("admin.users.statusSuspended")
                                  : "";
                          const Silian_rawAdmin = Silian_item?.is_admin;
                          const Silian_hasAdminFlag =
                            Silian_rawAdmin !== undefined &&
                            Silian_rawAdmin !== null &&
                            `${Silian_rawAdmin}` !== "";
                          const Silian_isAdmin =
                            Silian_rawAdmin === true ||
                            Silian_rawAdmin === 1 ||
                            Silian_rawAdmin === "1" ||
                            Silian_rawAdmin === "true";
                          return (
                            <label
                              key={Silian_id}
                              className="flex items-start gap-3 rounded-md border border-border bg-card p-3 shadow-sm"
                            >
                              <Silian_Checkbox
                                checked={Silian_checked}
                                onCheckedChange={() =>
                                  Silian_toggleRecipientSelection(Silian_item)
                                }
                              />
                              <div className="flex-1 space-y-1">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <Silian_HoverCard>
                                    <Silian_HoverCardTrigger asChild>
                                      <span className="cursor-help text-sm font-medium text-foreground transition-colors hover:text-green-600">
                                        {Silian_label}
                                      </span>
                                    </Silian_HoverCardTrigger>
                                    <Silian_HoverCardContent className="w-72">
                                      <div className="space-y-2">
                                        <p className="text-sm font-semibold text-foreground">
                                          {Silian_label}
                                        </p>
                                        <div className="space-y-1 text-xs text-muted-foreground">
                                          <div>
                                            <span className="font-medium text-foreground/80">
                                              {Silian_t(
                                                "admin.broadcast.recipientSearch.hover.userId",
                                              )}
                                              :
                                            </span>{" "}
                                            #{Silian_id}
                                          </div>
                                          {Silian_item.uuid && (
                                            <div>
                                              <span className="font-medium text-foreground/80">
                                                UUID:
                                              </span>{" "}
                                              {Silian_item.uuid}
                                            </div>
                                          )}
                                          {Silian_item.email && (
                                            <div>
                                              <span className="font-medium text-foreground/80">
                                                {Silian_t("common.email")}:
                                              </span>{" "}
                                              {Silian_item.email}
                                            </div>
                                          )}
                                          {Silian_item.school && (
                                            <div>
                                              <span className="font-medium text-foreground/80">
                                                {Silian_t(
                                                  "admin.broadcast.recipientSearch.hover.school",
                                                )}
                                                :
                                              </span>{" "}
                                              {Silian_item.school}
                                            </div>
                                          )}
                                          {Silian_item.location && (
                                            <div>
                                              <span className="font-medium text-foreground/80">
                                                {Silian_t(
                                                  "admin.broadcast.recipientSearch.hover.location",
                                                )}
                                                :
                                              </span>{" "}
                                              {Silian_item.location}
                                            </div>
                                          )}
                                          {(Silian_statusLabel || Silian_hasAdminFlag) && (
                                            <div className="flex flex-wrap items-center gap-2">
                                              {Silian_statusLabel && (
                                                <span
                                                  className={Silian_cn(
                                                    "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                                                    Silian_statusValue === "active"
                                                      ? "bg-green-100 text-green-800"
                                                      : "bg-amber-100 text-amber-800",
                                                  )}
                                                >
                                                  {Silian_statusLabel}
                                                </span>
                                              )}
                                              {Silian_hasAdminFlag && (
                                                <span className="inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                                                  {Silian_isAdmin
                                                    ? Silian_t("admin.users.roleAdmin")
                                                    : Silian_t("admin.users.roleUser")}
                                                </span>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </Silian_HoverCardContent>
                                  </Silian_HoverCard>
                                  <Silian_Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={(Silian_event) =>
                                      Silian_handleViewUserProfile(Silian_event, Silian_item)
                                    }
                                  >
                                    {Silian_t(
                                      "admin.broadcast.recipientSearch.viewProfile",
                                    )}
                                  </Silian_Button>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {Silian_item.email
                                    ? Silian_item.email
                                    : Silian_t(
                                        "admin.broadcast.recipientSearch.noEmail",
                                      )}
                                  {Silian_item.school ? ` • ${Silian_item.school}` : ""}
                                </p>
                                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                  <span>#{Silian_id}</span>
                                  {Silian_statusLabel && (
                                    <span
                                      className={
                                        Silian_statusValue === "active"
                                          ? "font-medium text-green-600"
                                          : "font-medium text-amber-700"
                                      }
                                    >
                                      {Silian_statusLabel}
                                    </span>
                                  )}
                                  {Silian_hasAdminFlag && (
                                    <span className="font-medium text-foreground/80">
                                      {Silian_isAdmin
                                        ? Silian_t("admin.users.roleAdmin")
                                        : Silian_t("admin.users.roleUser")}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </label>
                          );
                        })}

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                          <p className="text-xs text-muted-foreground">
                            {Silian_t("admin.broadcast.recipientSearch.pageInfo", {
                              page: Silian_recipientResults.pagination.page,
                            })}
                          </p>
                          <div className="flex gap-2">
                            <Silian_Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => Silian_handleRecipientPageChange("prev")}
                              disabled={
                                Silian_recipientLoading ||
                                Silian_recipientResults.pagination.page === 1
                              }
                            >
                              {Silian_t("common.previous")}
                            </Silian_Button>
                            <Silian_Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => Silian_handleRecipientPageChange("next")}
                              disabled={
                                Silian_recipientLoading ||
                                !Silian_recipientResults.pagination.has_more
                              }
                            >
                              {Silian_t("common.next")}
                            </Silian_Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

                <div className="flex justify-end gap-2">
              <Silian_Button
                type="button"
                variant="outline"
                onClick={Silian_handlePreview}
                disabled={Silian_isSubmitting}
              >
                {Silian_t("admin.broadcast.preview")}
              </Silian_Button>
              <Silian_Button
                type="button"
                onClick={Silian_handleSend}
                disabled={Silian_isSubmitting}
              >
                {Silian_isSubmitting ? Silian_t("common.sending") : Silian_t("admin.broadcast.send")}
              </Silian_Button>
                </div>
              </div>
            </Silian_CardContent>
          </Silian_Card>

          {Silian_preview && (
            <Silian_Card>
              <Silian_CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Silian_CardTitle className="text-lg">
                  {Silian_t("admin.broadcast.previewPanel")}
                </Silian_CardTitle>
                <div className="flex flex-wrap items-center gap-2">
                  <Silian_Badge variant="secondary">
                    {Silian_t(`messages.priority.${Silian_preview.priority}`)}
                  </Silian_Badge>
                  <Silian_Badge variant="outline">
                    {Silian_preview.contentFormat === Silian_ANNOUNCEMENT_CONTENT_FORMAT_HTML
                      ? Silian_t("admin.broadcast.format.html")
                      : Silian_t("admin.broadcast.format.text")}
                  </Silian_Badge>
                </div>
              </div>
              </Silian_CardHeader>
              <Silian_CardContent className="space-y-2">
                <div className="text-sm text-muted-foreground">
                  {Silian_preview.scope === "custom"
                    ? Silian_t("admin.broadcast.previewTargets.custom", {
                        count: Silian_preview.targetCount ?? 0,
                      })
                    : Silian_t("admin.broadcast.previewTargets.all")}
                </div>
                <div className="space-y-4">
                  <div>
                    <div className="mb-2 text-sm text-muted-foreground">
                      {Silian_t("admin.broadcast.livePreview.web")}
                    </div>
                    <div className="rounded-md border border-border bg-muted/40 p-4">
                      <div className="font-medium text-foreground">
                        {Silian_preview.title}
                      </div>
                      <Silian_AnnouncementContent
                        content={Silian_preview.content}
                        contentFormat={Silian_preview.contentFormat}
                        className="mt-2"
                      />
                    </div>
                  </div>
                  <div>
                    <div className="mb-2 text-sm text-muted-foreground">
                      {Silian_t("admin.broadcast.livePreview.email")}
                    </div>
                    <Silian_AnnouncementEmailPreview
                      title={Silian_preview.title}
                      content={Silian_preview.content}
                      contentFormat={Silian_preview.contentFormat}
                      priority={Silian_preview.priority}
                    />
                  </div>
                </div>
              <Silian_Alert className="mt-4" variant="info">
                <Silian_AlertTitle>{Silian_t("admin.broadcast.noticeTitle")}</Silian_AlertTitle>
                <Silian_AlertDescription>
                  {Silian_preview.contentFormat === Silian_ANNOUNCEMENT_CONTENT_FORMAT_HTML
                    ? Silian_t("admin.broadcast.noticeHtmlDesc")
                    : Silian_t("admin.broadcast.noticeDesc")}
                </Silian_AlertDescription>
              </Silian_Alert>
              </Silian_CardContent>
            </Silian_Card>
          )}

          {Silian_result && (
            <Silian_Card className="mb-6">
              <Silian_CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Silian_CardTitle className="text-lg">
                  {Silian_t("admin.broadcast.result.title")}
                </Silian_CardTitle>
                <Silian_Badge variant="outline">
                  {Silian_t(`messages.priority.${Silian_result.priority}`)}
                </Silian_Badge>
              </div>
              </Silian_CardHeader>
              <Silian_CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-4">
                <Silian_ResultStat
                  label={Silian_t("admin.broadcast.result.sent")}
                  value={Silian_result.sent}
                  tone="success"
                />
                <Silian_ResultStat
                  label={Silian_t("admin.broadcast.result.targets")}
                  value={Silian_result.total}
                />
                <Silian_ResultStat
                  label={Silian_t("admin.broadcast.result.failed")}
                  value={Silian_failedCount || Silian_t("admin.broadcast.result.none")}
                  tone={Silian_failedCount ? "danger" : "default"}
                />
                <Silian_ResultStat
                  label={Silian_t("admin.broadcast.result.invalid")}
                  value={Silian_invalidCount || Silian_t("admin.broadcast.result.none")}
                  tone={Silian_invalidCount ? "warning" : "default"}
                />
              </div>

              {Silian_failedCount > 0 && (
                <Silian_Alert variant="destructive">
                  <Silian_AlertTitle>{Silian_t("admin.broadcast.result.failed")}</Silian_AlertTitle>
                  <Silian_AlertDescription>
                    <p>{Silian_t("admin.broadcast.result.failedHint")}</p>
                    <span className="mt-2 block font-mono text-xs">
                      {Silian_result.failed.join(", ")}
                    </span>
                  </Silian_AlertDescription>
                </Silian_Alert>
              )}

              {Silian_invalidCount > 0 && (
                <Silian_Alert variant="warning">
                  <Silian_AlertTitle>{Silian_t("admin.broadcast.result.invalid")}</Silian_AlertTitle>
                  <Silian_AlertDescription>
                    <p>{Silian_t("admin.broadcast.result.invalidHint")}</p>
                    <span className="mt-2 block font-mono text-xs">
                      {Silian_result.invalid.join(", ")}
                    </span>
                  </Silian_AlertDescription>
                </Silian_Alert>
              )}

              {Silian_emailResult && (
                <Silian_Alert variant={Silian_emailResultVariant}>
                  <Silian_AlertTitle>
                    {Silian_t(`admin.broadcast.email.status.${Silian_emailResult.status}`)}
                  </Silian_AlertTitle>
                  <Silian_AlertDescription>
                    <p>
                      {Silian_emailResult.status === "queued"
                        ? Silian_t("admin.broadcast.email.queuedSummary", {
                            count: Silian_emailResult.attempted,
                          })
                        : Silian_t("admin.broadcast.email.summary", {
                            attempted: Silian_emailResult.attempted,
                            success: Silian_emailResult.successfulChunks,
                            failed: Silian_emailResult.failedChunks,
                          })}
                    </p>
                    {Silian_emailResult.missing.length > 0 && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        {Silian_t("admin.broadcast.email.missing", {
                          count: Silian_emailResult.missing.length,
                        })}
                        <span className="ml-1 font-mono">
                          {Silian_emailResult.missing.join(", ")}
                        </span>
                      </p>
                    )}
                    {Silian_emailResult.errors.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs font-medium text-muted-foreground">
                          {Silian_t("admin.broadcast.email.errorsTitle")}
                        </p>
                        <ul className="mt-1 space-y-1 text-xs font-mono">
                          {Silian_emailResult.errors.map((Silian_error, Silian_index) => (
                            <li key={`${Silian_error}-${Silian_index}`}>{Silian_error}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </Silian_AlertDescription>
                </Silian_Alert>
              )}
              </Silian_CardContent>
            </Silian_Card>
          )}
        </Silian_TabsContent>
        <Silian_TabsContent value="history" className="mt-0 space-y-6">
          <div className="space-y-4 rounded-lg border border-border bg-card p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-lg font-semibold">
                  {Silian_t("admin.broadcast.pageTabs.history")}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {Silian_t("admin.broadcast.history.description")}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Silian_Button
                  variant="outline"
                  size="sm"
                  onClick={() => Silian_resetFilters()}
                  disabled={Silian_isHistoryLoading || Silian_isHistoryFetching}
                >
                  {Silian_t("common.reset")}
                </Silian_Button>
                <Silian_Button
                  variant="outline"
                  size="sm"
                  onClick={() => Silian_refetchHistory()}
                  disabled={Silian_isHistoryLoading}
                >
                  {Silian_t("common.refresh")}
                </Silian_Button>
                <Silian_Button
                  variant="outline"
                  size="sm"
                  onClick={Silian_handleFlushBroadcasts}
                  disabled={Silian_flushBroadcastMutation.isLoading}
                >
                  {Silian_flushBroadcastMutation.isLoading
                    ? Silian_t("admin.broadcast.history.flushLoading")
                    : Silian_t("admin.broadcast.history.flushButton")}
                </Silian_Button>
                <Silian_Button
                  size="sm"
                  onClick={Silian_handleExport}
                  disabled={Silian_exportDisabled || Silian_isHistoryLoading}
                >
                  {Silian_t("admin.broadcast.export.label")}
                </Silian_Button>
              </div>
            </div>

            {Silian_historyError && (
              <Silian_Alert variant="destructive">
                <Silian_AlertTitle>{Silian_t("admin.broadcast.sendFailed")}</Silian_AlertTitle>
                <Silian_AlertDescription>
                  {Silian_historyError.message ??
                    Silian_t("admin.broadcast.history.loadFailed")}
                </Silian_AlertDescription>
              </Silian_Alert>
            )}

            <div className="grid gap-4 md:grid-cols-5">
              <Silian_ResultStat
                label={Silian_t("admin.broadcast.summary.broadcasts")}
                value={Silian_summary.broadcasts}
              />
              <Silian_ResultStat
                label={Silian_t("admin.broadcast.summary.targets")}
                value={Silian_summary.targets}
              />
              <Silian_ResultStat
                label={Silian_t("admin.broadcast.summary.delivered")}
                value={Silian_summary.sent}
                tone="success"
              />
              <Silian_ResultStat
                label={Silian_t("admin.broadcast.summary.read")}
                value={Silian_summary.read}
              />
              <Silian_ResultStat
                label={Silian_t("admin.broadcast.summary.unread")}
                value={Silian_summary.unread}
                tone={Silian_summary.unread ? "warning" : "default"}
              />
            </div>

            {Silian_isMessageStatsError && (
              <Silian_Alert variant="destructive">
                <Silian_AlertTitle>
                  {Silian_t("admin.broadcast.analytics.loadFailedTitle")}
                </Silian_AlertTitle>
                <Silian_AlertDescription>
                  {Silian_messageStatsError?.message ?? Silian_t("common.retry")}
                </Silian_AlertDescription>
              </Silian_Alert>
            )}

            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">
                      {Silian_t("admin.broadcast.analytics.trendTitle")}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {Silian_t("admin.broadcast.analytics.trendSubtitle")}
                    </p>
                  </div>
                  <Silian_Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => Silian_refetchMessageStats()}
                    disabled={Silian_isMessageStatsFetching}
                  >
                    {Silian_isMessageStatsFetching
                      ? Silian_t("admin.broadcast.analytics.refreshing")
                      : Silian_t("common.refresh")}
                  </Silian_Button>
                </div>
                <div className="mt-4 h-72">
                  {Silian_messageStatsInitialLoading ? (
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                      {Silian_t("common.loading")}
                    </div>
                  ) : Silian_messageTrendHasData ? (
                    <Silian_ResponsiveContainer>
                      <Silian_LineChart data={Silian_messageTrendData}>
                        <Silian_CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" />
                        <Silian_XAxis
                          dataKey="date"
                          tickFormatter={(Silian_value) => {
                            if (!Silian_value) return Silian_value;
                            const Silian_date = new Date(`${Silian_value}T00:00:00`);
                            return Number.isNaN(Silian_date.getTime())
                              ? Silian_value
                              : Silian_shortDateFormatter.format(Silian_date);
                          }}
                          stroke="#475569"
                          fontSize={12}
                        />
                        <Silian_YAxis
                          allowDecimals={false}
                          stroke="#475569"
                          fontSize={12}
                        />
                        <Silian_RechartsTooltip
                          formatter={(Silian_value) => Silian_numberFormatter.format(Silian_value)}
                          labelFormatter={(Silian_label) => {
                            if (!Silian_label) return Silian_label;
                            const Silian_date = new Date(`${Silian_label}T00:00:00`);
                            return Number.isNaN(Silian_date.getTime())
                              ? Silian_label
                              : Silian_shortDateFormatter.format(Silian_date);
                          }}
                        />
                        <Silian_Legend />
                        <Silian_Line
                          type="monotone"
                          dataKey="total"
                          stroke="#2563eb"
                          strokeWidth={2}
                          dot={false}
                          name={Silian_t("admin.broadcast.analytics.totalSeries")}
                        />
                        <Silian_Line
                          type="monotone"
                          dataKey="unread"
                          stroke="#f97316"
                          strokeWidth={2}
                          dot={false}
                          name={Silian_t("admin.broadcast.analytics.unreadSeries")}
                        />
                      </Silian_LineChart>
                    </Silian_ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                      {Silian_t("admin.broadcast.analytics.trendEmpty")}
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold text-foreground">
                    {Silian_t("admin.broadcast.analytics.priorityTitle")}
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    {Silian_t("admin.broadcast.analytics.prioritySubtitle")}
                  </span>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <Silian_ResultStat
                    label={Silian_t("admin.broadcast.analytics.totalMessages")}
                    value={Silian_numberFormatter.format(Silian_messageOverview.total)}
                  />
                  <Silian_ResultStat
                    label={Silian_t("admin.broadcast.analytics.readMessages")}
                    value={Silian_numberFormatter.format(Silian_messageOverview.read)}
                    tone="success"
                  />
                  <Silian_ResultStat
                    label={Silian_t("admin.broadcast.analytics.unreadMessages")}
                    value={Silian_numberFormatter.format(Silian_messageOverview.unread)}
                    tone={Silian_messageOverview.unread ? "warning" : "default"}
                  />
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  {Silian_t("admin.broadcast.analytics.unreadRatio")}{" "}
                  <span className="font-semibold text-orange-500">
                    {Silian_percentFormatter.format(Silian_messageOverview.unreadRatio || 0)}
                  </span>
                </p>
                <div className="mt-4 h-64">
                  {Silian_messageStatsInitialLoading ? (
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                      {Silian_t("common.loading")}
                    </div>
                  ) : Silian_messagePriorityHasData ? (
                    <Silian_ResponsiveContainer>
                      <Silian_BarChart
                        data={Silian_messagePriorityChartData}
                        layout="vertical"
                      >
                        <Silian_CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" />
                        <Silian_XAxis
                          type="number"
                          allowDecimals={false}
                          stroke="#475569"
                          fontSize={12}
                        />
                        <Silian_YAxis
                          type="category"
                          dataKey="name"
                          stroke="#475569"
                          fontSize={12}
                          width={90}
                        />
                        <Silian_RechartsTooltip
                          formatter={(Silian_value) => Silian_numberFormatter.format(Silian_value)}
                        />
                        <Silian_Legend />
                        <Silian_Bar
                          dataKey="total"
                          name={Silian_t("admin.broadcast.analytics.totalSeries")}
                          barSize={14}
                        >
                          {Silian_messagePriorityChartData.map((Silian_item) => (
                            <Silian_Cell
                              key={`priority-total-${Silian_item.priority}`}
                              fill={Silian_item.color}
                            />
                          ))}
                        </Silian_Bar>
                        <Silian_Bar
                          dataKey="unread"
                          name={Silian_t("admin.broadcast.analytics.unreadSeries")}
                          barSize={14}
                          fill="#f97316"
                        />
                      </Silian_BarChart>
                    </Silian_ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                      {Silian_t("admin.broadcast.analytics.priorityEmpty")}
                    </div>
                  )}
                </div>
                <div className="mt-4 space-y-2 text-xs text-muted-foreground">
                  {Silian_messagePriorityChartData.map((Silian_entry) => (
                    <div
                      key={Silian_entry.priority}
                      className="flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: Silian_entry.color }}
                        />
                        <span className="font-medium text-foreground/80">
                          {Silian_entry.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span>{Silian_numberFormatter.format(Silian_entry.total)}</span>
                        <span className="text-sky-600">
                          {Silian_t("admin.broadcast.analytics.unreadLabelShort")}{" "}
                          {Silian_numberFormatter.format(Silian_entry.unread)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-foreground">
                  {Silian_t("admin.broadcast.filters.search")}
                </label>
                <Silian_Input
                  value={Silian_filters.search}
                  onChange={(Silian_event) =>
                    Silian_updateFilters({ search: Silian_event.target.value })
                  }
                  placeholder={Silian_t("admin.broadcast.filters.searchPlaceholder")}
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">
                  {Silian_t("admin.broadcast.filters.priority")}
                </label>
                <select
                  value={Silian_filters.priority}
                  onChange={(Silian_event) =>
                    Silian_updateFilters({ priority: Silian_event.target.value })
                  }
                  className="bg-background w-full rounded-md border border-input px-3 py-2 text-sm text-foreground focus:border-transparent focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="any">{Silian_t("common.all")}</option>
                  {Silian_PRIORITIES.map((Silian_value) => (
                    <option key={Silian_value} value={Silian_value}>
                      {Silian_t(`messages.priority.${Silian_value}`)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">
                  {Silian_t("admin.broadcast.filters.scope")}
                </label>
                <select
                  value={Silian_filters.scope}
                  onChange={(Silian_event) =>
                    Silian_updateFilters({ scope: Silian_event.target.value })
                  }
                  className="bg-background w-full rounded-md border border-input px-3 py-2 text-sm text-foreground focus:border-transparent focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="any">{Silian_t("common.all")}</option>
                  <option value="all">{Silian_t("admin.broadcast.scope.all")}</option>
                  <option value="custom">
                    {Silian_t("admin.broadcast.scope.custom")}
                  </option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Silian_Switch
                id="broadcast-unread-toggle"
                checked={Silian_filters.unreadOnly}
                onCheckedChange={(Silian_checked) =>
                  Silian_updateFilters({ unreadOnly: Boolean(Silian_checked) })
                }
              />
              <label
                htmlFor="broadcast-unread-toggle"
                className="text-sm text-muted-foreground"
              >
                {Silian_t("admin.broadcast.filters.onlyUnread")}
              </label>
            </div>

            {Silian_isHistoryLoading ? (
              <p className="text-sm text-muted-foreground">
                {Silian_t("common.loading")}
              </p>
            ) : Silian_filteredItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {Silian_t("admin.broadcast.history.empty")}
              </p>
            ) : (
              <div className="space-y-4">
                {Silian_filteredItems.map((Silian_item) => {
                  const Silian_isExpanded = !!Silian_expanded[Silian_item.id];
                  const Silian_read = Silian_truncateUsers(Silian_item.read_users ?? []);
                  const Silian_unread = Silian_truncateUsers(Silian_item.unread_users ?? []);
                  const Silian_invalidIds = Silian_item.invalid_user_ids ?? [];
                  const Silian_failedIds = Silian_item.failed_user_ids ?? [];
                  const Silian_actorLabel =
                    Silian_item.actor_username ||
                    (Silian_item.actor_user_id
                      ? `#${Silian_item.actor_user_id}`
                      : Silian_t("common.unknown"));
                  const Silian_delivery = Silian_item.email_delivery ?? {};
                  const Silian_emailStatus = Silian_delivery?.status ?? "skipped";
                  const Silian_emailErrors = Array.isArray(Silian_delivery?.errors)
                    ? Silian_delivery.errors
                    : [];
                  const Silian_emailBadgeVariant =
                    {
                      sent: "secondary",
                      partial: "high",
                      failed: "destructive",
                      queued: "secondary",
                      skipped: "outline",
                    }[Silian_emailStatus] ?? "outline";

                  return (
                    <div
                      key={Silian_item.id}
                      className="rounded-lg border p-5 space-y-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                          <h4 className="text-lg font-semibold">
                            {Silian_item.title}
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            {Silian_formatDateTime(Silian_item.created_at, Silian_currentLanguage)}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {Silian_t("admin.broadcast.sentBy", {
                              actor: Silian_actorLabel,
                              id: Silian_item.actor_user_id ?? Silian_t("common.unknown"),
                            })}
                          </p>
                          <Silian_AnnouncementContent
                            content={Silian_item.content}
                            contentFormat={Silian_normalizeAnnouncementContentFormat(
                              Silian_item.content_format,
                            )}
                            className="bg-muted/50 rounded-md p-4"
                          />
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Silian_Badge variant="outline">
                            {Silian_t(`messages.priority.${Silian_item.priority}`)}
                          </Silian_Badge>
                          <Silian_Badge variant="secondary">
                            {Silian_t(
                              `admin.broadcast.scope.${Silian_item.scope === "custom" ? "custom" : "all"}`,
                            )}
                          </Silian_Badge>
                          <Silian_Badge variant="outline">
                            {Silian_normalizeAnnouncementContentFormat(
                              Silian_item.content_format,
                            ) === Silian_ANNOUNCEMENT_CONTENT_FORMAT_HTML
                              ? Silian_t("admin.broadcast.format.html")
                              : Silian_t("admin.broadcast.format.text")}
                          </Silian_Badge>
                          <Silian_Badge variant={Silian_emailBadgeVariant}>
                            {Silian_t(`admin.broadcast.email.status.${Silian_emailStatus}`)}
                          </Silian_Badge>
                        </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-4">
                        <Silian_ResultStat
                          label={Silian_t("admin.broadcast.result.sent")}
                          value={Silian_item.sent_count}
                          tone="success"
                        />
                        <Silian_ResultStat
                          label={Silian_t("admin.broadcast.result.targets")}
                          value={Silian_item.target_count}
                        />
                        <Silian_ResultStat
                          label={Silian_t("admin.broadcast.result.failed")}
                          value={
                            Silian_failedIds.length || Silian_t("admin.broadcast.result.none")
                          }
                          tone={
                            (Silian_failedIds.length ?? 0) > 0 ? "danger" : "default"
                          }
                        />
                        <Silian_ResultStat
                          label={Silian_t("admin.broadcast.result.invalid")}
                          value={
                            Silian_invalidIds.length ||
                            Silian_t("admin.broadcast.result.none")
                          }
                          tone={
                            (Silian_invalidIds.length ?? 0) > 0 ? "warning" : "default"
                          }
                        />
                      </div>

                      {Silian_failedIds.length > 0 && (
                        <Silian_Alert variant="destructive">
                          <Silian_AlertTitle>
                            {Silian_t("admin.broadcast.result.failed")}
                          </Silian_AlertTitle>
                          <Silian_AlertDescription>
                            <span className="font-mono text-xs">
                              {Silian_failedIds.join(", ")}
                            </span>
                          </Silian_AlertDescription>
                        </Silian_Alert>
                      )}

                      {Silian_invalidIds.length > 0 && (
                        <Silian_Alert variant="warning">
                          <Silian_AlertTitle>
                            {Silian_t("admin.broadcast.result.invalid")}
                          </Silian_AlertTitle>
                          <Silian_AlertDescription>
                            <span className="font-mono text-xs">
                              {Silian_invalidIds.join(", ")}
                            </span>
                          </Silian_AlertDescription>
                        </Silian_Alert>
                      )}

                      {Silian_delivery &&
                        (Silian_emailStatus !== "sent" ||
                          Silian_emailErrors.length > 0 ||
                          (Silian_delivery.missing_email_user_ids ?? []).length >
                            0) && (
                          <Silian_Alert
                            variant={
                              Silian_emailStatus === "failed"
                                ? "destructive"
                                : Silian_emailStatus === "partial"
                                  ? "warning"
                                  : "info"
                            }
                          >
                            <Silian_AlertTitle>
                              {Silian_t(`admin.broadcast.email.status.${Silian_emailStatus}`)}
                            </Silian_AlertTitle>
                            <Silian_AlertDescription>
                              <p>
                                {Silian_emailStatus === "queued"
                                  ? Silian_t("admin.broadcast.email.queuedSummary", {
                                      count: Silian_delivery.attempted_recipients ?? 0,
                                    })
                                  : Silian_t("admin.broadcast.email.summary", {
                                      attempted:
                                        Silian_delivery.attempted_recipients ?? 0,
                                      success: Silian_delivery.successful_chunks ?? 0,
                                      failed: Silian_delivery.failed_chunks ?? 0,
                                    })}
                              </p>
                              {Array.isArray(Silian_delivery.missing_email_user_ids) &&
                                Silian_delivery.missing_email_user_ids.length > 0 && (
                                  <p className="mt-2 text-xs text-muted-foreground">
                                    {Silian_t("admin.broadcast.email.missing", {
                                      count:
                                        Silian_delivery.missing_email_user_ids.length,
                                    })}
                                    <span className="ml-1 font-mono">
                                      {Silian_delivery.missing_email_user_ids.join(
                                        ", ",
                                      )}
                                    </span>
                                  </p>
                                )}
                              {Silian_emailErrors.length > 0 && (
                                <div className="mt-2">
                                  <p className="text-xs font-medium text-muted-foreground">
                                    {Silian_t("admin.broadcast.email.errorsTitle")}
                                  </p>
                                  <ul className="mt-1 space-y-1 text-xs font-mono">
                                    {Silian_emailErrors.map((Silian_error, Silian_index) => (
                                      <li key={`${Silian_error}-${Silian_index}`}>{Silian_error}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </Silian_AlertDescription>
                          </Silian_Alert>
                        )}

                      <Silian_Button
                        variant="ghost"
                        size="sm"
                        onClick={() => Silian_toggleDetails(Silian_item.id)}
                      >
                        {Silian_isExpanded
                          ? Silian_t("admin.broadcast.history.hideDetails")
                          : Silian_t("admin.broadcast.history.showDetails")}
                      </Silian_Button>

                      {Silian_isExpanded && (
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <h5 className="text-sm font-medium text-green-700">
                              {Silian_t("admin.broadcast.result.sent")} (
                              {Silian_item.read_count ?? Silian_read.list.length})
                            </h5>
                            <Silian_UserChips
                              users={Silian_read.list}
                              onViewUser={Silian_handleViewUserProfile}
                              t={Silian_t}
                            />
                            {Silian_read.more > 0 && (
                              <p className="text-xs text-muted-foreground">
                                {Silian_t("admin.broadcast.history.more", {
                                  count: Silian_read.more,
                                })}
                              </p>
                            )}
                          </div>
                          <div className="space-y-2">
                            <h5 className="text-sm font-medium text-yellow-700">
                              {Silian_t("admin.broadcast.result.unread")} (
                              {Silian_item.unread_count ?? Silian_unread.list.length})
                            </h5>
                            <Silian_UserChips
                              users={Silian_unread.list}
                              onViewUser={Silian_handleViewUserProfile}
                              t={Silian_t}
                            />
                            {Silian_unread.more > 0 && (
                              <p className="text-xs text-muted-foreground">
                                {Silian_t("admin.broadcast.history.more", {
                                  count: Silian_unread.more,
                                })}
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <Silian_Pagination
              currentPage={Silian_pagination.page ?? Silian_historyParams.page}
              totalPages={Silian_pagination.pages ?? 1}
              onPageChange={Silian_handlePageChange}
              itemsPerPage={Silian_pagination.limit ?? Silian_historyParams.limit}
              totalItems={Silian_pagination.total ?? Silian_filteredItems.length}
              className="pt-2"
            />
          </div>
        </Silian_TabsContent>
      </Silian_Tabs>
    </div>
  );
}

export default BroadcastCenter;
