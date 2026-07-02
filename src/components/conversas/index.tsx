"use client";

import { useState, useRef, useEffect } from "react";
import { Search, ChevronLeft, Send, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  MockConversation,
  MockMessage,
  ConversationStatus,
} from "@/lib/conversas/mock-data";

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

interface ConversasClientProps {
  conversations: MockConversation[];
  messagesByConv: Record<string, MockMessage[]>;
}

export function ConversasClient({
  conversations,
  messagesByConv,
}: ConversasClientProps) {
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [search, setSearch] = useState("");
  const [inputValue, setInputValue] = useState("");
  const [localMessages, setLocalMessages] = useState<
    Record<string, MockMessage[]>
  >({});
  const [hermesOverrides, setHermesOverrides] = useState<
    Record<string, boolean>
  >({});

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const selectedConv =
    conversations.find((c) => c.id === selectedConvId) ?? null;

  const isHermesActive =
    selectedConvId !== null
      ? (hermesOverrides[selectedConvId] ??
        (selectedConv?.hermesActive ?? true))
      : true;

  const filteredConversations = conversations.filter((c) => {
    const matchesTab = activeTab === "all" || c.status === activeTab;
    const q = search.toLowerCase();
    const matchesSearch =
      q === "" ||
      c.contactName.toLowerCase().includes(q) ||
      c.lastMessagePreview.toLowerCase().includes(q);
    return matchesTab && matchesSearch;
  });

  const currentMessages = selectedConvId
    ? [
        ...(messagesByConv[selectedConvId] ?? []),
        ...(localMessages[selectedConvId] ?? []),
      ]
    : [];

  // Scroll to bottom when conversation changes or new message added
  useEffect(() => {
    const t = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 60);
    return () => clearTimeout(t);
  }, [selectedConvId, currentMessages.length]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 112)}px`;
    }
  }, [inputValue]);

  function handleSelectConv(id: string) {
    setSelectedConvId(id);
    setInputValue("");
  }

  function handleToggleHermes() {
    if (!selectedConvId) return;
    setHermesOverrides((prev) => ({
      ...prev,
      [selectedConvId]: !isHermesActive,
    }));
  }

  function handleSend() {
    if (!inputValue.trim() || !selectedConvId) return;
    const msg: MockMessage = {
      id: `local-${Date.now()}`,
      conversationId: selectedConvId,
      sender: isHermesActive ? "hermes" : "agent",
      direction: "outbound",
      content: inputValue.trim(),
      createdAt: new Date().toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
    setLocalMessages((prev) => ({
      ...prev,
      [selectedConvId]: [...(prev[selectedConvId] ?? []), msg],
    }));
    setInputValue("");
    textareaRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const tabCounts: Record<FilterTab, number> = {
    all: conversations.reduce((n, c) => n + (c.unreadCount > 0 ? 1 : 0), 0),
    open: conversations.filter((c) => c.status === "open").length,
    waiting: conversations.filter((c) => c.status === "waiting").length,
    resolved: conversations.filter((c) => c.status === "resolved").length,
  };

  return (
    <div className="flex-1 flex overflow-hidden bg-[#0D0B0B]">
      {/* ─── LEFT PANEL ─────────────────────────────── */}
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

      {/* ─── RIGHT PANEL ─────────────────────────────── */}
      <div
        className={cn(
          "flex-1 flex flex-col min-w-0",
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
                {getInitials(selectedConv.contactName)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground leading-tight truncate">
                  {selectedConv.contactName}
                </p>
                <p className="text-[11px] text-muted-foreground/50 font-mono">
                  {selectedConv.contactPhone}
                </p>
              </div>
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
              {currentMessages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-sm text-muted-foreground/35">
                    Nenhuma mensagem ainda
                  </p>
                </div>
              ) : (
                <>
                  {currentMessages.map((msg, index) => (
                    <MessageBubble
                      key={msg.id}
                      message={msg}
                      prevSender={
                        index > 0
                          ? currentMessages[index - 1].sender
                          : undefined
                      }
                    />
                  ))}
                </>
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
                      ? "Mensagem como agente humano..."
                      : "Digite uma mensagem..."
                  }
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={1}
                  className="flex-1 bg-[#161210] border border-white/7 rounded-xl px-4 py-2.5 text-sm resize-none text-foreground placeholder:text-muted-foreground/35 focus:outline-none focus:border-primary/30 transition-colors duration-75 overflow-hidden"
                  style={{ maxHeight: "112px" }}
                />
                <button
                  onClick={handleSend}
                  disabled={!inputValue.trim()}
                  className="h-[42px] w-[42px] rounded-xl bg-primary flex items-center justify-center text-white shrink-0 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-primary/90 active:scale-95 transition-all duration-75"
                  aria-label="Enviar mensagem"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </>
        ) : (
          /* Empty state */
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

// ─── Conversation List Item ──────────────────────────────────

interface ConversationItemProps {
  conv: MockConversation;
  isSelected: boolean;
  onSelect: () => void;
}

function ConversationItem({ conv, isSelected, onSelect }: ConversationItemProps) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        "relative w-full flex items-start gap-3 px-3 py-3 text-left transition-colors duration-75",
        isSelected ? "bg-[#1E1916]" : "hover:bg-[#161210]"
      )}
    >
      {/* Selection indicator */}
      {isSelected && (
        <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-r-full bg-primary" />
      )}

      {/* Avatar */}
      <div className="shrink-0 h-9 w-9 rounded-full bg-primary/12 flex items-center justify-center text-xs font-bold text-primary">
        {getInitials(conv.contactName)}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span
            className={cn(
              "text-sm truncate",
              conv.unreadCount > 0
                ? "font-semibold text-foreground"
                : "font-medium text-foreground/75"
            )}
          >
            {conv.contactName}
          </span>
          <span className="shrink-0 text-[11px] font-mono text-muted-foreground/45">
            {conv.lastMessageAt}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <p className="text-xs text-muted-foreground/60 truncate">
            {conv.lastMessageSender === "hermes" && (
              <span className="text-primary/45 mr-1 text-[10px] select-none">
                ◆
              </span>
            )}
            {conv.lastMessagePreview}
          </p>
          {conv.unreadCount > 0 && (
            <span className="shrink-0 h-[18px] min-w-[18px] px-1 rounded-full bg-primary text-[10px] font-bold text-white flex items-center justify-center">
              {conv.unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

// ─── Message Bubble ──────────────────────────────────────────

interface MessageBubbleProps {
  message: MockMessage;
  prevSender: string | undefined;
}

function MessageBubble({ message, prevSender }: MessageBubbleProps) {
  const isContact = message.direction === "inbound";
  const isHermes = message.sender === "hermes";
  const isSameSender = prevSender === message.sender;

  if (isContact) {
    return (
      <div className={cn("flex justify-start", isSameSender && "mt-0.5")}>
        <div className="max-w-[78%] px-4 py-2.5 bg-[#1E1916] text-sm leading-relaxed text-foreground/90 rounded-[4px_16px_16px_16px]">
          {message.content}
          <span className="block text-right text-[11px] font-mono text-muted-foreground/35 mt-1.5">
            {message.createdAt}
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
          {message.content}
          <span className="block text-right text-[11px] font-mono text-muted-foreground/35 mt-1.5">
            {message.createdAt}
          </span>
        </div>
      </div>
    );
  }

  // agent (human)
  return (
    <div className={cn("flex justify-end", isSameSender && "mt-0.5")}>
      <div className="max-w-[78%] px-4 py-2.5 bg-[#1A1E1C] border border-[#10B981]/20 text-sm leading-relaxed text-foreground/90 rounded-[16px_4px_16px_16px]">
        {message.content}
        <span className="block text-right text-[11px] font-mono text-muted-foreground/35 mt-1.5">
          {message.createdAt}
        </span>
      </div>
    </div>
  );
}
