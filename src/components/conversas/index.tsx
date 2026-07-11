"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { Search, ChevronLeft, Send, MessageSquare, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { fetchConversations, fetchMessages } from "@/lib/conversas/queries";
import type { ConversationRow, MessageRow, ConversationStatus } from "@/lib/conversas/types";

// ─── Helpers ─────────────────────────────────────────────────

type FilterTab = "all" | ConversationStatus;

const FILTER_TABS: { value: FilterTab; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "open", label: "Abertas" },
  { value: "waiting", label: "Aguardando" },
  { value: "resolved", label: "Resolvidas" },
];

function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .filter(Boolean)
    .join("");
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor(
    (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diffDays === 0)
    return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 1) return "Ontem";
  if (diffDays < 7)
    return date.toLocaleDateString("pt-BR", { weekday: "short" });
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

// ─── Component ───────────────────────────────────────────────

interface ConversasClientProps {
  initialConversations: ConversationRow[];
  workspaceId: string;
  initialContactId?: string | null;
}

export function ConversasClient({
  initialConversations,
  workspaceId,
  initialContactId,
}: ConversasClientProps) {
  const supabase = useMemo(() => createClient(), []);

  const [conversations, setConversations] =
    useState<ConversationRow[]>(initialConversations);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [search, setSearch] = useState("");
  const [inputValue, setInputValue] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendWarning, setSendWarning] = useState<string | null>(null);
  const [sendWarningCode, setSendWarningCode] = useState<"no_chat_id" | "vps_error" | null>(null);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const wasDisconnectedRef = useRef(false);
  const didAutoSelectRef = useRef(false);

  const selectedConv = conversations.find((c) => c.id === selectedConvId) ?? null;
  // isHermesActive = false quando hermes_paused = true (agente no controle)
  const isHermesActive = selectedConv ? !selectedConv.hermes_paused : true;

  // ── Filtered conversations ──────────────────────────────────
  const filteredConversations = conversations.filter((c) => {
    const matchesTab = activeTab === "all" || c.status === activeTab;
    const q = search.toLowerCase();
    const matchesSearch =
      q === "" ||
      (c.contacts?.name ?? "").toLowerCase().includes(q) ||
      (c.last_message_preview ?? "").toLowerCase().includes(q);
    return matchesTab && matchesSearch;
  });

  const tabCounts: Record<FilterTab, number> = {
    all: conversations.reduce((n, c) => n + (c.unread_count > 0 ? 1 : 0), 0),
    open: conversations.filter((c) => c.status === "open").length,
    waiting: conversations.filter((c) => c.status === "waiting").length,
    resolved: conversations.filter((c) => c.status === "resolved").length,
  };

  // ── Auto-selecionar conversa ao vir do kanban (?contact=uuid) ─
  useEffect(() => {
    if (didAutoSelectRef.current || !initialContactId || conversations.length === 0) return;
    const match = conversations.find((c) => c.contacts?.id === initialContactId);
    if (match) {
      setSelectedConvId(match.id);
      didAutoSelectRef.current = true;
    }
  }, [initialContactId, conversations]);

  // ── Scroll to bottom ───────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 60);
    return () => clearTimeout(t);
  }, [selectedConvId, messages.length]);

  // ── Reset input when conversation changes ──────────────────
  useEffect(() => {
    setInputValue("");
    setSendWarning(null);
    setSendWarningCode(null);
  }, [selectedConvId]);

  // ── Textarea auto-resize ────────────────────────────────────
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 112)}px`;
    }
  }, [inputValue]);

  // ── Load messages + subscribe when conversation selected ───
  useEffect(() => {
    if (!selectedConvId) {
      setMessages([]);
      return;
    }

    setIsLoadingMessages(true);
    setMessages([]);

    fetchMessages(supabase, selectedConvId)
      .then(setMessages)
      .catch((e) => console.error("[conversas] fetchMessages:", e))
      .finally(() => setIsLoadingMessages(false));

    const channel = supabase
      .channel(`conv-msgs-${selectedConvId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${selectedConvId}`,
        },
        (payload: { new: MessageRow }) => {
          const msg = payload.new;
          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedConvId, supabase]);

  // ── Subscribe to workspace conversations (list updates) ────
  useEffect(() => {
    if (!workspaceId) return;

    const channel = supabase
      .channel("workspace-convs")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "conversations" },
        (payload: { new: ConversationRow }) => {
          const updated = payload.new;
          setConversations((prev) => {
            const list = prev.map((c) =>
              c.id === updated.id ? { ...c, ...updated } : c
            );
            return [...list].sort(
              (a, b) =>
                new Date(b.last_message_at ?? 0).getTime() -
                new Date(a.last_message_at ?? 0).getTime()
            );
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "conversations" },
        async (payload: { new: { id: string } }) => {
          const { data } = await supabase
            .from("conversations")
            .select(
              "id, status, hermes_paused, unread_count, last_message_at, last_message_preview, contacts(id, name, phone)"
            )
            .eq("id", payload.new.id)
            .single();
          if (data) {
            setConversations((prev) => [
              data as unknown as ConversationRow,
              ...prev,
            ]);
          }
        }
      )
      .subscribe((status: string) => {
        if (status === "SUBSCRIBED") {
          setIsRealtimeConnected(true);
          if (wasDisconnectedRef.current) {
            wasDisconnectedRef.current = false;
            fetchConversations(supabase)
              .then(setConversations)
              .catch((e) => console.error("[realtime refetch]", e));
          }
        } else if (
          status === "CLOSED" ||
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT"
        ) {
          setIsRealtimeConnected(false);
          wasDisconnectedRef.current = true;
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [workspaceId, supabase]);

  // ── Handlers ───────────────────────────────────────────────

  function handleSelectConv(id: string) {
    setSelectedConvId(id);

    // Marca como lida — zera unread_count localmente e no banco
    const conv = conversations.find((c) => c.id === id);
    if (!conv || conv.unread_count === 0) return;

    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, unread_count: 0 } : c))
    );

    supabase
      .from("conversations")
      .update({ unread_count: 0 })
      .eq("id", id)
      .then(({ error }) => {
        if (error) console.error("[mark read]", error.message);
      });
  }

  async function handleToggleHermes() {
    if (!selectedConvId || !selectedConv) return;
    const newPaused = !selectedConv.hermes_paused;

    setConversations((prev) =>
      prev.map((c) =>
        c.id === selectedConvId ? { ...c, hermes_paused: newPaused } : c
      )
    );

    const { error } = await supabase
      .from("conversations")
      .update({ hermes_paused: newPaused })
      .eq("id", selectedConvId);

    if (error) {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === selectedConvId ? { ...c, hermes_paused: !newPaused } : c
        )
      );
      console.error("[hermes toggle]", error.message);
    }
  }

  async function handleSend() {
    if (!inputValue.trim() || !selectedConvId || isHermesActive || isSending) return;

    const text = inputValue.trim();
    setInputValue("");
    setIsSending(true);
    setSendWarning(null);
    setSendWarningCode(null);

    try {
      const res = await fetch("/api/hermes/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversation_id: selectedConvId, message: text }),
      });

      const data = await res.json();

      if (!res.ok) {
        setInputValue(text);
        setSendWarning(data.error ?? "Erro ao enviar mensagem");
        setSendWarningCode("vps_error");
      } else if (data.warning) {
        setSendWarning(data.warning);
        setSendWarningCode(data.warning_code ?? "vps_error");
      }
    } catch {
      setInputValue(text);
      setSendWarning("Erro de rede ao enviar mensagem");
      setSendWarningCode("vps_error");
    } finally {
      setIsSending(false);
      textareaRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  // ── Render ─────────────────────────────────────────────────

  return (
    <div className="flex-1 flex overflow-hidden bg-[#0D0B0B]">
      {/* ─── LEFT PANEL ─── */}
      <div
        className={cn(
          "flex flex-col w-full lg:w-80 shrink-0 border-r border-white/7",
          selectedConvId ? "hidden lg:flex" : "flex"
        )}
      >
        {/* Search */}
        <div className="shrink-0 p-3 border-b border-white/7">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar conversa..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#161210] text-sm pl-9 pr-4 py-2 rounded-lg border border-white/7 text-foreground placeholder:text-muted-foreground/35 focus:outline-none focus:border-primary/35 transition-colors duration-75"
            />
          </div>
        </div>

        {/* Filter tabs */}
        <div className="shrink-0 flex gap-1 px-2 py-2 border-b border-white/7 overflow-x-auto scrollbar-none">
          {FILTER_TABS.map((tab) => {
            const count = tabCounts[tab.value];
            const isActive = activeTab === tab.value;
            return (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={cn(
                  "shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors duration-75",
                  isActive
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground/70 hover:bg-white/5 hover:text-foreground"
                )}
              >
                {tab.label}
                {count > 0 && (
                  <span
                    className={cn(
                      "h-4 min-w-[16px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center",
                      isActive
                        ? "bg-primary/20 text-primary"
                        : "bg-white/8 text-muted-foreground/60"
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Conversation items */}
        <div className="flex-1 overflow-y-auto py-1">
          {filteredConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 px-4 text-center">
              <p className="text-xs text-muted-foreground/40">
                Nenhuma conversa encontrada
              </p>
            </div>
          ) : (
            filteredConversations.map((conv) => (
              <ConversationItem
                key={conv.id}
                conv={conv}
                isSelected={selectedConvId === conv.id}
                onSelect={() => handleSelectConv(conv.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* ─── RIGHT PANEL ─── */}
      <div
        className={cn(
          "flex-1 flex-col min-w-0",
          selectedConvId ? "flex" : "hidden lg:flex"
        )}
      >
        {selectedConv ? (
          <>
            {/* Chat header */}
            <div className="shrink-0 flex items-center gap-3 px-4 h-[57px] border-b border-white/7">
              <button
                onClick={() => setSelectedConvId(null)}
                className="lg:hidden p-1.5 -ml-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors duration-75"
                aria-label="Voltar"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <div className="h-8 w-8 rounded-full bg-primary/15 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                {getInitials(selectedConv.contacts?.name ?? "?")}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground leading-tight truncate">
                  {selectedConv.contacts?.name ?? "Contato"}
                </p>
                <p className="text-[11px] text-muted-foreground/50 font-mono">
                  {selectedConv.contacts?.phone ?? "—"}
                </p>
              </div>

              {!isRealtimeConnected && (
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-full border border-yellow-500/30 bg-yellow-500/10 text-yellow-400 text-xs shrink-0">
                  <WifiOff className="h-3 w-3" />
                  <span className="hidden sm:inline">Reconectando...</span>
                </div>
              )}

              <div
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium shrink-0",
                  isHermesActive
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                    : "border-white/10 bg-white/5 text-muted-foreground/70"
                )}
              >
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    isHermesActive
                      ? "bg-emerald-400 animate-pulse"
                      : "bg-muted-foreground/40"
                  )}
                />
                {isHermesActive ? "Sofia ativa" : "Sofia pausada"}
              </div>
            </div>

            {/* Messages */}
            <div
              key={selectedConvId}
              className="flex-1 overflow-y-auto p-4 space-y-2 animate-in fade-in duration-[120ms] ease-out"
            >
              {isLoadingMessages ? (
                <div className="flex items-center justify-center h-full">
                  <div className="flex gap-1.5">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="h-1.5 w-1.5 rounded-full bg-primary/40 animate-pulse"
                        style={{ animationDelay: `${i * 150}ms` }}
                      />
                    ))}
                  </div>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-sm text-muted-foreground/35">
                    Nenhuma mensagem ainda
                  </p>
                </div>
              ) : (
                messages.map((msg, index) => (
                  <MessageBubble
                    key={msg.id}
                    message={msg}
                    prevSender={
                      index > 0 ? messages[index - 1].sender : undefined
                    }
                  />
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Hermes control bar */}
            <div className="shrink-0 flex items-center justify-between gap-3 px-4 py-2.5 border-t border-white/7">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full shrink-0",
                    isHermesActive
                      ? "bg-emerald-400"
                      : "bg-muted-foreground/40"
                  )}
                />
                <span className="text-xs text-muted-foreground/60 truncate">
                  {isHermesActive
                    ? "Sofia está gerenciando esta conversa"
                    : "Você está no controle"}
                </span>
              </div>
              <button
                onClick={handleToggleHermes}
                className={cn(
                  "shrink-0 text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors duration-75",
                  isHermesActive
                    ? "border-primary/35 text-primary hover:bg-primary/8"
                    : "border-emerald-500/35 text-emerald-400 hover:bg-emerald-500/8"
                )}
              >
                {isHermesActive ? "Assumir conversa" : "Devolver para Sofia"}
              </button>
            </div>

            {/* Input area */}
            <div className="shrink-0 p-3 border-t border-white/7">
              <div className="flex items-end gap-2">
                <textarea
                  ref={textareaRef}
                  placeholder={
                    isHermesActive
                      ? "Sofia está gerenciando — clique em 'Assumir conversa' para enviar"
                      : "Digite uma mensagem... (Enter para enviar)"
                  }
                  value={inputValue}
                  onChange={(e) => {
                    if (!isHermesActive) {
                      setInputValue(e.target.value);
                      if (sendWarning) { setSendWarning(null); setSendWarningCode(null); }
                    }
                  }}
                  onKeyDown={handleKeyDown}
                  rows={1}
                  disabled={isHermesActive || isSending}
                  className={cn(
                    "flex-1 border rounded-xl px-4 py-2.5 text-sm resize-none transition-colors duration-75 overflow-hidden",
                    !isHermesActive
                      ? "bg-[#161210] border-white/7 text-foreground placeholder:text-muted-foreground/35 focus:outline-none focus:border-primary/30 disabled:opacity-60"
                      : "bg-[#161210]/50 border-white/5 placeholder:text-muted-foreground/25 cursor-not-allowed"
                  )}
                  style={{ maxHeight: "112px" }}
                />
                <button
                  onClick={handleSend}
                  disabled={isHermesActive || !inputValue.trim() || isSending}
                  className={cn(
                    "h-[42px] w-[42px] rounded-xl flex items-center justify-center shrink-0 transition-all duration-75",
                    !isHermesActive && inputValue.trim() && !isSending
                      ? "bg-primary text-white hover:bg-primary/90 active:scale-95"
                      : "bg-muted/20 text-muted-foreground/20 cursor-not-allowed"
                  )}
                  aria-label={
                    isHermesActive ? "Envio indisponível" : "Enviar mensagem"
                  }
                >
                  {isSending ? (
                    <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </button>
              </div>

              {sendWarning && sendWarningCode === "no_chat_id" && (
                <div className="mt-2 px-3 py-2 rounded-lg border border-orange-500/30 bg-orange-500/8">
                  <p className="text-[11px] text-orange-400 font-medium leading-relaxed">
                    ⚠ ID do WhatsApp não encontrado
                  </p>
                  <p className="text-[11px] text-orange-400/70 mt-0.5 leading-relaxed">
                    {sendWarning}
                  </p>
                </div>
              )}
              {sendWarning && sendWarningCode !== "no_chat_id" && (
                <p className="text-[11px] text-yellow-500/70 mt-1.5 px-1">
                  ⚠ {sendWarning}
                </p>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <div className="h-16 w-16 rounded-2xl bg-[#1E1916] border border-white/5 flex items-center justify-center mb-5">
              <MessageSquare className="h-7 w-7 text-primary/35" />
            </div>
            <h3 className="text-sm font-semibold text-foreground/80 mb-2">
              Selecione uma conversa
            </h3>
            <p className="text-xs text-muted-foreground/45 max-w-[180px] leading-relaxed">
              Escolha uma conversa na lista para ver as mensagens
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Conversation List Item ───────────────────────────────────

interface ConversationItemProps {
  conv: ConversationRow;
  isSelected: boolean;
  onSelect: () => void;
}

function ConversationItem({ conv, isSelected, onSelect }: ConversationItemProps) {
  const contactName = conv.contacts?.name ?? "Contato";
  const preview = conv.last_message_preview ?? "";

  return (
    <button
      onClick={onSelect}
      className={cn(
        "relative w-full flex items-start gap-3 px-3 py-3 text-left transition-colors duration-75",
        isSelected ? "bg-[#1E1916]" : "hover:bg-[#161210]"
      )}
    >
      {isSelected && (
        <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-r-full bg-primary" />
      )}
      <div className="shrink-0 h-9 w-9 rounded-full bg-primary/12 flex items-center justify-center text-xs font-bold text-primary">
        {getInitials(contactName)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span
            className={cn(
              "text-sm truncate",
              conv.unread_count > 0
                ? "font-semibold text-foreground"
                : "font-medium text-foreground/75"
            )}
          >
            {contactName}
          </span>
          <span className="shrink-0 text-[11px] font-mono text-muted-foreground/45">
            {conv.last_message_at ? formatTime(conv.last_message_at) : "—"}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <p className="text-xs text-muted-foreground/60 truncate">{preview}</p>
          {conv.unread_count > 0 && (
            <span className="shrink-0 h-[18px] min-w-[18px] px-1 rounded-full bg-primary text-[10px] font-bold text-white flex items-center justify-center">
              {conv.unread_count}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

// ─── Message Bubble ───────────────────────────────────────────

interface MessageBubbleProps {
  message: MessageRow;
  prevSender: string | undefined;
}

function MessageBubble({ message, prevSender }: MessageBubbleProps) {
  const isContact = message.direction === "inbound";
  const isHermes = message.sender === "hermes";
  const isSameSender = prevSender === message.sender;
  const content = message.content ?? "[mídia]";
  const timeStr = formatTime(message.created_at);

  if (isContact) {
    return (
      <div className={cn("flex justify-start", isSameSender && "mt-0.5")}>
        <div className="max-w-[78%] px-4 py-2.5 bg-[#1E1916] text-sm leading-relaxed text-foreground/90 rounded-[4px_16px_16px_16px]">
          {content}
          <span className="block text-right text-[11px] font-mono text-muted-foreground/35 mt-1.5">
            {timeStr}
          </span>
        </div>
      </div>
    );
  }

  if (isHermes) {
    return (
      <div className={cn("flex justify-end", isSameSender && "mt-0.5")}>
        <div className="max-w-[78%] px-4 py-2.5 bg-[#1C1A16] border border-[#E84C1F]/15 text-sm leading-relaxed text-foreground/90 rounded-[16px_4px_16px_16px]">
          <span className="text-[#E84C1F]/45 mr-1.5 text-[10px] select-none align-middle">
            ◆
          </span>
          {content}
          <span className="block text-right text-[11px] font-mono text-muted-foreground/35 mt-1.5">
            {timeStr}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex justify-end", isSameSender && "mt-0.5")}>
      <div className="max-w-[78%] px-4 py-2.5 bg-[#1A1E1C] border border-[#10B981]/20 text-sm leading-relaxed text-foreground/90 rounded-[16px_4px_16px_16px]">
        {content}
        <span className="block text-right text-[11px] font-mono text-muted-foreground/35 mt-1.5">
          {timeStr}
        </span>
      </div>
    </div>
  );
}
