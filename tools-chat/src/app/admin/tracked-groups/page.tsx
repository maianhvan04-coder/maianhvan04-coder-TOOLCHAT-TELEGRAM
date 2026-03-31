"use client";

import {
  type CSSProperties,
  type FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  CalendarDays,
  CheckCheck,
  ChevronRight,
  Download,
  EllipsisVertical,
  Hash,
  Link2,
  Loader2,
  LogOut,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { Toaster, toast } from "sonner";
import {
  trackedGroupApi,
  type TrackedGroupItem,
} from "@/app/api/tracked-group.api";
import {
  messageQueryApi,
  type TelegramMessageItem,
} from "@/app/api/message-query.api";
import {
  messageSummaryApi,
  type MessageSummaryData,
} from "@/app/api/message-summary.api";
import { telegramAuthApi } from "@/app/api/telegram-auth.api";

type CreateMode = "CHAT_ID" | "INVITE_LINK";

const TELEGRAM_LOGIN_PATH = "/admin/telegram-auth";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function getVietnamDayKey(date = new Date()) {
  const vnDate = new Date(
    date.toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" })
  );

  const year = vnDate.getFullYear();
  const month = String(vnDate.getMonth() + 1).padStart(2, "0");
  const day = String(vnDate.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDayKey(dayKey?: string | null) {
  if (!dayKey) return "--";

  const date = new Date(`${dayKey}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "--";

  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatSidebarStamp(dayKey?: string | null) {
  if (!dayKey) return "";
  const today = getVietnamDayKey();
  if (dayKey === today) return "Hôm nay";
  return formatDayKey(dayKey);
}

function formatMessageTime(unix?: number) {
  if (!unix) return "--";
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(unix * 1000));
}

function getMessageText(item: TelegramMessageItem) {
  return item.text?.trim() || "--";
}

function getGroupDisplayName(item: TrackedGroupItem) {
  return item.title?.trim() || item.username?.trim() || item.chatId;
}

function shortenMiddle(value: string, max = 34) {
  if (value.length <= max) return value;
  const head = Math.ceil((max - 3) / 2);
  const tail = Math.floor((max - 3) / 2);
  return `${value.slice(0, head)}...${value.slice(value.length - tail)}`;
}

function getGroupPreview(item: TrackedGroupItem) {
  if (item.username?.trim()) return `@${item.username.trim()}`;
  if (item.inviteLink?.trim()) return shortenMiddle(item.inviteLink.trim(), 38);
  return shortenMiddle(item.chatId, 38);
}

function getGroupSubtitle(item: TrackedGroupItem) {
  const preview = getGroupPreview(item);
  const status = item.isActive ? "Đang theo dõi" : "Tạm dừng";
  return `${preview} • ${status}`;
}

function getInitials(value: string) {
  const cleaned = value.trim();
  if (!cleaned) return "TG";

  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();

  return `${words[0]?.[0] ?? ""}${words[1]?.[0] ?? ""}`.toUpperCase();
}

function isValidChatId(value: string) {
  return /^-?\d+$/.test(value.trim());
}

function isValidPublicUsername(value: string) {
  return /^@?[a-zA-Z0-9_]{5,}$/.test(value.trim());
}

function normalizePublicUsername(value: string) {
  return value.trim().replace(/^@/, "");
}

function isTelegramInviteLink(value: string) {
  const v = value.trim();

  return (
    /^https?:\/\/t\.me\/\+/i.test(v) ||
    /^https?:\/\/telegram\.me\/\+/i.test(v) ||
    /joinchat\//i.test(v)
  );
}

function hashString(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function hasMeaningfulList(value?: string[]) {
  return Array.isArray(value) && value.some((item) => item.trim().length > 0);
}

function formatGeneratedBy(value?: string) {
  if (!value) return "AI";
  if (value === "OLLAMA") return "Ollama";
  if (value === "FALLBACK") return "Fallback";
  return value;
}

const avatarThemes = [
  "bg-sky-100 text-sky-700 ring-sky-200",
  "bg-emerald-100 text-emerald-700 ring-emerald-200",
  "bg-violet-100 text-violet-700 ring-violet-200",
  "bg-amber-100 text-amber-700 ring-amber-200",
  "bg-rose-100 text-rose-700 ring-rose-200",
  "bg-cyan-100 text-cyan-700 ring-cyan-200",
];

function getAvatarTheme(seed: string) {
  return avatarThemes[hashString(seed) % avatarThemes.length];
}

const wallpaperStyle: CSSProperties = {
  backgroundColor: "#e8efe2",
  backgroundImage: `
    radial-gradient(circle at 24px 24px, rgba(255,255,255,0.28) 2px, transparent 2.5px),
    linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0))
  `,
  backgroundSize: "110px 110px, 100% 100%",
};

function ChatBubble({ item }: { item: TelegramMessageItem }) {
  const avatarSeed = item.senderId || item.senderName || String(item.messageId);
  const avatarTheme = getAvatarTheme(avatarSeed);

  return (
    <div className="mb-4 flex items-start gap-3">
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ring-1",
          avatarTheme
        )}
      >
        {getInitials(item.senderName || "TG")}
      </div>

      <div className="max-w-[min(760px,85%)]">
        <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1 px-1">
          <span className="text-sm font-semibold text-slate-800">
            {item.senderName || "Unknown"}
          </span>
          <span className="text-xs text-slate-500">{item.senderId || "--"}</span>
        </div>

        <div className="rounded-[22px] bg-white px-4 py-3 shadow-[0_6px_18px_rgba(15,23,42,0.06)] ring-1 ring-black/5">
          <div className="whitespace-pre-wrap wrap-break-word text-[15px] leading-6 text-slate-800">
            {getMessageText(item)}
          </div>

          <div className="mt-2 flex items-center justify-end gap-2 text-[11px] text-slate-400">
            {item.hasMedia ? (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-500">
                {item.mediaType || "MEDIA"}
              </span>
            ) : null}
            <span>{formatMessageTime(item.date)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryListBlock({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  if (!hasMeaningfulList(items)) return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="mb-3 text-sm font-semibold text-slate-900">{title}</div>
      <div className="space-y-2">
        {items
          .filter((item) => item.trim().length > 0)
          .map((item, index) => (
            <div
              key={`${title}-${index}`}
              className="rounded-xl bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-700"
            >
              {item}
            </div>
          ))}
      </div>
    </div>
  );
}

function SummaryDrawer({
  open,
  loading,
  data,
  error,
  onClose,
  onSummarize,
}: {
  open: boolean;
  loading: boolean;
  data: MessageSummaryData | null;
  error: string;
  onClose: () => void;
  onSummarize: () => Promise<void>;
}) {
  return (
    <>
      <div
        className={cn(
          "absolute inset-0 z-20 bg-slate-950/18 transition",
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={onClose}
      />

      <aside
        className={cn(
          "absolute bottom-0 right-0 top-0 z-30 w-full max-w-107.5 border-l border-slate-200 bg-[#f8fafc] shadow-[-16px_0_50px_rgba(15,23,42,0.12)] transition-transform duration-300",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="flex h-full flex-col">
          <div className="border-b border-slate-200 bg-white px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700">
                  <Sparkles className="h-3.5 w-3.5" />
                  AI Summary
                </div>
                <h3 className="mt-3 text-lg font-bold text-slate-900">
                  Tóm tắt theo ngày
                </h3>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  Bản tóm tắt gọn từ tin nhắn của ngày đang chọn.
                </p>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4">
              <button
                type="button"
                onClick={() => void onSummarize()}
                disabled={loading}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-violet-600 px-4 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Đang tóm tắt...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Tóm tắt lại
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            {error ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            ) : null}

            {!data && !loading ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-8 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-violet-50 text-violet-600">
                  <Sparkles className="h-6 w-6" />
                </div>
                <div className="mt-4 text-base font-semibold text-slate-900">
                  Chưa có bản tóm tắt
                </div>
                <div className="mt-2 text-sm leading-6 text-slate-500">
                  Bấm nút tóm tắt để AI phân tích nội dung chat.
                </div>
              </div>
            ) : null}

            {loading ? (
              <div className="rounded-2xl bg-white px-4 py-6 text-sm text-slate-600">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  AI đang xử lý dữ liệu...
                </div>
              </div>
            ) : null}

            {data ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
                    {formatDayKey(data.dayKey)}
                  </span>
                  <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">
                    {data.rawMessageCount} tin nhắn
                  </span>
                  <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700">
                    {formatGeneratedBy(data.generatedBy)}
                  </span>
                </div>

                <div className="rounded-2xl border border-violet-100 bg-violet-50/70 p-4">
                  <div className="mb-2 text-sm font-semibold text-violet-700">
                    Tổng quan
                  </div>
                  <div className="whitespace-pre-wrap text-sm leading-7 text-slate-700">
                    {data.overview?.trim() || "Chưa có overview."}
                  </div>
                </div>

                <SummaryListBlock title="Điểm nổi bật" items={data.highlights} />
                <SummaryListBlock title="Quyết định" items={data.decisions} />
                <SummaryListBlock title="Việc cần làm" items={data.actionItems} />
                <SummaryListBlock title="Rủi ro" items={data.risks} />

                {Array.isArray(data.participants) && data.participants.length > 0 ? (
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <UserRound className="h-4 w-4" />
                      Người tham gia nổi bật
                    </div>

                    <div className="space-y-2">
                      {data.participants.map((participant, index) => (
                        <div
                          key={`${participant.name}-${index}`}
                          className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2"
                        >
                          <div className="truncate text-sm font-medium text-slate-800">
                            {participant.name || "Unknown"}
                          </div>
                          <div className="ml-3 text-xs font-semibold text-slate-500">
                            {participant.count} tin nhắn
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </aside>
    </>
  );
}

export default function AdminTrackedGroupsPage() {
  const [items, setItems] = useState<TrackedGroupItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);

  const [telegramMeLoading, setTelegramMeLoading] = useState(false);
  const [telegramMe, setTelegramMe] = useState<{
    fullName: string | null;
    username: string | null;
    phoneNumber: string | null;
  } | null>(null);

  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  const [openCreate, setOpenCreate] = useState(false);
  const [createMode, setCreateMode] = useState<CreateMode>("CHAT_ID");
  const [groupValue, setGroupValue] = useState("");

  const [keyword, setKeyword] = useState("");

  const [busyToggleId, setBusyToggleId] = useState<string | null>(null);
  const [busyDeleteId, setBusyDeleteId] = useState<string | null>(null);
  const [busyCrawlId, setBusyCrawlId] = useState<string | null>(null);

  const [messageDayKey, setMessageDayKey] = useState(getVietnamDayKey());
  const [messageKeyword, setMessageKeyword] = useState("");
  const [messageSenderId, setMessageSenderId] = useState("");
  const [messageLoading, setMessageLoading] = useState(false);
  const [messageItems, setMessageItems] = useState<TelegramMessageItem[]>([]);
  const [messageTotal, setMessageTotal] = useState(0);

  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryData, setSummaryData] = useState<MessageSummaryData | null>(null);
  const [summaryError, setSummaryError] = useState("");

  const [openHeaderMenu, setOpenHeaderMenu] = useState(false);
  const [openSidebarQuickMenu, setOpenSidebarQuickMenu] = useState(false);

  const headerMenuRef = useRef<HTMLDivElement | null>(null);
  const sidebarQuickMenuRef = useRef<HTMLDivElement | null>(null);

  const selectedGroup = useMemo(
    () => items.find((item) => item._id === selectedGroupId) ?? null,
    [items, selectedGroupId]
  );

  const filteredItems = useMemo(() => {
    const q = keyword.trim().toLowerCase();

    if (!q) return items;

    return items.filter((item) => {
      return (
        (item.title ?? "").toLowerCase().includes(q) ||
        (item.username ?? "").toLowerCase().includes(q) ||
        (item.inviteLink ?? "").toLowerCase().includes(q) ||
        item.chatId.toLowerCase().includes(q)
      );
    });
  }, [items, keyword]);

  const exportUrl = useMemo(() => {
    if (!selectedGroup?.chatId || !messageDayKey.trim()) return "";

    return messageQueryApi.getExportCsvUrl({
      chatId: selectedGroup.chatId,
      dayKey: messageDayKey.trim(),
      keyword: messageKeyword.trim() || undefined,
      senderId: messageSenderId.trim() || undefined,
    });
  }, [selectedGroup, messageDayKey, messageKeyword, messageSenderId]);

  async function loadData(showRefreshState = false) {
    try {
      if (showRefreshState) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const data = await trackedGroupApi.list();
      setItems(data);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Không tải được danh sách group";
      toast.error(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function loadMessagesForGroup(
    group: TrackedGroupItem,
    params?: {
      dayKey?: string;
      keyword?: string;
      senderId?: string;
      showSuccess?: boolean;
    }
  ) {
    const finalDayKey = (params?.dayKey ?? messageDayKey).trim();
    const finalKeyword = (params?.keyword ?? messageKeyword).trim();
    const finalSenderId = (params?.senderId ?? messageSenderId).trim();
    const showSuccess = params?.showSuccess ?? false;

    if (!group.chatId) {
      toast.error("Group chưa có chatId");
      return;
    }

    if (!finalDayKey) {
      toast.error("Nhập ngày trước");
      return;
    }

    try {
      setMessageLoading(true);

      const res = await messageQueryApi.listByDay({
        chatId: group.chatId,
        dayKey: finalDayKey,
        keyword: finalKeyword || undefined,
        senderId: finalSenderId || undefined,
      });

      setMessageItems(res.items ?? []);
      setMessageTotal(res.total ?? 0);

      if (showSuccess) {
        toast.success(`Đã tải ${res.total ?? 0} tin nhắn`);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Không tải được tin nhắn";
      toast.error(message);
    } finally {
      setMessageLoading(false);
    }
  }

  async function handleSummarizeDay() {
    if (!selectedGroup) {
      toast.error("Chưa chọn group");
      return;
    }

    if (!messageDayKey.trim()) {
      toast.error("Chưa chọn ngày");
      return;
    }

    try {
      setSummaryLoading(true);
      setSummaryError("");
      setSummaryOpen(true);

      const res = await messageSummaryApi.summarizeDay({
        chatId: selectedGroup.chatId,
        dayKey: messageDayKey.trim(),
        title: getGroupDisplayName(selectedGroup),
        keyword: messageKeyword.trim() || undefined,
        senderId: messageSenderId.trim() || undefined,
      });

      setSummaryData(res.data);
      toast.success("AI đã tóm tắt xong");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Không tóm tắt được dữ liệu";
      setSummaryData(null);
      setSummaryError(message);
      toast.error(message);
    } finally {
      setSummaryLoading(false);
    }
  }

  async function handleLogoutTelegram() {
    const ok = window.confirm("Bạn có chắc muốn đăng xuất tài khoản Telegram?");
    if (!ok) return;

    try {
      setLogoutLoading(true);

      const res = await telegramAuthApi.logout();

      toast.success(res.message || "Đã đăng xuất Telegram");

      setMessageItems([]);
      setMessageTotal(0);
      setSummaryData(null);
      setSummaryError("");
      setSummaryOpen(false);
      setOpenSidebarQuickMenu(false);

      window.location.href = TELEGRAM_LOGIN_PATH;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Không đăng xuất được Telegram";
      toast.error(message);
    } finally {
      setLogoutLoading(false);
    }
  }

  async function loadTelegramMe() {
    try {
      setTelegramMeLoading(true);

      const res = await telegramAuthApi.getMe();

      setTelegramMe({
        fullName: res.profile?.fullName ?? null,
        username: res.profile?.username ?? null,
        phoneNumber: res.profile?.phoneNumber ?? null,
      });
    } catch {
      setTelegramMe(null);
    } finally {
      setTelegramMeLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
    void loadTelegramMe();
  }, []);

  useEffect(() => {
    if (items.length === 0) {
      setSelectedGroupId(null);
      setMessageItems([]);
      setMessageTotal(0);
      setSummaryData(null);
      setSummaryError("");
      setSummaryOpen(false);
      return;
    }

    const stillExists = items.some((item) => item._id === selectedGroupId);

    if (!selectedGroupId || !stillExists) {
      const first = items[0];
      if (first) setSelectedGroupId(first._id);
    }
  }, [items, selectedGroupId]);

  useEffect(() => {
    if (!selectedGroup) return;
    void loadMessagesForGroup(selectedGroup, { showSuccess: false });
  }, [selectedGroupId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setOpenHeaderMenu(false);
  }, [selectedGroupId]);

  useEffect(() => {
    setSummaryData(null);
    setSummaryError("");
    setSummaryOpen(false);
  }, [selectedGroupId, messageDayKey, messageKeyword, messageSenderId]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;

      if (headerMenuRef.current && !headerMenuRef.current.contains(target)) {
        setOpenHeaderMenu(false);
      }

      if (
        sidebarQuickMenuRef.current &&
        !sidebarQuickMenuRef.current.contains(target)
      ) {
        setOpenSidebarQuickMenu(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenHeaderMenu(false);
        setOpenSidebarQuickMenu(false);
        setSummaryOpen(false);
      }
    }

    if (openHeaderMenu || openSidebarQuickMenu || summaryOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [openHeaderMenu, openSidebarQuickMenu, summaryOpen]);

  async function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const value = groupValue.trim();

    if (!value) {
      toast.error(
        createMode === "CHAT_ID"
          ? "Nhập chatId hoặc @username trước"
          : "Nhập private invite link trước"
      );
      return;
    }

    try {
      setSubmitting(true);

      let created: TrackedGroupItem;

      if (createMode === "CHAT_ID") {
        if (isValidChatId(value)) {
          created = await trackedGroupApi.create({
            mode: "EXISTING_CHAT",
            chatId: value,
          });
        } else if (isValidPublicUsername(value)) {
          created = await trackedGroupApi.create({
            mode: "PUBLIC_USERNAME",
            username: normalizePublicUsername(value),
          });
        } else {
          toast.error("Nhập chatId dạng số hoặc @username hợp lệ");
          return;
        }
      } else {
        if (!isTelegramInviteLink(value)) {
          toast.error("Invite link phải dạng https://t.me/+xxxxx");
          return;
        }

        created = await trackedGroupApi.create({
          mode: "PRIVATE_INVITE",
          inviteLink: value,
        });
      }

      setItems((prev) => [created, ...prev]);
      setSelectedGroupId(created._id);
      setGroupValue("");
      setOpenCreate(false);
      toast.success("Thêm group theo dõi thành công");
    } catch (error) {
      const rawMessage =
        error instanceof Error ? error.message : "Không thêm được group";
      const lower = rawMessage.toLowerCase();

      if (
        lower.includes("chat not found") ||
        lower.includes("không tìm thấy chat")
      ) {
        toast.error(
          "Không tìm thấy chat theo chatId. Hãy thử @username nếu là group public, hoặc private invite link nếu là group kín."
        );
        return;
      }

      if (
        lower.includes("invite link") ||
        lower.includes("invite") ||
        lower.includes("expired") ||
        lower.includes("invalid")
      ) {
        toast.error("Invite link không hợp lệ hoặc đã hết hạn.");
        return;
      }

      toast.error(rawMessage);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggle(item: TrackedGroupItem) {
    try {
      setBusyToggleId(item._id);
      const updated = await trackedGroupApi.toggle(item._id, !item.isActive);

      setItems((prev) =>
        prev.map((group) => (group._id === item._id ? updated : group))
      );

      toast.success(
        updated.isActive ? "Đã bật theo dõi group" : "Đã tắt theo dõi group"
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Không cập nhật được trạng thái";
      toast.error(message);
    } finally {
      setBusyToggleId(null);
    }
  }

  async function handleDelete(item: TrackedGroupItem) {
    const ok = window.confirm(
      `Xóa group "${getGroupDisplayName(item)}" khỏi danh sách theo dõi?`
    );
    if (!ok) return;

    try {
      setBusyDeleteId(item._id);
      await trackedGroupApi.remove(item._id);

      setItems((prev) => prev.filter((group) => group._id !== item._id));
      toast.success("Đã xóa group khỏi danh sách theo dõi");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Không xóa được group";
      toast.error(message);
    } finally {
      setBusyDeleteId(null);
    }
  }

  async function handleCrawlNow(item: TrackedGroupItem) {
    try {
      setBusyCrawlId(item._id);

      const dayKey = getVietnamDayKey();
      const result = await trackedGroupApi.crawlNow(item.chatId, dayKey);

      if (!result.ok) {
        if (result.code === "CHAT_NOT_FOUND") {
          toast(
            "Không tìm thấy group này trong tài khoản Telegram hiện tại."
          );
          return;
        }

        toast(result.message || "Không thể crawl dữ liệu.");
        return;
      }

      setItems((prev) =>
        prev.map((group) =>
          group._id === item._id
            ? {
              ...group,
              lastCrawledDay: result.dayKey,
            }
            : group
        )
      );

      toast.success(`Đã crawl ${result.totalFetched} tin nhắn`);

      if (selectedGroupId === item._id) {
        setMessageDayKey(result.dayKey);
        await loadMessagesForGroup(item, {
          dayKey: result.dayKey,
          showSuccess: false,
        });
      }
    } catch (error) {
      const rawMessage =
        error instanceof Error ? error.message : "Không crawl được group";

      const lower = rawMessage.toLowerCase();

      if (lower.includes("chat not found")) {
        toast(
          "Không thể lấy dữ liệu từ group này. Tài khoản Telegram hiện tại có thể chưa tham gia group, hoặc chatId đang lưu không đúng."
        );
        return;
      }

      toast("Không thể crawl dữ liệu của group này. Vui lòng thử lại.");
    } finally {
      setBusyCrawlId(null);
    }
  }

  async function handleSubmitMessages(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!selectedGroup) {
      toast.error("Chưa chọn group");
      return;
    }

    await loadMessagesForGroup(selectedGroup, { showSuccess: true });
  }

  function handleExportCsv() {
    if (!exportUrl) return;
    window.open(exportUrl, "_blank", "noopener,noreferrer");
    setOpenHeaderMenu(false);
  }

  return (
    <div className="min-h-screen bg-[#dce5ec] p-2 md:p-3">
      <Toaster richColors position="top-right" />

      <div className="mx-auto flex h-[calc(100vh-16px)] max-w-450 overflow-hidden rounded-[26px] border border-white/70 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.14)] md:h-[calc(100vh-24px)]">
        <aside className="flex w-full max-w-97.5 flex-col border-r border-slate-200 bg-[#f5f7fa]">
          <div className="border-b border-slate-200 px-3 py-3">
            <div className="flex items-center gap-2">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="Search"
                  className="h-11 w-full rounded-full border border-transparent bg-[#e9eef3] pl-11 pr-4 text-sm text-slate-900 outline-none transition focus:border-sky-200 focus:bg-white"
                />
              </div>

              <button
                type="button"
                onClick={() => void loadData(true)}
                disabled={refreshing}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {refreshing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </button>

              <div ref={sidebarQuickMenuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setOpenSidebarQuickMenu((prev) => !prev)}
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
                >
                  <EllipsisVertical className="h-5 w-5" />
                </button>

                {openSidebarQuickMenu ? (
                  <div className="absolute right-0 top-[calc(100%+8px)] z-30 w-72 overflow-hidden rounded-2xl border border-slate-200 bg-white py-2 shadow-[0_18px_50px_rgba(15,23,42,0.16)]">
                    <div className="px-3 pb-2 pt-1">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                          Telegram account hiện tại
                        </div>

                        {telegramMeLoading ? (
                          <div className="mt-3 flex items-center gap-2 text-sm text-slate-500">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Đang tải tài khoản...
                          </div>
                        ) : telegramMe ? (
                          <div className="mt-3 space-y-1.5">
                            <div className="truncate text-sm font-semibold text-slate-900">
                              {telegramMe.fullName ?? "--"}
                            </div>

                            <div className="truncate text-sm text-slate-600">
                              {telegramMe.username ? `@${telegramMe.username}` : "--"}
                            </div>

                            <div className="truncate text-xs text-slate-500">
                              {telegramMe.phoneNumber ?? "--"}
                            </div>
                          </div>
                        ) : (
                          <div className="mt-3 text-sm text-slate-500">
                            Không lấy được thông tin tài khoản.
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="my-1 h-px bg-slate-200" />

                    <button
                      type="button"
                      onClick={() => {
                        setOpenSidebarQuickMenu(false);
                        setCreateMode("CHAT_ID");
                        setGroupValue("");
                        setOpenCreate(true);
                      }}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                    >
                      <Plus className="h-4 w-4" />
                      Thêm group
                    </button>

                    <button
                      type="button"
                      onClick={() => void handleLogoutTelegram()}
                      disabled={logoutLoading}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {logoutLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <LogOut className="h-4 w-4" />
                      )}
                      Đăng xuất Telegram
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex h-full items-center justify-center text-slate-500">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Đang tải group...
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="px-4 py-12 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white text-slate-400 shadow-sm">
                  <MessageSquare className="h-7 w-7" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-slate-900">
                  Không có group phù hợp
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Thử tìm với từ khóa khác hoặc bấm menu ba chấm để thêm group mới.
                </p>
              </div>
            ) : (
              <div className="py-1">
                {filteredItems.map((item) => {
                  const isSelected = selectedGroupId === item._id;
                  const avatarTheme = getAvatarTheme(item.chatId);

                  return (
                    <button
                      key={item._id}
                      type="button"
                      onClick={() => setSelectedGroupId(item._id)}
                      className={cn(
                        "flex w-full items-start gap-3 px-3 py-3 text-left transition",
                        isSelected ? "bg-sky-500" : "hover:bg-slate-200/60"
                      )}
                    >
                      <div
                        className={cn(
                          "flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-bold ring-1",
                          isSelected
                            ? "bg-white/20 text-white ring-white/20"
                            : avatarTheme
                        )}
                      >
                        {getInitials(getGroupDisplayName(item))}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div
                            className={cn(
                              "truncate text-[15px] font-semibold",
                              isSelected ? "text-white" : "text-slate-900"
                            )}
                          >
                            {getGroupDisplayName(item)}
                          </div>

                          <div
                            className={cn(
                              "shrink-0 text-xs",
                              isSelected ? "text-white/80" : "text-slate-400"
                            )}
                          >
                            {formatSidebarStamp(item.lastCrawledDay)}
                          </div>
                        </div>

                        <div
                          className={cn(
                            "mt-1 truncate text-sm",
                            isSelected ? "text-white/85" : "text-slate-500"
                          )}
                        >
                          {getGroupSubtitle(item)}
                        </div>

                        <div className="mt-2 flex items-center gap-2">
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                              isSelected
                                ? "bg-white/15 text-white"
                                : item.isActive
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-slate-200 text-slate-600"
                            )}
                          >
                            {item.type}
                          </span>

                          <span
                            className={cn(
                              "h-2.5 w-2.5 rounded-full",
                              item.isActive
                                ? "bg-emerald-500"
                                : isSelected
                                  ? "bg-white/60"
                                  : "bg-slate-300"
                            )}
                          />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col bg-white">
          {selectedGroup ? (
            <>
              <div className="border-b border-slate-200 bg-white px-4 py-4 md:px-5">
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className={cn(
                          "flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-bold ring-1",
                          getAvatarTheme(selectedGroup.chatId)
                        )}
                      >
                        {getInitials(getGroupDisplayName(selectedGroup))}
                      </div>

                      <div className="min-w-0">
                        <div className="truncate text-xl font-bold text-slate-900">
                          {getGroupDisplayName(selectedGroup)}
                        </div>

                        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                          <span className="truncate">{selectedGroup.chatId}</span>
                          <span>•</span>
                          <span>
                            {selectedGroup.isActive
                              ? "Đang theo dõi"
                              : "Đã tạm dừng"}
                          </span>
                          <span>•</span>
                          <span>
                            Crawl gần nhất:{" "}
                            {selectedGroup.lastCrawledDay
                              ? formatDayKey(selectedGroup.lastCrawledDay)
                              : "--"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end xl:self-start">
                      <button
                        type="button"
                        onClick={() => void handleCrawlNow(selectedGroup)}
                        disabled={busyCrawlId === selectedGroup._id}
                        className="inline-flex h-10 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {busyCrawlId === selectedGroup._id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CalendarDays className="h-4 w-4" />
                        )}
                        Crawl hôm nay
                      </button>

                      <button
                        type="button"
                        onClick={() => setSummaryOpen((prev) => !prev)}
                        className={cn(
                          "inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition",
                          summaryOpen
                            ? "border-violet-200 bg-violet-50 text-violet-700"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                        )}
                      >
                        <Sparkles className="h-4 w-4" />
                        AI
                        <ChevronRight
                          className={cn(
                            "h-4 w-4 transition",
                            summaryOpen ? "rotate-180" : ""
                          )}
                        />
                      </button>

                      <div ref={headerMenuRef} className="relative">
                        <button
                          type="button"
                          onClick={() => setOpenHeaderMenu((prev) => !prev)}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
                        >
                          <EllipsisVertical className="h-5 w-5" />
                        </button>

                        {openHeaderMenu ? (
                          <div className="absolute right-0 top-[calc(100%+8px)] z-30 w-60 overflow-hidden rounded-2xl border border-slate-200 bg-white py-2 shadow-[0_18px_50px_rgba(15,23,42,0.16)]">
                            <button
                              type="button"
                              onClick={() => {
                                setOpenHeaderMenu(false);
                                void handleToggle(selectedGroup);
                              }}
                              disabled={busyToggleId === selectedGroup._id}
                              className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {busyToggleId === selectedGroup._id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <CheckCheck className="h-4 w-4" />
                              )}
                              {selectedGroup.isActive
                                ? "Tắt theo dõi"
                                : "Bật theo dõi"}
                            </button>

                            {exportUrl ? (
                              <button
                                type="button"
                                onClick={handleExportCsv}
                                className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                              >
                                <Download className="h-4 w-4" />
                                Export CSV
                              </button>
                            ) : null}

                            <button
                              type="button"
                              onClick={() => {
                                setOpenHeaderMenu(false);
                                void handleDelete(selectedGroup);
                              }}
                              disabled={busyDeleteId === selectedGroup._id}
                              className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {busyDeleteId === selectedGroup._id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                              Xóa
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <form
                    onSubmit={handleSubmitMessages}
                    className="grid gap-3 xl:grid-cols-[180px_minmax(0,1fr)_220px_170px]"
                  >
                    <input
                      type="date"
                      value={messageDayKey}
                      onChange={(e) => setMessageDayKey(e.target.value)}
                      className="h-11 rounded-full border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 outline-none transition focus:border-slate-300 focus:bg-white"
                    />

                    <div className="relative">
                      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        value={messageKeyword}
                        onChange={(e) => setMessageKeyword(e.target.value)}
                        placeholder="Lọc theo nội dung tin nhắn..."
                        className="h-11 w-full rounded-full border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm text-slate-900 outline-none transition focus:border-slate-300 focus:bg-white"
                      />
                    </div>

                    <input
                      value={messageSenderId}
                      onChange={(e) => setMessageSenderId(e.target.value)}
                      placeholder="Sender ID"
                      className="h-11 rounded-full border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 outline-none transition focus:border-slate-300 focus:bg-white"
                    />

                    <button
                      type="submit"
                      disabled={messageLoading}
                      className="inline-flex h-11 items-center justify-center rounded-full bg-sky-500 px-5 text-sm font-semibold text-white transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {messageLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Đang tải...
                        </>
                      ) : (
                        "Lấy danh sách"
                      )}
                    </button>
                  </form>
                </div>
              </div>

              <div
                className="relative min-h-0 flex-1 overflow-hidden"
                style={wallpaperStyle}
              >
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.12),rgba(255,255,255,0.02))]" />

                <div className="relative h-full overflow-y-auto px-4 py-5 md:px-8">
                  <div className="mx-auto max-w-5xl">
                    <div className="mb-6 flex flex-wrap items-center justify-center gap-3">
                      <div className="rounded-full bg-slate-900/75 px-4 py-1.5 text-xs font-semibold text-white shadow-lg backdrop-blur">
                        {formatDayKey(messageDayKey)} • {messageTotal} tin nhắn
                      </div>

                      {(messageKeyword.trim() || messageSenderId.trim()) && (
                        <div className="rounded-full bg-white/85 px-4 py-1.5 text-xs font-semibold text-slate-700 shadow-lg backdrop-blur">
                          {messageKeyword.trim()
                            ? `Keyword: ${messageKeyword.trim()}`
                            : ""}
                          {messageKeyword.trim() && messageSenderId.trim()
                            ? " • "
                            : ""}
                          {messageSenderId.trim()
                            ? `Sender: ${messageSenderId.trim()}`
                            : ""}
                        </div>
                      )}
                    </div>

                    {messageLoading ? (
                      <div className="flex min-h-75 items-center justify-center rounded-[28px] bg-white/70 px-6 py-10 text-slate-600 backdrop-blur">
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Đang tải dữ liệu...
                      </div>
                    ) : messageItems.length === 0 ? (
                      <div className="flex min-h-75 flex-col items-center justify-center rounded-[28px] bg-white/70 px-6 py-10 text-center backdrop-blur">
                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                          <MessageSquare className="h-7 w-7" />
                        </div>
                        <h3 className="mt-4 text-lg font-semibold text-slate-900">
                          Chưa có dữ liệu
                        </h3>
                        <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
                          Chọn ngày rồi bấm lấy danh sách để xem tin nhắn đã crawl
                          của group này.
                        </p>
                      </div>
                    ) : (
                      <div className="pb-8">
                        {messageItems.map((item) => (
                          <ChatBubble
                            key={item._id ?? `${item.messageId}-${item.date}`}
                            item={item}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <SummaryDrawer
                  open={summaryOpen}
                  loading={summaryLoading}
                  data={summaryData}
                  error={summaryError}
                  onClose={() => setSummaryOpen(false)}
                  onSummarize={handleSummarizeDay}
                />

                {!summaryOpen && (
                  <button
                    type="button"
                    onClick={() => {
                      if (!summaryData && !summaryLoading) {
                        void handleSummarizeDay();
                        return;
                      }

                      setSummaryOpen(true);
                    }}
                    className="absolute bottom-6 right-6 z-40 inline-flex h-14 w-14 items-center justify-center rounded-full bg-violet-600 text-white shadow-[0_16px_40px_rgba(124,58,237,0.42)] transition hover:scale-105 hover:bg-violet-700"
                    title="AI tóm tắt"
                  >
                    {summaryLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Sparkles className="h-6 w-6" />
                    )}
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center bg-[#eef2f6] p-6">
              <div className="max-w-md text-center">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm">
                  <MessageSquare className="h-9 w-9" />
                </div>
                <h2 className="mt-5 text-2xl font-bold text-slate-900">
                  Chưa chọn group
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Chọn một group ở thanh bên trái để xem tin nhắn theo ngày.
                </p>
              </div>
            </div>
          )}
        </main>
      </div>

      {openCreate ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl overflow-hidden rounded-4xl border border-slate-200/80 bg-white shadow-[0_25px_80px_rgba(15,23,42,0.28)]">
            <div className="border-b border-slate-200/80 px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-sky-500 px-3 py-1 text-xs font-semibold text-white">
                    <Plus className="h-3.5 w-3.5" />
                    Thêm mới
                  </div>
                  <h3 className="mt-3 text-2xl font-bold text-slate-900">
                    Thêm group theo dõi
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Chọn một cách thêm: nhập <b>chatId / @username</b> hoặc dán{" "}
                    <b>private invite link</b>.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setOpenCreate(false);
                    setGroupValue("");
                    setCreateMode("CHAT_ID");
                  }}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <form onSubmit={handleCreate} className="space-y-5 p-6">
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => {
                    setCreateMode("CHAT_ID");
                    setGroupValue("");
                  }}
                  className={cn(
                    "rounded-3xl border px-4 py-4 text-left transition",
                    createMode === "CHAT_ID"
                      ? "border-sky-500 bg-sky-500 text-white"
                      : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-white"
                  )}
                >
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Hash className="h-4 w-4" />
                    Thêm bằng chatId / username
                  </div>
                  <p
                    className={cn(
                      "mt-2 text-xs leading-5",
                      createMode === "CHAT_ID"
                        ? "text-sky-50"
                        : "text-slate-500"
                    )}
                  >
                    Ví dụ: -1001234567890 hoặc @ten_nhom
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setCreateMode("INVITE_LINK");
                    setGroupValue("");
                  }}
                  className={cn(
                    "rounded-3xl border px-4 py-4 text-left transition",
                    createMode === "INVITE_LINK"
                      ? "border-sky-500 bg-sky-500 text-white"
                      : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-white"
                  )}
                >
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Link2 className="h-4 w-4" />
                    Thêm bằng private invite link
                  </div>
                  <p
                    className={cn(
                      "mt-2 text-xs leading-5",
                      createMode === "INVITE_LINK"
                        ? "text-sky-50"
                        : "text-slate-500"
                    )}
                  >
                    Ví dụ: https://t.me/+xxxxx
                  </p>
                </button>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  {createMode === "CHAT_ID"
                    ? "Chat ID / Username"
                    : "Private invite link"}
                </label>

                <textarea
                  value={groupValue}
                  onChange={(e) => setGroupValue(e.target.value)}
                  rows={4}
                  placeholder={
                    createMode === "CHAT_ID"
                      ? "Ví dụ: -1001234567890 hoặc @ten_nhom"
                      : "Ví dụ: https://t.me/+xxxxx"
                  }
                  className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-300 focus:bg-white"
                />

                <p className="mt-2 text-xs leading-5 text-slate-500">
                  {createMode === "CHAT_ID"
                    ? "Nhập chatId dạng số hoặc @username public."
                    : "Chỉ dùng cho private invite link như https://t.me/+xxxxx"}
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex h-11 items-center justify-center rounded-2xl bg-sky-500 px-5 text-sm font-semibold text-white transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Đang thêm...
                    </>
                  ) : (
                    "Thêm group"
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setOpenCreate(false);
                    setGroupValue("");
                    setCreateMode("CHAT_ID");
                  }}
                  className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Hủy
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}