"use client";

import { useState, useMemo, useEffect } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
  type CollisionDetection,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import {
  Sparkles,
  MessageSquare,
  Phone,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import type { ContactRow, KanbanStageKey } from "@/lib/leads/types";

// ─── Config ─────────────────────────────────────────────────

const KANBAN_STAGES = [
  { key: "novo" as KanbanStageKey, label: "Novo Lead", color: "#3b82f6" },
  { key: "contato" as KanbanStageKey, label: "Contato Feito", color: "#06b6d4" },
  { key: "agendado" as KanbanStageKey, label: "Avaliação Agendada", color: "#eab308" },
  { key: "compareceu" as KanbanStageKey, label: "Compareceu", color: "#8b5cf6" },
  { key: "fechado" as KanbanStageKey, label: "Fechado", color: "#22c55e" },
] as const;

const TEMP_CONFIG = {
  hot: { label: "Quente", cls: "bg-red-500/15 text-red-400 border-red-500/20" },
  warm: { label: "Morno", cls: "bg-amber-500/15 text-amber-400 border-amber-500/20" },
  cold: { label: "Frio", cls: "bg-blue-500/15 text-blue-400 border-blue-500/20" },
} as const;

const VALID_STAGES = new Set<string>(KANBAN_STAGES.map((s) => s.key));

function normalizeStage(stage: string | null): KanbanStageKey {
  if (stage && VALID_STAGES.has(stage)) return stage as KanbanStageKey;
  return "novo";
}

// Prefer pointer location over geometric center for column drop targets
const detectCollision: CollisionDetection = (args) => {
  const ptr = pointerWithin(args);
  if (ptr.length > 0) return ptr;
  return rectIntersection(args);
};

// ─── LeadsClient ─────────────────────────────────────────────

interface LeadsClientProps {
  initialContacts: ContactRow[];
  workspaceId: string;
}

export function LeadsClient({ initialContacts, workspaceId }: LeadsClientProps) {
  const supabase = useMemo(() => createClient(), []);
  const [contacts, setContacts] = useState<ContactRow[]>(initialContacts);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  const activeContact = useMemo(
    () => contacts.find((c) => c.id === activeId) ?? null,
    [contacts, activeId]
  );

  // Group contacts by stage
  const byStage = useMemo(() => {
    const map = Object.fromEntries(
      KANBAN_STAGES.map((s) => [s.key, [] as ContactRow[]])
    ) as Record<KanbanStageKey, ContactRow[]>;
    for (const c of contacts) {
      map[normalizeStage(c.kanban_stage)].push(c);
    }
    return map;
  }, [contacts]);

  // Realtime: contacts INSERT / UPDATE
  // NOTE: contacts table must be in supabase_realtime publication.
  // If not already added, run: ALTER PUBLICATION supabase_realtime ADD TABLE contacts;
  useEffect(() => {
    if (!workspaceId) return;
    const channel = supabase
      .channel("leads-contacts")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "contacts" },
        (payload: { new: ContactRow }) => {
          setContacts((prev) =>
            prev.map((c) => (c.id === payload.new.id ? { ...c, ...payload.new } : c))
          );
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "contacts" },
        (payload: { new: ContactRow }) => {
          setContacts((prev) => {
            if (prev.some((c) => c.id === payload.new.id)) return prev;
            return [payload.new, ...prev];
          });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [workspaceId, supabase]);

  async function handleRefresh() {
    setIsRefreshing(true);
    try {
      const { data, error } = await supabase
        .from("contacts")
        .select(
          "id, workspace_id, name, phone, email, whatsapp_chat_id, kanban_stage, temperature, procedure_interest, tags, notes, source, created_at, updated_at"
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      setContacts(data ?? []);
    } catch {
      toast.error("Erro ao atualizar leads");
    } finally {
      setIsRefreshing(false);
    }
  }

  function handleDragStart({ active }: DragStartEvent) {
    setActiveId(active.id as string);
  }

  async function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    if (!over) return;

    const contactId = active.id as string;
    const newStage = over.id as KanbanStageKey;
    const contact = contacts.find((c) => c.id === contactId);
    if (!contact) return;

    const oldStage = normalizeStage(contact.kanban_stage);
    if (oldStage === newStage) return;

    // Optimistic update
    setContacts((prev) =>
      prev.map((c) => (c.id === contactId ? { ...c, kanban_stage: newStage } : c))
    );

    const { error } = await supabase
      .from("contacts")
      .update({ kanban_stage: newStage, updated_at: new Date().toISOString() })
      .eq("id", contactId);

    if (error) {
      // Revert
      setContacts((prev) =>
        prev.map((c) => (c.id === contactId ? { ...c, kanban_stage: oldStage } : c))
      );
      toast.error("Erro ao mover lead — tente novamente");
    }
  }

  async function handleAnalyze(contactId: string) {
    try {
      await fetch("/api/leads/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact_id: contactId }),
      });
      toast.info("Análise em breve — recurso em desenvolvimento", {
        description: "A análise com IA será ativada em breve.",
      });
    } catch {
      toast.error("Erro ao iniciar análise");
    }
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#0D0B0B]">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-5 h-[57px] border-b border-white/7">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-foreground">
            Pipeline de Leads
          </span>
          <span className="text-[11px] font-mono text-muted-foreground/45">
            {contacts.length} paciente{contacts.length !== 1 ? "s" : ""}
          </span>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-muted-foreground/60 hover:text-foreground hover:bg-white/5 border border-white/7 transition-colors duration-75 disabled:opacity-40"
        >
          <RefreshCw
            className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")}
          />
          Atualizar
        </button>
      </div>

      {/* Kanban board */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <DndContext
          sensors={sensors}
          collisionDetection={detectCollision}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-3 p-4 h-full min-w-max">
            {KANBAN_STAGES.map((stage) => (
              <KanbanColumn
                key={stage.key}
                stage={stage}
                contacts={byStage[stage.key]}
                isDragActive={activeId !== null}
                onAnalyze={handleAnalyze}
              />
            ))}
          </div>

          <DragOverlay
            dropAnimation={{ duration: 160, easing: "ease-out" }}
          >
            {activeContact ? (
              <LeadCard contact={activeContact} onAnalyze={() => {}} isOverlay />
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}

// ─── KanbanColumn ─────────────────────────────────────────────

interface KanbanColumnProps {
  stage: (typeof KANBAN_STAGES)[number];
  contacts: ContactRow[];
  isDragActive: boolean;
  onAnalyze: (id: string) => void;
}

function KanbanColumn({
  stage,
  contacts,
  isDragActive,
  onAnalyze,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.key });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col w-[272px] rounded-xl border transition-colors duration-100",
        isOver
          ? "border-white/20 bg-[#1C1917]"
          : isDragActive
          ? "border-white/10 bg-[#141210]"
          : "border-white/7 bg-[#141210]"
      )}
    >
      {/* Column header */}
      <div className="shrink-0 flex items-center gap-2.5 px-4 py-3 border-b border-white/7">
        <span
          className="h-1.5 w-1.5 rounded-full shrink-0"
          style={{ backgroundColor: stage.color }}
        />
        <span className="flex-1 text-xs font-semibold text-foreground/85 truncate">
          {stage.label}
        </span>
        <span
          className="shrink-0 h-[18px] min-w-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center"
          style={{
            backgroundColor: `${stage.color}1a`,
            color: stage.color,
          }}
        >
          {contacts.length}
        </span>
      </div>

      {/* Drop indicator */}
      {isOver && (
        <div
          className="mx-3 mt-2 h-0.5 rounded-full opacity-60"
          style={{ backgroundColor: stage.color }}
        />
      )}

      {/* Cards */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-2 scrollbar-none">
        {contacts.length === 0 ? (
          <div className="flex items-center justify-center h-[72px] rounded-lg border border-dashed border-white/5">
            <p className="text-[11px] text-muted-foreground/25">
              Nenhum lead
            </p>
          </div>
        ) : (
          contacts.map((contact) => (
            <DraggableLeadCard
              key={contact.id}
              contact={contact}
              onAnalyze={onAnalyze}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ─── DraggableLeadCard ────────────────────────────────────────

interface DraggableLeadCardProps {
  contact: ContactRow;
  onAnalyze: (id: string) => void;
}

function DraggableLeadCard({ contact, onAnalyze }: DraggableLeadCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: contact.id });

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        "transition-opacity duration-100",
        isDragging && "opacity-40"
      )}
    >
      <LeadCard contact={contact} onAnalyze={onAnalyze} />
    </div>
  );
}

// ─── LeadCard ─────────────────────────────────────────────────

interface LeadCardProps {
  contact: ContactRow;
  onAnalyze: (id: string) => void;
  isOverlay?: boolean;
}

function LeadCard({ contact, onAnalyze, isOverlay = false }: LeadCardProps) {
  const tempConfig = contact.temperature ? TEMP_CONFIG[contact.temperature] : null;
  const notesPreview =
    contact.notes && contact.notes.length > 0
      ? contact.notes.length > 75
        ? contact.notes.slice(0, 75) + "…"
        : contact.notes
      : null;

  return (
    <div
      className={cn(
        "flex flex-col gap-2.5 p-3.5 rounded-lg border bg-[#1C1917] border-white/8 select-none",
        isOverlay
          ? "cursor-grabbing shadow-xl shadow-black/50 border-white/15 rotate-[1.5deg]"
          : "cursor-grab active:cursor-grabbing"
      )}
    >
      {/* Name + temperature */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-foreground leading-tight line-clamp-1 flex-1">
          {contact.name}
        </p>
        {tempConfig && (
          <span
            className={cn(
              "shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border",
              tempConfig.cls
            )}
          >
            {tempConfig.label}
          </span>
        )}
      </div>

      {/* Phone */}
      {contact.phone && (
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/45 font-mono">
          <Phone className="h-3 w-3 shrink-0" />
          {contact.phone}
        </div>
      )}

      {/* Procedure interest */}
      {contact.procedure_interest && (
        <span className="self-start text-[11px] px-2 py-0.5 rounded-full border border-primary/20 text-primary/75 bg-primary/8">
          {contact.procedure_interest}
        </span>
      )}

      {/* Tags */}
      {contact.tags && contact.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {contact.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/5 text-muted-foreground/55 border border-white/6"
            >
              {tag}
            </span>
          ))}
          {contact.tags.length > 3 && (
            <span className="text-[10px] text-muted-foreground/35 flex items-center">
              +{contact.tags.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Notes preview */}
      {notesPreview && (
        <p className="text-[11px] text-muted-foreground/40 leading-relaxed line-clamp-2">
          {notesPreview}
        </p>
      )}

      {/* Actions — pointer events isolated from drag listeners */}
      <div
        className="flex items-center gap-1 mt-0.5 pt-2.5 border-t border-white/6"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <a
          href="/conversas"
          className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] text-muted-foreground/55 hover:text-foreground hover:bg-white/6 transition-colors duration-75"
        >
          <MessageSquare className="h-3 w-3" />
          Conversa
        </a>
        <button
          onClick={() => onAnalyze(contact.id)}
          className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] text-muted-foreground/55 hover:text-primary hover:bg-primary/8 transition-colors duration-75"
        >
          <Sparkles className="h-3 w-3" />
          Analisar IA
        </button>
      </div>
    </div>
  );
}
