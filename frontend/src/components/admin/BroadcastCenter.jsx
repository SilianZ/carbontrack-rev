import React, { useMemo, useState, useCallback } from "react";
import { useMutation, useQuery } from "react-query";
import { toast } from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Legend,
  Tooltip as RechartsTooltip,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import { useTranslation } from "../../hooks/useTranslation";
import { adminAPI } from "../../lib/api";
import { Button } from "../ui/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/Card";
import { Input } from "../ui/Input";
import { Textarea } from "../ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "../ui/Alert";
import { Badge } from "../ui/badge";
import { Switch } from "../ui/switch";
import { Checkbox } from "../ui/checkbox";
import { Pagination } from "../ui/Pagination";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/Tabs";
import { cn } from "../../lib/utils";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "../ui/hover-card";
import { AnnouncementContent } from "../content/AnnouncementContent";
import { AnnouncementEmailPreview } from "../content/AnnouncementEmailPreview";
import { AnnouncementPromptHelper } from "../content/AnnouncementPromptHelper";
import { AnnouncementTemplateEditor } from "../content/AnnouncementTemplateEditor";
import { ANNOUNCEMENT_PROMPT_ACTION_GENERATE } from "../../lib/announcementPrompt";
import {
  ANNOUNCEMENT_CONTENT_FORMAT_HTML,
  ANNOUNCEMENT_CONTENT_FORMAT_TEXT,
  ANNOUNCEMENT_RENDER_PROFILE_HTML,
  normalizeAnnouncementContentFormat,
} from "../../lib/announcementHtml";

const PRIORITIES = ["low", "normal", "high", "urgent"];
const PRIORITY_COLORS = {
  urgent: "#ef4444",
  high: "#f97316",
  normal: "#3b82f6",
  low: "#10b981",
  default: "#6b7280",
};
const INITIAL_FORM = {
  title: "",
  content: "",
  content_format: ANNOUNCEMENT_CONTENT_FORMAT_TEXT,
  priority: "normal",
  scope: "all",
  target_users_text: "",
};
const MAX_USERS_PREVIEW = 20;
const HISTORY_DEFAULT_PARAMS = { page: 1, limit: 20 };
const FILTERS_DEFAULT = {
  search: "",
  priority: "any",
  scope: "any",
  unreadOnly: false,
};

const RECIPIENT_SEARCH_DEFAULT = {
  search: "",
  fields: "username,email,school,location",
  school: "",
  emailSuffix: "",
  status: "any",
  isAdmin: "any",
  limit: 25,
};

const RECIPIENT_FIELD_LABEL_KEYS = {
  email: "admin.broadcast.recipientSearch.fields.email",
  school: "admin.broadcast.recipientSearch.fields.school",
  location: "admin.broadcast.recipientSearch.fields.location",
  username: "admin.broadcast.recipientSearch.fields.username",
};

const parseTargetUserIds = (raw) => {
  if (!raw) {
    return [];
  }
  const tokens = raw
    .split(/[\s,]+/)
    .map((value) => value.trim())
    .filter(Boolean);

  const unique = new Set();
  tokens.forEach((token) => {
    const numeric = Number(token);
    if (Number.isInteger(numeric) && numeric > 0) {
      unique.add(numeric);
    }
  });
  return Array.from(unique);
};

const formatDateTime = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
};

const truncateUsers = (users, max = MAX_USERS_PREVIEW) => {
  if (!Array.isArray(users)) {
    return { list: [], more: 0 };
  }
  if (users.length <= max) {
    return { list: users, more: 0 };
  }
  return { list: users.slice(0, max), more: users.length - max };
};

const getRecipientUuid = (entry) => {
  if (typeof entry?.uuid === "string" && entry.uuid.trim()) {
    return entry.uuid.trim().toLowerCase();
  }
  if (typeof entry?.user_id === "string" && entry.user_id.trim()) {
    return entry.user_id.trim().toLowerCase();
  }
  return "";
};

const getRecipientLegacyId = (entry) => {
  const candidates = [entry?.legacy_user_id, entry?.id, entry?.user_id];
  for (const candidate of candidates) {
    const parsed = Number(candidate);
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return null;
};

const getRecipientFallbackLabel = (entry) => {
  const uuid = getRecipientUuid(entry);
  if (uuid) {
    return uuid;
  }
  const legacyId = getRecipientLegacyId(entry);
  return legacyId ? `#${legacyId}` : "#?";
};

function ResultStat({ label, value, tone = "default" }) {
  return (
    <div className="rounded-md border px-4 py-3">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 text-xl font-semibold",
          tone === "success" && "text-green-600",
          tone === "warning" && "text-yellow-600",
          tone === "danger" && "text-red-600",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function UserChips({ users, onViewUser, t }) {
  if (!Array.isArray(users) || users.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {t("admin.broadcast.result.none")}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {users.map((entry, index) => {
        const uuid = getRecipientUuid(entry);
        const legacyId = getRecipientLegacyId(entry);
        const identity = uuid || legacyId || index;
        if (!uuid && !legacyId) {
          return null;
        }

        const label =
          entry?.username ?? entry?.email ?? getRecipientFallbackLabel(entry);
        const email = entry?.email ?? entry?.user_email ?? null;
        const statusValue =
          typeof entry?.status === "string" ? entry.status.toLowerCase() : "";
        const statusLabel =
          statusValue === "active"
            ? t("admin.users.statusActive")
            : statusValue === "inactive"
              ? t("admin.users.statusInactive")
              : statusValue === "suspended"
                ? t("admin.users.statusSuspended")
                : null;
        const hasAdminFlag =
          entry?.is_admin !== undefined &&
          entry?.is_admin !== null &&
          `${entry.is_admin}` !== "";
        const isAdmin =
          entry?.is_admin === true ||
          entry?.is_admin === 1 ||
          entry?.is_admin === "1" ||
          entry?.is_admin === "true";

        const handleNavigate = (event) => {
          if (onViewUser) {
            onViewUser(event, { ...entry, id: legacyId, uuid });
          }
        };

        return (
          <div
            key={`${identity}-${index}`}
            className="flex items-center justify-between gap-3 rounded-md border border-gray-200 bg-gray-50 px-3 py-2"
          >
            <HoverCard>
              <HoverCardTrigger asChild>
                <span className="cursor-help text-sm font-medium text-gray-900 hover:text-green-600">
                  {label}
                </span>
              </HoverCardTrigger>
              <HoverCardContent className="w-64 space-y-1 text-xs text-muted-foreground">
                {legacyId && (
                  <div>
                    <span className="font-medium text-gray-700">
                      {t("admin.broadcast.recipientSearch.hover.userId")}
                    </span>{" "}
                    #{legacyId}
                  </div>
                )}
                {uuid && (
                  <div>
                    <span className="font-medium text-gray-700">UUID</span>{" "}
                    {uuid}
                  </div>
                )}
                {email && (
                  <div>
                    <span className="font-medium text-gray-700">
                      {t("common.email")}
                    </span>{" "}
                    {email}
                  </div>
                )}
                {statusLabel && (
                  <div>
                    <span className="font-medium text-gray-700">
                      {t("admin.broadcast.recipientSearch.hover.status")}
                    </span>{" "}
                    {statusLabel}
                  </div>
                )}
                {hasAdminFlag && (
                  <div>
                    <span className="font-medium text-gray-700">
                      {t("admin.broadcast.recipientSearch.hover.role")}
                    </span>{" "}
                    {isAdmin
                      ? t("admin.users.roleAdmin")
                      : t("admin.users.roleUser")}
                  </div>
                )}
              </HoverCardContent>
            </HoverCard>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleNavigate}
            >
              {t("admin.broadcast.recipientSearch.viewProfile")}
            </Button>
          </div>
        );
      })}
    </div>
  );
}

export function BroadcastCenter() {
  const { t } = useTranslation();
  const numberFormatter = useMemo(() => new Intl.NumberFormat(), []);
  const percentFormatter = useMemo(
    () =>
      new Intl.NumberFormat(undefined, {
        style: "percent",
        maximumFractionDigits: 1,
      }),
    [],
  );
  const shortDateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }),
    [],
  );
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("compose");
  const [form, setForm] = useState(INITIAL_FORM);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [errors, setErrors] = useState({});
  const [expanded, setExpanded] = useState({});
  const [historyParams, setHistoryParams] = useState(HISTORY_DEFAULT_PARAMS);
  const [filters, setFilters] = useState(FILTERS_DEFAULT);
  const [recipientForm, setRecipientForm] = useState(RECIPIENT_SEARCH_DEFAULT);
  const [recipientResults, setRecipientResults] = useState({
    items: [],
    pagination: {
      page: 1,
      has_more: false,
      limit: RECIPIENT_SEARCH_DEFAULT.limit,
    },
  });
  const [recipientLoading, setRecipientLoading] = useState(false);
  const [recipientError, setRecipientError] = useState(null);
  const [selectedRecipients, setSelectedRecipients] = useState(() => new Map());
  const [appliedFilters, setAppliedFilters] = useState([]);
  const [announcementAiAction, setAnnouncementAiAction] = useState(
    ANNOUNCEMENT_PROMPT_ACTION_GENERATE,
  );
  const [announcementAiInstruction, setAnnouncementAiInstruction] =
    useState("");

  const hasRecipientCriteria = useMemo(() => {
    return Boolean(
      recipientForm.search.trim() ||
      recipientForm.school.trim() ||
      recipientForm.emailSuffix.trim() ||
      (recipientForm.status && recipientForm.status !== "any") ||
      (recipientForm.isAdmin && recipientForm.isAdmin !== "any"),
    );
  }, [recipientForm]);

  const customTargetIds = useMemo(() => {
    if (form.scope !== "custom") {
      return [];
    }
    return parseTargetUserIds(form.target_users_text);
  }, [form.scope, form.target_users_text]);

  const selectedRecipientList = useMemo(
    () => Array.from(selectedRecipients.values()),
    [selectedRecipients],
  );
  const selectedRecipientIds = useMemo(
    () =>
      selectedRecipientList
        .map((entry) => Number(entry?.id ?? 0))
        .filter((id) => Number.isInteger(id) && id > 0),
    [selectedRecipientList],
  );
  const selectedContentFormat = useMemo(
    () => normalizeAnnouncementContentFormat(form.content_format),
    [form.content_format],
  );

  const {
    data: adminStatsData,
    isLoading: isMessageStatsLoading,
    isFetching: isMessageStatsFetching,
    isError: isMessageStatsError,
    error: messageStatsError,
    refetch: refetchMessageStats,
  } = useQuery(
    ["admin-message-stats"],
    () => adminAPI.getStats().then((res) => res.data?.data ?? {}),
    {
      staleTime: 60000,
      refetchOnWindowFocus: false,
    },
  );

  const {
    data: historyResponse,
    isLoading: isHistoryLoading,
    isFetching: isHistoryFetching,
    error: historyError,
    refetch: refetchHistory,
  } = useQuery(
    ["admin-broadcast-history", historyParams],
    () => adminAPI.getBroadcasts(historyParams).then((res) => res.data),
    {
      keepPreviousData: true,
      staleTime: 60000,
    },
  );

  const pagination = historyResponse?.pagination ?? {};
  const messageOverview = useMemo(() => {
    const stats = adminStatsData?.messages ?? {};
    const totalRaw = Number(stats?.total_messages ?? 0);
    const unreadRaw = Number(stats?.unread_messages ?? 0);
    let readRaw = Number(stats?.read_messages ?? 0);
    const total = Number.isFinite(totalRaw) ? Math.max(0, totalRaw) : 0;
    const unread = Number.isFinite(unreadRaw) ? Math.max(0, unreadRaw) : 0;
    if (!Number.isFinite(readRaw) || (readRaw === 0 && total >= unread)) {
      readRaw = total - unread;
    }
    const read = Math.max(
      0,
      Number.isFinite(readRaw) ? readRaw : total - unread,
    );
    const ratioRaw = Number(
      stats?.unread_ratio ?? (total > 0 ? unread / Math.max(total, 1) : 0),
    );
    const unreadRatio = Math.min(
      Math.max(Number.isFinite(ratioRaw) ? ratioRaw : 0, 0),
      1,
    );
    return { total, unread, read, unreadRatio };
  }, [adminStatsData]);

  const messagePriorityData = useMemo(() => {
    const rows = adminStatsData?.messages?.priority_breakdown;
    if (!Array.isArray(rows)) {
      return [];
    }
    return rows.map((row) => {
      const priorityRaw =
        typeof row?.priority === "string" ? row.priority : "normal";
      const priority = priorityRaw.toLowerCase() || "normal";
      const totalRaw = Number(row?.total ?? 0);
      const unreadRaw = Number(row?.unread ?? 0);
      let readRaw = Number(row?.read ?? 0);
      const total = Number.isFinite(totalRaw) ? Math.max(0, totalRaw) : 0;
      const unread = Number.isFinite(unreadRaw) ? Math.max(0, unreadRaw) : 0;
      if (!Number.isFinite(readRaw) || (readRaw === 0 && total >= unread)) {
        readRaw = total - unread;
      }
      const read = Math.max(
        0,
        Number.isFinite(readRaw) ? readRaw : total - unread,
      );
      const ratioRaw = Number(
        row?.unread_ratio ?? (total > 0 ? unread / Math.max(total, 1) : 0),
      );
      const unreadRatio = Math.min(
        Math.max(Number.isFinite(ratioRaw) ? ratioRaw : 0, 0),
        1,
      );
      return { priority, total, unread, read, unreadRatio };
    });
  }, [adminStatsData]);

  const messageTrendData = useMemo(() => {
    const rows = adminStatsData?.messages?.daily_counts;
    if (!Array.isArray(rows)) {
      return [];
    }
    return rows.map((row) => {
      const date = typeof row?.date === "string" ? row.date : "";
      const totalRaw = Number(row?.total ?? 0);
      const unreadRaw = Number(row?.unread ?? 0);
      let readRaw = Number(row?.read ?? 0);
      const total = Number.isFinite(totalRaw) ? Math.max(0, totalRaw) : 0;
      const unread = Number.isFinite(unreadRaw) ? Math.max(0, unreadRaw) : 0;
      if (!Number.isFinite(readRaw) || (readRaw === 0 && total >= unread)) {
        readRaw = total - unread;
      }
      const read = Math.max(
        0,
        Number.isFinite(readRaw) ? readRaw : total - unread,
      );
      return { date, total, unread, read };
    });
  }, [adminStatsData]);

  const messageTrendHasData = useMemo(
    () => messageTrendData.some((item) => item.total > 0 || item.unread > 0),
    [messageTrendData],
  );
  const messagePriorityHasData = useMemo(
    () => messagePriorityData.some((item) => item.total > 0 || item.unread > 0),
    [messagePriorityData],
  );
  const messagePriorityChartData = useMemo(
    () =>
      messagePriorityData.map((item) => {
        return {
          ...item,
          name: t(`messages.priority.${item.priority}`),
          color: PRIORITY_COLORS[item.priority] ?? PRIORITY_COLORS.default,
        };
      }),
    [messagePriorityData, t],
  );
  const messageStatsInitialLoading = isMessageStatsLoading && !adminStatsData;

  const filteredItems = useMemo(() => {
    const historyItems = Array.isArray(historyResponse?.data)
      ? historyResponse.data
      : [];
    if (historyItems.length === 0) {
      return [];
    }
    const search = filters.search.trim().toLowerCase();
    return historyItems.filter((item) => {
      if (filters.priority !== "any" && item.priority !== filters.priority) {
        return false;
      }
      if (filters.scope !== "any") {
        const scopeKey = item.scope === "custom" ? "custom" : "all";
        if (scopeKey !== filters.scope) {
          return false;
        }
      }
      if (filters.unreadOnly && (item.unread_count ?? 0) === 0) {
        return false;
      }
      if (!search) {
        return true;
      }
      const pooled = [
        item.title,
        item.content,
        item.actor_username,
        item.actor_user_id && `#${item.actor_user_id}`,
      ]
        .filter(Boolean)
        .map((value) => String(value).toLowerCase());
      return pooled.some((value) => value.includes(search));
    });
  }, [historyResponse, filters]);

  const summary = useMemo(() => {
    const totals = {
      broadcasts: filteredItems.length,
      targets: 0,
      sent: 0,
      read: 0,
      unread: 0,
    };
    filteredItems.forEach((item) => {
      totals.targets += item.target_count ?? 0;
      totals.sent += item.sent_count ?? 0;
      totals.read += item.read_count ?? 0;
      totals.unread += item.unread_count ?? 0;
    });
    return totals;
  }, [filteredItems]);

  const setField = (key, value) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (
        key === "target_users_text" &&
        typeof value === "string" &&
        value.trim().length > 0
      ) {
        next.scope = "custom";
      }
      return next;
    });
  };

  const updateFilters = (partial) => {
    setFilters((prev) => ({ ...prev, ...partial }));
    setHistoryParams((prev) => ({ ...prev, page: 1 }));
  };

  const resetFilters = () => {
    setFilters(FILTERS_DEFAULT);
    setHistoryParams((prev) => ({ ...prev, page: 1 }));
  };

  const setRecipientField = (key, value) => {
    setRecipientForm((prev) => ({ ...prev, [key]: value }));
  };

  const ensureCustomScope = useCallback(() => {
    setForm((prev) =>
      prev.scope === "custom" ? prev : { ...prev, scope: "custom" },
    );
  }, [setForm]);

  const buildRecipientParams = useCallback(
    (overrides = {}) => {
      const params = {};
      const search = recipientForm.search.trim();
      if (search) {
        params.search = search;
      }
      const fields = recipientForm.fields.trim();
      if (fields) {
        params.fields = fields;
      }
      const school = recipientForm.school.trim();
      if (school) {
        params.school = school;
      }
      const emailSuffix = recipientForm.emailSuffix.trim();
      if (emailSuffix) {
        params.email_suffix = emailSuffix;
      }
      if (recipientForm.status && recipientForm.status !== "any") {
        params.status = recipientForm.status;
      }
      if (recipientForm.isAdmin && recipientForm.isAdmin !== "any") {
        params.is_admin = recipientForm.isAdmin;
      }
      const limitRaw = overrides.limit ?? recipientForm.limit ?? 25;
      const limit = Math.max(10, Math.min(500, Number(limitRaw) || 25));
      params.limit = limit;
      const pageRaw = overrides.page ?? 1;
      params.page = Math.max(1, Number(pageRaw) || 1);
      return params;
    },
    [recipientForm],
  );

  const buildFilterPayload = useCallback(() => {
    const payload = {};
    const search = recipientForm.search.trim();
    const school = recipientForm.school.trim();
    const emailSuffix = recipientForm.emailSuffix.trim();
    const limit = Math.max(
      10,
      Math.min(500, Number(recipientForm.limit) || 25),
    );

    payload.limit = limit;

    if (search) {
      payload.search = search;
      if (
        recipientForm.fields &&
        recipientForm.fields !== RECIPIENT_SEARCH_DEFAULT.fields
      ) {
        payload.fields = recipientForm.fields;
      }
    }
    if (school) {
      payload.school = school;
    }
    if (emailSuffix) {
      payload.email_suffix = emailSuffix;
    }
    if (recipientForm.status && recipientForm.status !== "any") {
      payload.status = recipientForm.status;
    }
    if (recipientForm.isAdmin && recipientForm.isAdmin !== "any") {
      payload.is_admin = recipientForm.isAdmin;
    }
    return payload;
  }, [recipientForm]);

  const describeFilter = useCallback(
    (filter) => {
      if (!filter || typeof filter !== "object") {
        return t("admin.broadcast.recipientFilters.summary.fallback");
      }

      const parts = [];
      if (filter.search) {
        parts.push(
          t("admin.broadcast.recipientFilters.summary.search", {
            value: filter.search,
          }),
        );
        if (filter.fields) {
          const labels = filter.fields
            .split(",")
            .map((field) => field.trim())
            .filter(Boolean)
            .map((field) => {
              const normalized = field === "school_name" ? "school" : field;
              const labelKey = RECIPIENT_FIELD_LABEL_KEYS[normalized];
              return labelKey ? t(labelKey) : null;
            })
            .filter(Boolean);
          if (labels.length > 0) {
            parts.push(
              t("admin.broadcast.recipientFilters.summary.fields", {
                fields: labels.join(", "),
              }),
            );
          }
        }
      }
      if (filter.school) {
        parts.push(
          t("admin.broadcast.recipientFilters.summary.school", {
            value: filter.school,
          }),
        );
      }
      if (filter.email_suffix) {
        parts.push(
          t("admin.broadcast.recipientFilters.summary.emailSuffix", {
            value: filter.email_suffix,
          }),
        );
      }
      if (filter.status === "active" || filter.status === "inactive") {
        parts.push(
          t("admin.broadcast.recipientFilters.summary.status." + filter.status),
        );
      }
      if (
        filter.is_admin === "1" ||
        filter.is_admin === 1 ||
        filter.is_admin === true ||
        filter.is_admin === "true"
      ) {
        parts.push(t("admin.broadcast.recipientFilters.summary.role.admin"));
      } else if (
        filter.is_admin === "0" ||
        filter.is_admin === 0 ||
        filter.is_admin === false ||
        filter.is_admin === "false"
      ) {
        parts.push(t("admin.broadcast.recipientFilters.summary.role.user"));
      }
      if (filter.limit) {
        parts.push(
          t("admin.broadcast.recipientFilters.summary.limit", {
            count: filter.limit,
          }),
        );
      }

      if (parts.length === 0) {
        return t("admin.broadcast.recipientFilters.summary.fallback");
      }

      const joiner = t("admin.broadcast.recipientFilters.summary.joiner");
      return parts.join(joiner);
    },
    [t],
  );

  const loadRecipients = useCallback(
    async (overrides = {}) => {
      const params = buildRecipientParams(overrides);
      setRecipientLoading(true);
      setRecipientError(null);
      try {
        const res = await adminAPI.searchBroadcastRecipients(params);
        const payload = res?.data ?? {};
        const list = Array.isArray(payload.data) ? payload.data : [];
        const pagination = payload.pagination ?? {};
        const page = pagination.page ?? params.page ?? 1;
        const limit =
          pagination.limit ?? params.limit ?? recipientForm.limit ?? 25;
        const hasMore = Boolean(pagination.has_more);
        setRecipientResults({
          items: list,
          pagination: { page, limit, has_more: hasMore },
        });
      } catch (error) {
        setRecipientError(error);
        setRecipientResults((prev) => ({ ...prev, items: [] }));
      } finally {
        setRecipientLoading(false);
      }
    },
    [buildRecipientParams, recipientForm.limit],
  );

  const handleRecipientSearch = async () => {
    await loadRecipients({ page: 1 });
  };

  const handleRecipientPageChange = (direction) => {
    if (direction === "prev") {
      const prevPage = Math.max(1, recipientResults.pagination.page - 1);
      if (prevPage !== recipientResults.pagination.page) {
        loadRecipients({ page: prevPage });
      }
      return;
    }
    if (recipientResults.pagination.has_more) {
      loadRecipients({ page: recipientResults.pagination.page + 1 });
    }
  };

  const clearRecipientSearch = () => {
    setRecipientForm(RECIPIENT_SEARCH_DEFAULT);
    setRecipientResults({
      items: [],
      pagination: {
        page: 1,
        has_more: false,
        limit: RECIPIENT_SEARCH_DEFAULT.limit,
      },
    });
    setRecipientError(null);
  };

  const toggleRecipientSelection = useCallback(
    (recipient) => {
      if (!recipient || recipient.id === undefined || recipient.id === null) {
        return;
      }
      const id = Number(recipient.id);
      if (!Number.isInteger(id) || id <= 0) {
        return;
      }
      ensureCustomScope();
      setSelectedRecipients((prev) => {
        const next = new Map(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.set(id, {
            id,
            username: recipient.username ?? null,
            email: recipient.email ?? null,
            school: recipient.school ?? null,
          });
        }
        return next;
      });
    },
    [ensureCustomScope],
  );

  const handleViewUserProfile = useCallback(
    (event, recipient) => {
      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }
      if (!recipient) {
        toast.error(t("admin.broadcast.recipientSearch.invalidUser"));
        return;
      }
      const userUuid = getRecipientUuid(recipient);
      if (userUuid) {
        navigate(`/admin/users?userUuid=${userUuid}`);
        return;
      }
      if (recipient.id === undefined || recipient.id === null) {
        toast.error(t("admin.broadcast.recipientSearch.invalidUser"));
        return;
      }
      const userId = Number(recipient.id);
      if (!Number.isInteger(userId) || userId <= 0) {
        toast.error(t("admin.broadcast.recipientSearch.invalidUser"));
        return;
      }
      navigate(`/admin/users?userId=${userId}`);
    },
    [navigate, t],
  );

  const removeSelectedRecipient = (id) => {
    setSelectedRecipients((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  };

  const clearSelectedRecipients = () => {
    setSelectedRecipients(new Map());
  };

  const addAllRecipientsFromResults = () => {
    if (!recipientResults.items.length) {
      toast.error(t("admin.broadcast.recipients.emptySelection"));
      return;
    }
    ensureCustomScope();
    setSelectedRecipients((prev) => {
      const next = new Map(prev);
      recipientResults.items.forEach((item) => {
        const id = Number(item?.id ?? 0);
        if (Number.isInteger(id) && id > 0) {
          next.set(id, {
            id,
            username: item.username ?? null,
            email: item.email ?? null,
            school: item.school ?? null,
          });
        }
      });
      return next;
    });
    toast.success(t("admin.broadcast.recipients.addedAll"));
  };

  const addFilterGroup = () => {
    if (!hasRecipientCriteria) {
      toast.error(t("admin.broadcast.recipientFilters.requireCondition"));
      return;
    }
    ensureCustomScope();
    const payload = buildFilterPayload();
    setAppliedFilters((prev) => [...prev, payload]);
    toast.success(t("admin.broadcast.recipientFilters.added"));
  };

  const removeFilterGroup = (index) => {
    setAppliedFilters((prev) => prev.filter((_, idx) => idx !== index));
  };

  const validateForm = () => {
    const addAnnouncementMarkers = (title) => {
      if (!title || typeof title !== "string") return title;
      const trimmed = title.trim();
      const lower = trimmed.toLowerCase();
      // If title already contains announcement markers or keywords, don't add
      if (
        /(\[announcement\]|\[公告\]|【公告】|\b(公告|announcement|broadcast|boardcast|system|系统)\b)/i.test(
          lower,
        )
      ) {
        return trimmed;
      }
      // Prepend English and Chinese markers for clarity
      return `[Announcement/公告] ${trimmed}`;
    };

    const normalizedPriority = PRIORITIES.includes(form.priority)
      ? form.priority
      : "normal";
    const payload = {
      title: addAnnouncementMarkers(form.title.trim()),
      content: form.content.trim(),
      content_format: normalizeAnnouncementContentFormat(form.content_format),
      priority: normalizedPriority,
    };

    if (payload.content_format === ANNOUNCEMENT_CONTENT_FORMAT_HTML) {
      payload.render_profile = ANNOUNCEMENT_RENDER_PROFILE_HTML;
    }

    const nextErrors = {};

    if (!payload.title) {
      nextErrors.title = t("admin.broadcast.validation.titleRequired");
    }
    if (!payload.content) {
      nextErrors.content = t("admin.broadcast.validation.contentRequired");
    }
    if (!PRIORITIES.includes(form.priority)) {
      nextErrors.priority = t("admin.broadcast.validation.priorityInvalid");
    }

    if (form.scope === "custom") {
      const manualInput = form.target_users_text.trim();
      const combinedIds = new Set(selectedRecipientIds);

      if (customTargetIds.length > 0) {
        customTargetIds.forEach((id) => combinedIds.add(id));
      } else if (manualInput.length > 0 && selectedRecipientIds.length === 0) {
        nextErrors.target_users_text = t(
          "admin.broadcast.validation.targetsInvalid",
        );
      }

      if (combinedIds.size > 0) {
        payload.target_users = Array.from(combinedIds);
      }

      if (combinedIds.size === 0 && appliedFilters.length === 0) {
        nextErrors.target_users_text = t(
          "admin.broadcast.validation.targetsRequired",
        );
      }

      if (appliedFilters.length > 0) {
        payload.target_filters = appliedFilters.map((filter) => ({
          ...filter,
        }));
      }
    }

    if (form.scope !== "custom") {
      const combined = new Set();
      if (selectedRecipientIds.length > 0) {
        selectedRecipientIds.forEach((id) => combined.add(id));
      }
      if (customTargetIds.length > 0) {
        customTargetIds.forEach((id) => combined.add(id));
      }
      if (combined.size > 0) {
        payload.target_users = Array.from(combined);
      }
      if (appliedFilters.length > 0) {
        payload.target_filters = appliedFilters.map((filter) => ({
          ...filter,
        }));
      }
    }

    setErrors(nextErrors);
    const firstError = Object.values(nextErrors)[0];
    return {
      payload,
      isValid: Object.keys(nextErrors).length === 0,
      firstError,
    };
  };

  const broadcastMutation = useMutation(
    (payload) => adminAPI.broadcastMessage(payload),
    {
      onSuccess: (res, variables) => {
        const data = res?.data ?? {};
        const failedIds = Array.isArray(data.failed_user_ids)
          ? data.failed_user_ids
          : [];
        const invalidIds = Array.isArray(data.invalid_user_ids)
          ? data.invalid_user_ids
          : [];
        const summaryPayload = {
          sent: data.sent_count ?? 0,
          total:
            data.total_targets ??
            (variables?.target_users ? variables.target_users.length : 0),
          failed: failedIds,
          invalid: invalidIds,
          priority: data.priority ?? variables?.priority ?? "normal",
          emailDelivery: data.email_delivery ?? null,
        };

        toast.success(
          t("admin.broadcast.sendSuccess", { count: summaryPayload.sent }),
        );
        setPreview(null);
        setForm(INITIAL_FORM);
        setErrors({});
        setResult(summaryPayload);
        setExpanded({});
        setSelectedRecipients(new Map());
        setAppliedFilters([]);
        refetchHistory();
      },
      onError: (error) => {
        const message =
          error?.response?.data?.error ||
          error?.message ||
          t("admin.broadcast.sendFailed");
        toast.error(message);
      },
    },
  );

  const flushBroadcastMutation = useMutation(
    (params = {}) => adminAPI.flushBroadcastQueue(params),
    {
      onSuccess: (res) => {
        const processed = Array.isArray(res?.data?.processed)
          ? res.data.processed
          : [];
        if (processed.length > 0) {
          toast.success(
            t("admin.broadcast.history.flushSuccess", {
              count: processed.length,
            }),
          );
        } else {
          toast(t("admin.broadcast.history.flushEmpty"));
        }
        refetchHistory();
      },
      onError: (error) => {
        const message =
          error?.response?.data?.error ||
          error?.message ||
          t("admin.broadcast.history.flushErrorDefault");
        toast.error(t("admin.broadcast.history.flushError", { message }));
      },
    },
  );

  const announcementDraftMutation = useMutation((payload) =>
    adminAPI.generateAnnouncementDraft(payload),
  );

  const handlePreview = () => {
    const { payload, isValid, firstError } = validateForm();
    if (!isValid) {
      toast.error(firstError ?? t("admin.broadcast.validation.general"));
      return;
    }

    setPreview({
      title: payload.title,
      content: payload.content,
      contentFormat: payload.content_format,
      renderProfile: payload.render_profile ?? null,
      priority: payload.priority,
      scope: form.scope,
      targetCount:
        form.scope === "custom" ? (payload.target_users?.length ?? 0) : null,
    });
  };

  const handleSend = () => {
    const { payload, isValid, firstError } = validateForm();
    if (!isValid) {
      toast.error(firstError ?? t("admin.broadcast.validation.general"));
      return;
    }
    setResult(null);
    broadcastMutation.mutate(payload);
  };

  const handleFlushBroadcasts = useCallback(() => {
    flushBroadcastMutation.mutate({ limit: 10 });
  }, [flushBroadcastMutation]);

  const handleApplyHtmlTemplate = useCallback((template) => {
    if (!template || typeof template.content !== "string") {
      return;
    }
    setField("content", template.content);
  }, []);

  const handleRunAnnouncementAi = useCallback(
    async (payload) => {
      try {
        const res = await announcementDraftMutation.mutateAsync({
          action: payload?.action ?? announcementAiAction,
          title: payload?.title ?? form.title,
          content: payload?.content ?? form.content,
          instruction: payload?.instruction ?? announcementAiInstruction,
          priority: payload?.priority ?? form.priority,
          content_format: payload?.content_format ?? selectedContentFormat,
          source: payload?.source ?? "admin:/admin/broadcast",
        });
        const data = res?.data?.data ?? {};
        toast.success(t("admin.broadcast.llmHelper.builtinSuccess"));
        return data;
      } catch (error) {
        const message =
          error?.response?.data?.error ||
          error?.message ||
          t("admin.broadcast.llmHelper.builtinFailed");
        toast.error(message);
        throw error;
      }
    },
    [
      announcementAiAction,
      announcementAiInstruction,
      announcementDraftMutation,
      form.content,
      form.priority,
      form.title,
      selectedContentFormat,
      t,
    ],
  );

  const toggleDetails = (id) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleExport = () => {
    if (!filteredItems.length) {
      toast.error(t("admin.broadcast.export.empty"));
      return;
    }
    try {
      const headers = [
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
      const escapeCsv = (value) => {
        if (value === null || value === undefined) {
          return '""';
        }
        const str = String(value).replace(/"/g, '""');
        return `"${str}"`;
      };
      const rows = filteredItems.map((item) => {
        const actorLabel =
          item.actor_username ||
          (item.actor_user_id ? `#${item.actor_user_id}` : t("common.unknown"));
        const readUsers = Array.isArray(item.read_users)
          ? item.read_users
              .map(
                (user) =>
                  user.username || user.email || getRecipientFallbackLabel(user),
              )
              .join("; ")
          : "";
        const unreadUsers = Array.isArray(item.unread_users)
          ? item.unread_users
              .map(
                (user) =>
                  user.username || user.email || getRecipientFallbackLabel(user),
              )
              .join("; ")
          : "";
        return [
          item.id,
          item.title,
          item.content,
          item.priority,
          item.scope,
          item.target_count,
          item.sent_count,
          item.read_count,
          item.unread_count,
          Array.isArray(item.failed_user_ids)
            ? item.failed_user_ids.join(" ")
            : "",
          Array.isArray(item.invalid_user_ids)
            ? item.invalid_user_ids.join(" ")
            : "",
          actorLabel,
          item.created_at,
          readUsers,
          unreadUsers,
        ]
          .map(escapeCsv)
          .join(",");
      });
      const csvContent = [headers.join(","), ...rows].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `broadcast-history-${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success(t("admin.broadcast.export.success"));
    } catch {
      toast.error(t("admin.broadcast.export.error"));
    }
  };

  const handlePageChange = (page) => {
    setExpanded({});
    setHistoryParams((prev) => ({ ...prev, page }));
  };

  const isSubmitting = broadcastMutation.isLoading;
  const invalidCount = result?.invalid?.length ?? 0;
  const failedCount = result?.failed?.length ?? 0;
  const exportDisabled = filteredItems.length === 0;
  const emailResult = useMemo(() => {
    if (!result?.emailDelivery) {
      return null;
    }
    const delivery = result.emailDelivery;
    return {
      status: delivery.status ?? "skipped",
      triggered: Boolean(delivery.triggered),
      attempted: delivery.attempted_recipients ?? 0,
      successfulChunks: delivery.successful_chunks ?? 0,
      failedChunks: delivery.failed_chunks ?? 0,
      missing: Array.isArray(delivery.missing_email_user_ids)
        ? delivery.missing_email_user_ids
        : [],
      failedRecipients: Array.isArray(delivery.failed_recipient_ids)
        ? delivery.failed_recipient_ids
        : [],
      errors: Array.isArray(delivery.errors) ? delivery.errors : [],
    };
  }, [result]);

  const emailResultVariant = useMemo(() => {
    if (!emailResult) {
      return "info";
    }
    switch (emailResult.status) {
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
  }, [emailResult]);

  const livePreview = useMemo(
    () => ({
      title: form.title.trim() || t("admin.broadcast.previewFallbackTitle"),
      content: form.content,
      contentFormat: selectedContentFormat,
      priority: form.priority,
      scope: form.scope,
    }),
    [
      form.content,
      form.priority,
      form.scope,
      form.title,
      selectedContentFormat,
      t,
    ],
  );

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold tracking-tight">
        {t("admin.broadcast.title")}
      </h2>
      <p className="text-muted-foreground">
        {t("admin.broadcast.description")}
      </p>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-6 inline-flex bg-slate-100/50 dark:bg-slate-800/50 p-1.5 rounded-[0.8rem] border border-slate-200 dark:border-slate-800 shadow-inner">
          <TabsTrigger
            value="compose"
            className="rounded-lg py-2 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow text-sm font-semibold transition-all duration-200"
          >
            {t("admin.broadcast.pageTabs.compose")}
          </TabsTrigger>
          <TabsTrigger
            value="history"
            className="rounded-lg py-2 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow text-sm font-semibold transition-all duration-200"
          >
            {t("admin.broadcast.pageTabs.history")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="compose" className="mt-0 space-y-6">
          <Card>
            <CardHeader className="space-y-2">
              <CardTitle className="text-xl">
                {t("admin.broadcast.pageTabs.compose")}
              </CardTitle>
              <CardDescription>
                {t("admin.broadcast.sections.contentDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {Object.keys(errors).length > 0 && (
                <Alert variant="warning">
                  <AlertTitle>
                    {t("admin.broadcast.validation.general")}
                  </AlertTitle>
                </Alert>
              )}

              <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
                <div className="xl:col-span-2">
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    {t("admin.broadcast.form.title")}
                  </label>
                  <Input
                    value={form.title}
                    onChange={(event) => setField("title", event.target.value)}
                    error={Boolean(errors.title)}
                    placeholder={t("admin.broadcast.form.title")}
                  />
                  {errors.title && (
                    <p className="mt-1 text-sm text-red-600">{errors.title}</p>
                  )}
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    {t("admin.broadcast.form.contentFormat")}
                  </label>
                  <select
                    value={selectedContentFormat}
                    onChange={(event) =>
                      setField("content_format", event.target.value)
                    }
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value={ANNOUNCEMENT_CONTENT_FORMAT_TEXT}>
                      {t("admin.broadcast.format.text")}
                    </option>
                    <option value={ANNOUNCEMENT_CONTENT_FORMAT_HTML}>
                      {t("admin.broadcast.format.html")}
                    </option>
                  </select>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {selectedContentFormat === ANNOUNCEMENT_CONTENT_FORMAT_HTML
                      ? t("admin.broadcast.format.profileHint")
                      : t("admin.broadcast.format.textHint")}
                  </p>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    {t("admin.broadcast.form.priority")}
                  </label>
                  <select
                    value={form.priority}
                    onChange={(event) => setField("priority", event.target.value)}
                    className={cn(
                      "w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-green-500",
                      errors.priority && "border-red-500 focus:ring-red-500",
                    )}
                  >
                    {PRIORITIES.map((value) => (
                      <option key={value} value={value}>
                        {t(`messages.priority.${value}`)}
                      </option>
                    ))}
                  </select>
                  {errors.priority && (
                    <p className="mt-1 text-sm text-red-600">{errors.priority}</p>
                  )}
                </div>
              </div>

              <div className="rounded-xl border bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-900/30">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                      {t("admin.broadcast.sections.content")}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {selectedContentFormat === ANNOUNCEMENT_CONTENT_FORMAT_HTML
                        ? t("admin.broadcast.form.contentFormatHtmlHint")
                        : t("admin.broadcast.form.contentFormatTextHint")}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">
                      {selectedContentFormat === ANNOUNCEMENT_CONTENT_FORMAT_HTML
                        ? t("admin.broadcast.format.html")
                        : t("admin.broadcast.format.text")}
                    </Badge>
                    <Badge variant="secondary">
                      {t(`messages.priority.${form.priority}`)}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-lg border bg-background p-4 shadow-sm">
                    <label className="mb-3 block text-sm font-medium text-foreground">
                      {t("admin.broadcast.form.content")}
                    </label>
                    {selectedContentFormat === ANNOUNCEMENT_CONTENT_FORMAT_HTML ? (
                      <div>
                        <AnnouncementTemplateEditor
                          value={form.content}
                          onChange={(value) => setField("content", value)}
                          onApplyTemplate={handleApplyHtmlTemplate}
                          title={form.title}
                          priority={form.priority}
                          contentFormat={selectedContentFormat}
                          action={announcementAiAction}
                          onActionChange={setAnnouncementAiAction}
                          instruction={announcementAiInstruction}
                          onInstructionChange={setAnnouncementAiInstruction}
                          onRunBuiltin={handleRunAnnouncementAi}
                          isBuiltinLoading={announcementDraftMutation.isLoading}
                          onUpdateTitle={(nextTitle) => setField("title", nextTitle)}
                          onUpdateFormat={(nextFormat) =>
                            setField(
                              "content_format",
                              normalizeAnnouncementContentFormat(nextFormat),
                            )
                          }
                          t={t}
                        />
                      </div>
                    ) : (
                      <Textarea
                        value={form.content}
                        onChange={(event) => setField("content", event.target.value)}
                        className={cn(
                          "min-h-[320px] resize-y",
                          errors.content &&
                            "border-red-500 focus-visible:ring-red-500",
                        )}
                        placeholder={t("admin.broadcast.form.content")}
                      />
                    )}
                    {errors.content && (
                      <p className="mt-2 text-sm text-red-600">{errors.content}</p>
                    )}
                  </div>

                  <div className="rounded-lg border bg-background p-4 shadow-sm">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {t("admin.broadcast.livePreview.title")}
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          {t("admin.broadcast.previewTargets." + (form.scope === "custom" ? "custom" : "all"), {
                            count: selectedRecipientIds.length + customTargetIds.length,
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="grid gap-4 xl:grid-cols-2">
                      <div className="rounded-lg border bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/60">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <h5 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {t("admin.broadcast.livePreview.web")}
                          </h5>
                          <Badge variant="outline">
                            {selectedContentFormat === ANNOUNCEMENT_CONTENT_FORMAT_HTML
                              ? t("admin.broadcast.format.html")
                              : t("admin.broadcast.format.text")}
                          </Badge>
                        </div>
                        <div className="rounded-md border bg-background p-4">
                          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                            {livePreview.title}
                          </h3>
                          <AnnouncementContent
                            content={livePreview.content}
                            contentFormat={livePreview.contentFormat}
                            className="mt-3"
                          />
                        </div>
                      </div>

                      <div className="rounded-lg border bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/60">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <h5 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {t("admin.broadcast.livePreview.email")}
                          </h5>
                          <Badge variant="secondary">
                            {t(`messages.priority.${livePreview.priority}`)}
                          </Badge>
                        </div>
                        <AnnouncementEmailPreview
                          title={livePreview.title}
                          content={livePreview.content}
                          contentFormat={livePreview.contentFormat}
                          priority={livePreview.priority}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {selectedContentFormat === ANNOUNCEMENT_CONTENT_FORMAT_HTML && (
                <AnnouncementPromptHelper
                  title={form.title}
                  content={form.content}
                  priority={form.priority}
                  contentFormat={selectedContentFormat}
                  action={announcementAiAction}
                  instruction={announcementAiInstruction}
                  onActionChange={setAnnouncementAiAction}
                  onInstructionChange={setAnnouncementAiInstruction}
                  t={t}
                />
              )}

              <div className="border-t pt-6 space-y-4">
                <div>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                    {t("admin.broadcast.sections.targeting")}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {t("admin.broadcast.sections.targetingDescription")}
                  </p>
                </div>

                <div>
              <label className="mb-2 block text-sm font-medium text-foreground">
                {t("admin.broadcast.form.scope")}
              </label>
              <select
                value={form.scope}
                onChange={(event) => setField("scope", event.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="all">{t("admin.broadcast.scope.all")}</option>
                <option value="custom">
                  {t("admin.broadcast.scope.custom")}
                </option>
              </select>
            </div>

            {form.scope === "custom" && (
              <div className="space-y-4 rounded-lg border border-dashed bg-slate-50/60 p-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t("admin.broadcast.form.targetUsers")}
                    </label>
                    <Input
                      placeholder={t(
                        "admin.broadcast.form.targetUsersPlaceholder",
                      )}
                      value={form.target_users_text}
                      onChange={(event) =>
                        setField("target_users_text", event.target.value)
                      }
                      error={Boolean(errors.target_users_text)}
                    />
                    {errors.target_users_text ? (
                      <p className="mt-1 text-sm text-red-600">
                        {errors.target_users_text}
                      </p>
                    ) : (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {customTargetIds.length > 0
                          ? t("admin.broadcast.helper.customCount", {
                              count: customTargetIds.length,
                            })
                          : t("admin.broadcast.helper.customEmpty")}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium text-gray-700">
                        {t("admin.broadcast.recipients.selected")}
                      </h4>
                      {selectedRecipientIds.length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={clearSelectedRecipients}
                        >
                          {t("common.clear")}
                        </Button>
                      )}
                    </div>
                    {selectedRecipientIds.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        {t("admin.broadcast.recipients.none")}
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {selectedRecipientList.map((entry) => {
                          const label =
                            entry.username || entry.email || `#${entry.id}`;
                          return (
                            <Badge
                              key={entry.id}
                              variant="secondary"
                              className="flex items-center gap-2"
                            >
                              <span>{label}</span>
                              <button
                                type="button"
                                onClick={() =>
                                  removeSelectedRecipient(entry.id)
                                }
                                className="text-xs text-muted-foreground hover:text-red-600"
                                aria-label={t("common.remove")}
                              >
                                ×
                              </button>
                            </Badge>
                          );
                        })}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {t("admin.broadcast.recipients.selectedCount", {
                        count: selectedRecipientIds.length,
                      })}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium text-gray-700">
                      {t("admin.broadcast.recipientFilters.title")}
                    </h4>
                    {appliedFilters.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setAppliedFilters([])}
                      >
                        {t("common.clear")}
                      </Button>
                    )}
                  </div>
                  {appliedFilters.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {t("admin.broadcast.recipientFilters.none")}
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {appliedFilters.map((filter, index) => (
                        <Badge
                          key={index}
                          variant="outline"
                          className="flex items-center gap-2"
                        >
                          <span>{describeFilter(filter)}</span>
                          <button
                            type="button"
                            onClick={() => removeFilterGroup(index)}
                            className="text-xs text-muted-foreground hover:text-red-600"
                            aria-label={t("common.remove")}
                          >
                            ×
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium text-gray-700">
                        {t("admin.broadcast.recipientSearch.title")}
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        {t("admin.broadcast.recipientSearch.description")}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={addFilterGroup}
                      disabled={!hasRecipientCriteria}
                      title={
                        !hasRecipientCriteria
                          ? t("admin.broadcast.recipientFilters.hint")
                          : undefined
                      }
                    >
                      {t("admin.broadcast.recipientFilters.add")}
                    </Button>
                  </div>

                  {!hasRecipientCriteria && (
                    <p className="text-xs text-muted-foreground">
                      {t("admin.broadcast.recipientFilters.hint")}
                    </p>
                  )}

                  <div className="grid gap-3 md:grid-cols-4">
                    <Input
                      value={recipientForm.search}
                      onChange={(event) =>
                        setRecipientField("search", event.target.value)
                      }
                      placeholder={t(
                        "admin.broadcast.recipientSearch.searchPlaceholder",
                      )}
                    />
                    <select
                      value={recipientForm.fields}
                      onChange={(event) =>
                        setRecipientField("fields", event.target.value)
                      }
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    >
                      <option value="username,email,school,location">
                        {t("admin.broadcast.recipientSearch.fields.all")}
                      </option>
                      <option value="email">
                        {t("admin.broadcast.recipientSearch.fields.email")}
                      </option>
                      <option value="school,school_name">
                        {t("admin.broadcast.recipientSearch.fields.school")}
                      </option>
                      <option value="location">
                        {t("admin.broadcast.recipientSearch.fields.location")}
                      </option>
                      <option value="username">
                        {t("admin.broadcast.recipientSearch.fields.username")}
                      </option>
                    </select>
                    <Input
                      value={recipientForm.school}
                      onChange={(event) =>
                        setRecipientField("school", event.target.value)
                      }
                      placeholder={t(
                        "admin.broadcast.recipientSearch.schoolPlaceholder",
                      )}
                    />
                    <Input
                      value={recipientForm.emailSuffix}
                      onChange={(event) =>
                        setRecipientField("emailSuffix", event.target.value)
                      }
                      placeholder={t(
                        "admin.broadcast.recipientSearch.emailPlaceholder",
                      )}
                    />
                    <select
                      value={recipientForm.status}
                      onChange={(event) =>
                        setRecipientField("status", event.target.value)
                      }
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    >
                      <option value="any">
                        {t("admin.broadcast.recipientSearch.status.any")}
                      </option>
                      <option value="active">
                        {t("admin.broadcast.recipientSearch.status.active")}
                      </option>
                      <option value="inactive">
                        {t("admin.broadcast.recipientSearch.status.inactive")}
                      </option>
                    </select>
                    <select
                      value={recipientForm.isAdmin}
                      onChange={(event) =>
                        setRecipientField("isAdmin", event.target.value)
                      }
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    >
                      <option value="any">
                        {t("admin.broadcast.recipientSearch.role.any")}
                      </option>
                      <option value="1">
                        {t("admin.broadcast.recipientSearch.role.admin")}
                      </option>
                      <option value="0">
                        {t("admin.broadcast.recipientSearch.role.user")}
                      </option>
                    </select>
                    <select
                      value={recipientForm.limit}
                      onChange={(event) =>
                        setRecipientField(
                          "limit",
                          Number(event.target.value) || 25,
                        )
                      }
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    >
                      {[10, 25, 50, 100].map((value) => (
                        <option key={value} value={value}>
                          {t("admin.broadcast.recipientSearch.limit", {
                            count: value,
                          })}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      onClick={handleRecipientSearch}
                      disabled={recipientLoading}
                    >
                      {recipientLoading
                        ? t("common.loading")
                        : t("common.search")}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={addAllRecipientsFromResults}
                      disabled={
                        recipientLoading || recipientResults.items.length === 0
                      }
                    >
                      {t("admin.broadcast.recipientSearch.addAll")}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={clearRecipientSearch}
                      disabled={recipientLoading}
                    >
                      {t("common.reset")}
                    </Button>
                  </div>

                  {recipientError && (
                    <Alert variant="destructive">
                      <AlertTitle>
                        {t("admin.broadcast.recipientSearch.error")}
                      </AlertTitle>
                      <AlertDescription>
                        {recipientError.message ?? t("common.retry")}
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="space-y-3">
                    {recipientLoading && (
                      <p className="text-sm text-muted-foreground">
                        {t("common.loading")}
                      </p>
                    )}
                    {!recipientLoading &&
                    recipientResults.items.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        {t("admin.broadcast.recipientSearch.noResults")}
                      </p>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground">
                          {t("admin.broadcast.recipientSearch.resultCount", {
                            count: recipientResults.items.length,
                          })}
                        </p>
                        {recipientResults.items.map((item) => {
                          const id = Number(item?.id ?? 0);
                          const checked = selectedRecipients.has(id);
                          const label = item.username || item.email || `#${id}`;
                          const statusValue =
                            typeof item?.status === "string"
                              ? item.status.toLowerCase()
                              : "";
                          const statusLabel =
                            statusValue === "active"
                              ? t("admin.users.statusActive")
                              : statusValue === "inactive"
                                ? t("admin.users.statusInactive")
                                : statusValue === "suspended"
                                  ? t("admin.users.statusSuspended")
                                  : "";
                          const rawAdmin = item?.is_admin;
                          const hasAdminFlag =
                            rawAdmin !== undefined &&
                            rawAdmin !== null &&
                            `${rawAdmin}` !== "";
                          const isAdmin =
                            rawAdmin === true ||
                            rawAdmin === 1 ||
                            rawAdmin === "1" ||
                            rawAdmin === "true";
                          return (
                            <label
                              key={id}
                              className="flex items-start gap-3 rounded-md border border-gray-200 bg-white p-3 shadow-sm"
                            >
                              <Checkbox
                                checked={checked}
                                onCheckedChange={() =>
                                  toggleRecipientSelection(item)
                                }
                              />
                              <div className="flex-1 space-y-1">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <HoverCard>
                                    <HoverCardTrigger asChild>
                                      <span className="cursor-help text-sm font-medium text-gray-800 hover:text-green-600">
                                        {label}
                                      </span>
                                    </HoverCardTrigger>
                                    <HoverCardContent className="w-72">
                                      <div className="space-y-2">
                                        <p className="text-sm font-semibold text-gray-900">
                                          {label}
                                        </p>
                                        <div className="space-y-1 text-xs text-muted-foreground">
                                          <div>
                                            <span className="font-medium text-gray-700">
                                              {t(
                                                "admin.broadcast.recipientSearch.hover.userId",
                                              )}
                                              :
                                            </span>{" "}
                                            #{id}
                                          </div>
                                          {item.uuid && (
                                            <div>
                                              <span className="font-medium text-gray-700">
                                                UUID:
                                              </span>{" "}
                                              {item.uuid}
                                            </div>
                                          )}
                                          {item.email && (
                                            <div>
                                              <span className="font-medium text-gray-700">
                                                {t("common.email")}:
                                              </span>{" "}
                                              {item.email}
                                            </div>
                                          )}
                                          {item.school && (
                                            <div>
                                              <span className="font-medium text-gray-700">
                                                {t(
                                                  "admin.broadcast.recipientSearch.hover.school",
                                                )}
                                                :
                                              </span>{" "}
                                              {item.school}
                                            </div>
                                          )}
                                          {item.location && (
                                            <div>
                                              <span className="font-medium text-gray-700">
                                                {t(
                                                  "admin.broadcast.recipientSearch.hover.location",
                                                )}
                                                :
                                              </span>{" "}
                                              {item.location}
                                            </div>
                                          )}
                                          {(statusLabel || hasAdminFlag) && (
                                            <div className="flex flex-wrap items-center gap-2">
                                              {statusLabel && (
                                                <span
                                                  className={cn(
                                                    "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                                                    statusValue === "active"
                                                      ? "bg-green-100 text-green-800"
                                                      : "bg-amber-100 text-amber-800",
                                                  )}
                                                >
                                                  {statusLabel}
                                                </span>
                                              )}
                                              {hasAdminFlag && (
                                                <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                                                  {isAdmin
                                                    ? t("admin.users.roleAdmin")
                                                    : t("admin.users.roleUser")}
                                                </span>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </HoverCardContent>
                                  </HoverCard>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={(event) =>
                                      handleViewUserProfile(event, item)
                                    }
                                  >
                                    {t(
                                      "admin.broadcast.recipientSearch.viewProfile",
                                    )}
                                  </Button>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {item.email
                                    ? item.email
                                    : t(
                                        "admin.broadcast.recipientSearch.noEmail",
                                      )}
                                  {item.school ? ` • ${item.school}` : ""}
                                </p>
                                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                  <span>#{id}</span>
                                  {statusLabel && (
                                    <span
                                      className={
                                        statusValue === "active"
                                          ? "font-medium text-green-600"
                                          : "font-medium text-amber-700"
                                      }
                                    >
                                      {statusLabel}
                                    </span>
                                  )}
                                  {hasAdminFlag && (
                                    <span className="font-medium text-gray-700">
                                      {isAdmin
                                        ? t("admin.users.roleAdmin")
                                        : t("admin.users.roleUser")}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </label>
                          );
                        })}

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                          <p className="text-xs text-muted-foreground">
                            {t("admin.broadcast.recipientSearch.pageInfo", {
                              page: recipientResults.pagination.page,
                            })}
                          </p>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleRecipientPageChange("prev")}
                              disabled={
                                recipientLoading ||
                                recipientResults.pagination.page === 1
                              }
                            >
                              {t("common.previous")}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleRecipientPageChange("next")}
                              disabled={
                                recipientLoading ||
                                !recipientResults.pagination.has_more
                              }
                            >
                              {t("common.next")}
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

                <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handlePreview}
                disabled={isSubmitting}
              >
                {t("admin.broadcast.preview")}
              </Button>
              <Button
                type="button"
                onClick={handleSend}
                disabled={isSubmitting}
              >
                {isSubmitting ? t("common.sending") : t("admin.broadcast.send")}
              </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {preview && (
            <Card>
              <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-lg">
                  {t("admin.broadcast.previewPanel")}
                </CardTitle>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">
                    {t(`messages.priority.${preview.priority}`)}
                  </Badge>
                  <Badge variant="outline">
                    {preview.contentFormat === ANNOUNCEMENT_CONTENT_FORMAT_HTML
                      ? t("admin.broadcast.format.html")
                      : t("admin.broadcast.format.text")}
                  </Badge>
                </div>
              </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-sm text-muted-foreground">
                  {preview.scope === "custom"
                    ? t("admin.broadcast.previewTargets.custom", {
                        count: preview.targetCount ?? 0,
                      })
                    : t("admin.broadcast.previewTargets.all")}
                </div>
                <div className="space-y-4">
                  <div>
                    <div className="mb-2 text-sm text-muted-foreground">
                      {t("admin.broadcast.livePreview.web")}
                    </div>
                    <div className="rounded-md border bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/60">
                      <div className="font-medium text-slate-900 dark:text-slate-100">
                        {preview.title}
                      </div>
                      <AnnouncementContent
                        content={preview.content}
                        contentFormat={preview.contentFormat}
                        className="mt-2"
                      />
                    </div>
                  </div>
                  <div>
                    <div className="mb-2 text-sm text-muted-foreground">
                      {t("admin.broadcast.livePreview.email")}
                    </div>
                    <AnnouncementEmailPreview
                      title={preview.title}
                      content={preview.content}
                      contentFormat={preview.contentFormat}
                      priority={preview.priority}
                    />
                  </div>
                </div>
              <Alert className="mt-4" variant="info">
                <AlertTitle>{t("admin.broadcast.noticeTitle")}</AlertTitle>
                <AlertDescription>
                  {preview.contentFormat === ANNOUNCEMENT_CONTENT_FORMAT_HTML
                    ? t("admin.broadcast.noticeHtmlDesc")
                    : t("admin.broadcast.noticeDesc")}
                </AlertDescription>
              </Alert>
              </CardContent>
            </Card>
          )}

          {result && (
            <Card className="mb-6">
              <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-lg">
                  {t("admin.broadcast.result.title")}
                </CardTitle>
                <Badge variant="outline">
                  {t(`messages.priority.${result.priority}`)}
                </Badge>
              </div>
              </CardHeader>
              <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-4">
                <ResultStat
                  label={t("admin.broadcast.result.sent")}
                  value={result.sent}
                  tone="success"
                />
                <ResultStat
                  label={t("admin.broadcast.result.targets")}
                  value={result.total}
                />
                <ResultStat
                  label={t("admin.broadcast.result.failed")}
                  value={failedCount || t("admin.broadcast.result.none")}
                  tone={failedCount ? "danger" : "default"}
                />
                <ResultStat
                  label={t("admin.broadcast.result.invalid")}
                  value={invalidCount || t("admin.broadcast.result.none")}
                  tone={invalidCount ? "warning" : "default"}
                />
              </div>

              {failedCount > 0 && (
                <Alert variant="destructive">
                  <AlertTitle>{t("admin.broadcast.result.failed")}</AlertTitle>
                  <AlertDescription>
                    <p>{t("admin.broadcast.result.failedHint")}</p>
                    <span className="mt-2 block font-mono text-xs">
                      {result.failed.join(", ")}
                    </span>
                  </AlertDescription>
                </Alert>
              )}

              {invalidCount > 0 && (
                <Alert variant="warning">
                  <AlertTitle>{t("admin.broadcast.result.invalid")}</AlertTitle>
                  <AlertDescription>
                    <p>{t("admin.broadcast.result.invalidHint")}</p>
                    <span className="mt-2 block font-mono text-xs">
                      {result.invalid.join(", ")}
                    </span>
                  </AlertDescription>
                </Alert>
              )}

              {emailResult && (
                <Alert variant={emailResultVariant}>
                  <AlertTitle>
                    {t(`admin.broadcast.email.status.${emailResult.status}`)}
                  </AlertTitle>
                  <AlertDescription>
                    <p>
                      {emailResult.status === "queued"
                        ? t("admin.broadcast.email.queuedSummary", {
                            count: emailResult.attempted,
                          })
                        : t("admin.broadcast.email.summary", {
                            attempted: emailResult.attempted,
                            success: emailResult.successfulChunks,
                            failed: emailResult.failedChunks,
                          })}
                    </p>
                    {emailResult.missing.length > 0 && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        {t("admin.broadcast.email.missing", {
                          count: emailResult.missing.length,
                        })}
                        <span className="ml-1 font-mono">
                          {emailResult.missing.join(", ")}
                        </span>
                      </p>
                    )}
                    {emailResult.errors.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs font-medium text-muted-foreground">
                          {t("admin.broadcast.email.errorsTitle")}
                        </p>
                        <ul className="mt-1 space-y-1 text-xs font-mono">
                          {emailResult.errors.map((error, index) => (
                            <li key={`${error}-${index}`}>{error}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
              )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
        <TabsContent value="history" className="mt-0 space-y-6">
          <div className="bg-white rounded-lg shadow-sm border p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-lg font-semibold">
                  {t("admin.broadcast.pageTabs.history")}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {t("admin.broadcast.history.description")}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => resetFilters()}
                  disabled={isHistoryLoading || isHistoryFetching}
                >
                  {t("common.reset")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetchHistory()}
                  disabled={isHistoryLoading}
                >
                  {t("common.refresh")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleFlushBroadcasts}
                  disabled={flushBroadcastMutation.isLoading}
                >
                  {flushBroadcastMutation.isLoading
                    ? t("admin.broadcast.history.flushLoading")
                    : t("admin.broadcast.history.flushButton")}
                </Button>
                <Button
                  size="sm"
                  onClick={handleExport}
                  disabled={exportDisabled || isHistoryLoading}
                >
                  {t("admin.broadcast.export.label")}
                </Button>
              </div>
            </div>

            {historyError && (
              <Alert variant="destructive">
                <AlertTitle>{t("admin.broadcast.sendFailed")}</AlertTitle>
                <AlertDescription>
                  {historyError.message ??
                    t("admin.broadcast.history.loadFailed")}
                </AlertDescription>
              </Alert>
            )}

            <div className="grid gap-4 md:grid-cols-5">
              <ResultStat
                label={t("admin.broadcast.summary.broadcasts")}
                value={summary.broadcasts}
              />
              <ResultStat
                label={t("admin.broadcast.summary.targets")}
                value={summary.targets}
              />
              <ResultStat
                label={t("admin.broadcast.summary.delivered")}
                value={summary.sent}
                tone="success"
              />
              <ResultStat
                label={t("admin.broadcast.summary.read")}
                value={summary.read}
              />
              <ResultStat
                label={t("admin.broadcast.summary.unread")}
                value={summary.unread}
                tone={summary.unread ? "warning" : "default"}
              />
            </div>

            {isMessageStatsError && (
              <Alert variant="destructive">
                <AlertTitle>
                  {t("admin.broadcast.analytics.loadFailedTitle")}
                </AlertTitle>
                <AlertDescription>
                  {messageStatsError?.message ?? t("common.retry")}
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-4">
              <div className="rounded-lg border bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {t("admin.broadcast.analytics.trendTitle")}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {t("admin.broadcast.analytics.trendSubtitle")}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => refetchMessageStats()}
                    disabled={isMessageStatsFetching}
                  >
                    {isMessageStatsFetching
                      ? t("admin.broadcast.analytics.refreshing")
                      : t("common.refresh")}
                  </Button>
                </div>
                <div className="mt-4 h-72">
                  {messageStatsInitialLoading ? (
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                      {t("common.loading")}
                    </div>
                  ) : messageTrendHasData ? (
                    <ResponsiveContainer>
                      <LineChart data={messageTrendData}>
                        <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" />
                        <XAxis
                          dataKey="date"
                          tickFormatter={(value) => {
                            if (!value) return value;
                            const date = new Date(`${value}T00:00:00`);
                            return Number.isNaN(date.getTime())
                              ? value
                              : shortDateFormatter.format(date);
                          }}
                          stroke="#475569"
                          fontSize={12}
                        />
                        <YAxis
                          allowDecimals={false}
                          stroke="#475569"
                          fontSize={12}
                        />
                        <RechartsTooltip
                          formatter={(value) => numberFormatter.format(value)}
                          labelFormatter={(label) => {
                            if (!label) return label;
                            const date = new Date(`${label}T00:00:00`);
                            return Number.isNaN(date.getTime())
                              ? label
                              : shortDateFormatter.format(date);
                          }}
                        />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="total"
                          stroke="#2563eb"
                          strokeWidth={2}
                          dot={false}
                          name={t("admin.broadcast.analytics.totalSeries")}
                        />
                        <Line
                          type="monotone"
                          dataKey="unread"
                          stroke="#f97316"
                          strokeWidth={2}
                          dot={false}
                          name={t("admin.broadcast.analytics.unreadSeries")}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                      {t("admin.broadcast.analytics.trendEmpty")}
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-lg border bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {t("admin.broadcast.analytics.priorityTitle")}
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    {t("admin.broadcast.analytics.prioritySubtitle")}
                  </span>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <ResultStat
                    label={t("admin.broadcast.analytics.totalMessages")}
                    value={numberFormatter.format(messageOverview.total)}
                  />
                  <ResultStat
                    label={t("admin.broadcast.analytics.readMessages")}
                    value={numberFormatter.format(messageOverview.read)}
                    tone="success"
                  />
                  <ResultStat
                    label={t("admin.broadcast.analytics.unreadMessages")}
                    value={numberFormatter.format(messageOverview.unread)}
                    tone={messageOverview.unread ? "warning" : "default"}
                  />
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  {t("admin.broadcast.analytics.unreadRatio")}{" "}
                  <span className="font-semibold text-orange-500">
                    {percentFormatter.format(messageOverview.unreadRatio || 0)}
                  </span>
                </p>
                <div className="mt-4 h-64">
                  {messageStatsInitialLoading ? (
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                      {t("common.loading")}
                    </div>
                  ) : messagePriorityHasData ? (
                    <ResponsiveContainer>
                      <BarChart
                        data={messagePriorityChartData}
                        layout="vertical"
                      >
                        <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" />
                        <XAxis
                          type="number"
                          allowDecimals={false}
                          stroke="#475569"
                          fontSize={12}
                        />
                        <YAxis
                          type="category"
                          dataKey="name"
                          stroke="#475569"
                          fontSize={12}
                          width={90}
                        />
                        <RechartsTooltip
                          formatter={(value) => numberFormatter.format(value)}
                        />
                        <Legend />
                        <Bar
                          dataKey="total"
                          name={t("admin.broadcast.analytics.totalSeries")}
                          barSize={14}
                        >
                          {messagePriorityChartData.map((item) => (
                            <Cell
                              key={`priority-total-${item.priority}`}
                              fill={item.color}
                            />
                          ))}
                        </Bar>
                        <Bar
                          dataKey="unread"
                          name={t("admin.broadcast.analytics.unreadSeries")}
                          barSize={14}
                          fill="#f97316"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                      {t("admin.broadcast.analytics.priorityEmpty")}
                    </div>
                  )}
                </div>
                <div className="mt-4 space-y-2 text-xs text-muted-foreground">
                  {messagePriorityChartData.map((entry) => (
                    <div
                      key={entry.priority}
                      className="flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: entry.color }}
                        />
                        <span className="font-medium text-gray-700">
                          {entry.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span>{numberFormatter.format(entry.total)}</span>
                        <span className="text-sky-600">
                          {t("admin.broadcast.analytics.unreadLabelShort")}{" "}
                          {numberFormatter.format(entry.unread)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t("admin.broadcast.filters.search")}
                </label>
                <Input
                  value={filters.search}
                  onChange={(event) =>
                    updateFilters({ search: event.target.value })
                  }
                  placeholder={t("admin.broadcast.filters.searchPlaceholder")}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t("admin.broadcast.filters.priority")}
                </label>
                <select
                  value={filters.priority}
                  onChange={(event) =>
                    updateFilters({ priority: event.target.value })
                  }
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="any">{t("common.all")}</option>
                  {PRIORITIES.map((value) => (
                    <option key={value} value={value}>
                      {t(`messages.priority.${value}`)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t("admin.broadcast.filters.scope")}
                </label>
                <select
                  value={filters.scope}
                  onChange={(event) =>
                    updateFilters({ scope: event.target.value })
                  }
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="any">{t("common.all")}</option>
                  <option value="all">{t("admin.broadcast.scope.all")}</option>
                  <option value="custom">
                    {t("admin.broadcast.scope.custom")}
                  </option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Switch
                id="broadcast-unread-toggle"
                checked={filters.unreadOnly}
                onCheckedChange={(checked) =>
                  updateFilters({ unreadOnly: Boolean(checked) })
                }
              />
              <label
                htmlFor="broadcast-unread-toggle"
                className="text-sm text-muted-foreground"
              >
                {t("admin.broadcast.filters.onlyUnread")}
              </label>
            </div>

            {isHistoryLoading ? (
              <p className="text-sm text-muted-foreground">
                {t("common.loading")}
              </p>
            ) : filteredItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("admin.broadcast.history.empty")}
              </p>
            ) : (
              <div className="space-y-4">
                {filteredItems.map((item) => {
                  const isExpanded = !!expanded[item.id];
                  const read = truncateUsers(item.read_users ?? []);
                  const unread = truncateUsers(item.unread_users ?? []);
                  const invalidIds = item.invalid_user_ids ?? [];
                  const failedIds = item.failed_user_ids ?? [];
                  const actorLabel =
                    item.actor_username ||
                    (item.actor_user_id
                      ? `#${item.actor_user_id}`
                      : t("common.unknown"));
                  const delivery = item.email_delivery ?? {};
                  const emailStatus = delivery?.status ?? "skipped";
                  const emailErrors = Array.isArray(delivery?.errors)
                    ? delivery.errors
                    : [];
                  const emailBadgeVariant =
                    {
                      sent: "secondary",
                      partial: "high",
                      failed: "destructive",
                      queued: "secondary",
                      skipped: "outline",
                    }[emailStatus] ?? "outline";

                  return (
                    <div
                      key={item.id}
                      className="rounded-lg border p-5 space-y-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                          <h4 className="text-lg font-semibold">
                            {item.title}
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            {formatDateTime(item.created_at)}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {t("admin.broadcast.sentBy", {
                              actor: actorLabel,
                              id: item.actor_user_id ?? t("common.unknown"),
                            })}
                          </p>
                          <AnnouncementContent
                            content={item.content}
                            contentFormat={normalizeAnnouncementContentFormat(
                              item.content_format,
                            )}
                            className="rounded-md bg-slate-50 p-4"
                          />
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline">
                            {t(`messages.priority.${item.priority}`)}
                          </Badge>
                          <Badge variant="secondary">
                            {t(
                              `admin.broadcast.scope.${item.scope === "custom" ? "custom" : "all"}`,
                            )}
                          </Badge>
                          <Badge variant="outline">
                            {normalizeAnnouncementContentFormat(
                              item.content_format,
                            ) === ANNOUNCEMENT_CONTENT_FORMAT_HTML
                              ? t("admin.broadcast.format.html")
                              : t("admin.broadcast.format.text")}
                          </Badge>
                          <Badge variant={emailBadgeVariant}>
                            {t(`admin.broadcast.email.status.${emailStatus}`)}
                          </Badge>
                        </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-4">
                        <ResultStat
                          label={t("admin.broadcast.result.sent")}
                          value={item.sent_count}
                          tone="success"
                        />
                        <ResultStat
                          label={t("admin.broadcast.result.targets")}
                          value={item.target_count}
                        />
                        <ResultStat
                          label={t("admin.broadcast.result.failed")}
                          value={
                            failedIds.length || t("admin.broadcast.result.none")
                          }
                          tone={
                            (failedIds.length ?? 0) > 0 ? "danger" : "default"
                          }
                        />
                        <ResultStat
                          label={t("admin.broadcast.result.invalid")}
                          value={
                            invalidIds.length ||
                            t("admin.broadcast.result.none")
                          }
                          tone={
                            (invalidIds.length ?? 0) > 0 ? "warning" : "default"
                          }
                        />
                      </div>

                      {failedIds.length > 0 && (
                        <Alert variant="destructive">
                          <AlertTitle>
                            {t("admin.broadcast.result.failed")}
                          </AlertTitle>
                          <AlertDescription>
                            <span className="font-mono text-xs">
                              {failedIds.join(", ")}
                            </span>
                          </AlertDescription>
                        </Alert>
                      )}

                      {invalidIds.length > 0 && (
                        <Alert variant="warning">
                          <AlertTitle>
                            {t("admin.broadcast.result.invalid")}
                          </AlertTitle>
                          <AlertDescription>
                            <span className="font-mono text-xs">
                              {invalidIds.join(", ")}
                            </span>
                          </AlertDescription>
                        </Alert>
                      )}

                      {delivery &&
                        (emailStatus !== "sent" ||
                          emailErrors.length > 0 ||
                          (delivery.missing_email_user_ids ?? []).length >
                            0) && (
                          <Alert
                            variant={
                              emailStatus === "failed"
                                ? "destructive"
                                : emailStatus === "partial"
                                  ? "warning"
                                  : "info"
                            }
                          >
                            <AlertTitle>
                              {t(`admin.broadcast.email.status.${emailStatus}`)}
                            </AlertTitle>
                            <AlertDescription>
                              <p>
                                {emailStatus === "queued"
                                  ? t("admin.broadcast.email.queuedSummary", {
                                      count: delivery.attempted_recipients ?? 0,
                                    })
                                  : t("admin.broadcast.email.summary", {
                                      attempted:
                                        delivery.attempted_recipients ?? 0,
                                      success: delivery.successful_chunks ?? 0,
                                      failed: delivery.failed_chunks ?? 0,
                                    })}
                              </p>
                              {Array.isArray(delivery.missing_email_user_ids) &&
                                delivery.missing_email_user_ids.length > 0 && (
                                  <p className="mt-2 text-xs text-muted-foreground">
                                    {t("admin.broadcast.email.missing", {
                                      count:
                                        delivery.missing_email_user_ids.length,
                                    })}
                                    <span className="ml-1 font-mono">
                                      {delivery.missing_email_user_ids.join(
                                        ", ",
                                      )}
                                    </span>
                                  </p>
                                )}
                              {emailErrors.length > 0 && (
                                <div className="mt-2">
                                  <p className="text-xs font-medium text-muted-foreground">
                                    {t("admin.broadcast.email.errorsTitle")}
                                  </p>
                                  <ul className="mt-1 space-y-1 text-xs font-mono">
                                    {emailErrors.map((error, index) => (
                                      <li key={`${error}-${index}`}>{error}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </AlertDescription>
                          </Alert>
                        )}

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleDetails(item.id)}
                      >
                        {isExpanded
                          ? t("admin.broadcast.history.hideDetails")
                          : t("admin.broadcast.history.showDetails")}
                      </Button>

                      {isExpanded && (
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <h5 className="text-sm font-medium text-green-700">
                              {t("admin.broadcast.result.sent")} (
                              {item.read_count ?? read.list.length})
                            </h5>
                            <UserChips
                              users={read.list}
                              onViewUser={handleViewUserProfile}
                              t={t}
                            />
                            {read.more > 0 && (
                              <p className="text-xs text-muted-foreground">
                                {t("admin.broadcast.history.more", {
                                  count: read.more,
                                })}
                              </p>
                            )}
                          </div>
                          <div className="space-y-2">
                            <h5 className="text-sm font-medium text-yellow-700">
                              {t("admin.broadcast.result.unread")} (
                              {item.unread_count ?? unread.list.length})
                            </h5>
                            <UserChips
                              users={unread.list}
                              onViewUser={handleViewUserProfile}
                              t={t}
                            />
                            {unread.more > 0 && (
                              <p className="text-xs text-muted-foreground">
                                {t("admin.broadcast.history.more", {
                                  count: unread.more,
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

            <Pagination
              currentPage={pagination.page ?? historyParams.page}
              totalPages={pagination.pages ?? 1}
              onPageChange={handlePageChange}
              itemsPerPage={pagination.limit ?? historyParams.limit}
              totalItems={pagination.total ?? filteredItems.length}
              className="pt-2"
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default BroadcastCenter;
