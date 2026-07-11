"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import {
  Search,
  Plus,
  X,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  MessageSquare,
  Loader2,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import type { ContactRow, KanbanStageKey, TemperatureValue } from "@/lib/leads/types";

// ─── Config ─────────────────────────────────────────────────

const LIMIT = 50;

const CONTACT_FIELDS =
  "id, workspace_id, name, phone, email, whatsapp_chat_id, kanban_stage, temperature, procedure_interest, tags, notes, source, created_at, updated_at";

const TEMP_CONFIG: Record<string, { label: string; cls: string }> = {
  hot: { label: "Quente", cls: "bg-red-500/15 text-red-400 border border-red-500/20" },
  warm: { label: "Morno", cls: "bg-amber-500/15 text-amber-400 border border-amber-500/20" },
  cold: { label: "Frio", cls: "bg-blue-500/15 text-blue-400 border border-blue-500/20" },
};

const STAGE_CONFIG: Record<string, { label: string; color: string }> = {
  novo: { label: "Novo Lead", color: "#3b82f6" },
  contato: { label: "Contato Feito", color: "#06b6d4" },
  agendado: { label: "Avaliação Agendada", color: "#eab308" },
  compareceu: { label: "Compareceu", color: "#8b5cf6" },
  fechado: { label: "Fechado", color: "#22c55e" },
};

const TEMP_OPTIONS = [
  { value: "all", label: "Todas temperaturas" },
  { value: "hot", label: "Quente" },
  { value: "warm", label: "Morno" },
  { value: "cold", label: "Frio" },
];

const STAGE_OPTIONS = [
  { value: "all", label: "Todas etapas" },
  { value: "novo", label: "Novo Lead" },
  { value: "contato", label: "Contato Feito" },
  { value: "agendado", label: "Avaliação Agendada" },
  { value: "compareceu", label: "Compareceu" },
  { value: "fechado", label: "Fechado" },
];

// ─── Types ───────────────────────────────────────────────────

interface ContactFormData {
  name: string;
  phone: string;
  email: string;
  procedure_interest: string;
  temperature: TemperatureValue;
  kanban_stage: KanbanStageKey;
  notes: string;
  tags: string[];
}

const EMPTY_FORM: ContactFormData = {
  name: "",
  phone: "",
  email: "",
  procedure_interest: "",
  temperature: "cold",
  kanban_stage: "novo",
  notes: "",
  tags: [],
};

function toForm(c: ContactRow): ContactFormData {
  return {
    name: c.name ?? "",
    phone: c.phone ?? "",
    email: c.email ?? "",
    procedure_interest: c.procedure_interest ?? "",
    temperature: (c.temperature as TemperatureValue) ?? "cold",
    kanban_stage: (c.kanban_stage as KanbanStageKey) ?? "novo",
    notes: c.notes ?? "",
    tags: c.tags ?? [],
  };
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

// ─── ContatosClient ─────────────────────────────────────────

interface ContatosClientProps {
  initialContacts: ContactRow[];
  workspaceId: string;
}

export function ContatosClient({ initialContacts, workspaceId }: ContatosClientProps) {
  const supabase = useMemo(() => createClient(), []);

  // ── List state ──────────────────────────────────────────
  const [contacts, setContacts] = useState<ContactRow[]>(initialContacts);
  const [isLoading, setIsLoading] = useState(false);
  const [offset, setOffset] = useState(initialContacts.length);
  const [hasMore, setHasMore] = useState(initialContacts.length === LIMIT);

  // ── Filters / sort ──────────────────────────────────────
  const [search, setSearch] = useState("");
  const [filterTemp, setFilterTemp] = useState("all");
  const [filterStage, setFilterStage] = useState("all");
  const [sortBy, setSortBy] = useState<"created_at" | "name">("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // ── Drawer state ─────────────────────────────────────────
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<"create" | "edit">("create");
  const [drawerContact, setDrawerContact] = useState<ContactRow | null>(null);
  const [form, setForm] = useState<ContactFormData>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isFirstRender = useRef(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── queryKey triggers refetch when any filter/sort changes ─
  const queryKey = useMemo(
    () => ({ search, filterTemp, filterStage, sortBy, sortDir }),
    [search, filterTemp, filterStage, sortBy, sortDir]
  );

  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runQuery(0, true), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey]);

  // ── Escape key closes drawer ─────────────────────────────
  useEffect(() => {
    if (!drawerOpen) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") closeDrawer(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  // ── Core query ───────────────────────────────────────────

  async function runQuery(off: number, reset: boolean) {
    setIsLoading(true);
    /* eslint-disable @typescript-eslint/no-explicit-any */
    let q = (supabase as any)
      .from("contacts")
      .select(CONTACT_FIELDS)
      .order(sortBy, { ascending: sortDir === "asc" })
      .range(off, off + LIMIT - 1);

    const s = search.trim();
    if (s) q = q.or(`name.ilike.%${s}%,phone.ilike.%${s}%,email.ilike.%${s}%`);
    if (filterTemp !== "all") q = q.eq("temperature", filterTemp);
    if (filterStage !== "all") q = q.eq("kanban_stage", filterStage);

    const { data, error } = await q;
    setIsLoading(false);

    if (error) { toast.error("Erro ao carregar contatos"); return; }
    const rows = (data ?? []) as ContactRow[];
    if (reset) {
      setContacts(rows);
      setOffset(rows.length);
    } else {
      setContacts((prev) => [...prev, ...rows]);
      setOffset((prev) => prev + rows.length);
    }
    setHasMore(rows.length === LIMIT);
  }

  function handleLoadMore() { runQuery(offset, false); }

  // ── Sort ─────────────────────────────────────────────────

  function handleSort(col: "created_at" | "name") {
    if (sortBy === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortBy(col); setSortDir(col === "created_at" ? "desc" : "asc"); }
  }

  // ── Drawer helpers ────────────────────────────────────────

  function openCreate() {
    setDrawerMode("create");
    setDrawerContact(null);
    setForm(EMPTY_FORM);
    setConfirmDelete(false);
    setDrawerOpen(true);
  }

  function openEdit(c: ContactRow) {
    setDrawerMode("edit");
    setDrawerContact(c);
    setForm(toForm(c));
    setConfirmDelete(false);
    setDrawerOpen(true);
  }

  function closeDrawer() {
    setDrawerOpen(false);
    setTimeout(() => setConfirmDelete(false), 200);
  }

  function updateField<K extends keyof ContactFormData>(k: K, v: ContactFormData[K]) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  // ── Save ─────────────────────────────────────────────────

  async function handleSave() {
    if (!form.name.trim()) { toast.error("Nome é obrigatório"); return; }

    setIsSaving(true);
    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      procedure_interest: form.procedure_interest.trim() || null,
      temperature: form.temperature,
      kanban_stage: form.kanban_stage,
      notes: form.notes.trim() || null,
      tags: form.tags.length > 0 ? form.tags : null,
      updated_at: new Date().toISOString(),
    };

    if (drawerMode === "create") {
      const { data, error } = await supabase
        .from("contacts")
        .insert({ ...payload, workspace_id: workspaceId, source: "manual" })
        .select(CONTACT_FIELDS)
        .single();
      setIsSaving(false);
      if (error) { toast.error("Erro ao criar contato"); return; }
      setContacts((prev) => [data as ContactRow, ...prev]);
      closeDrawer();
      toast.success("Contato criado");
    } else if (drawerContact) {
      const old = drawerContact;
      setContacts((prev) => prev.map((c) => (c.id === old.id ? { ...c, ...payload } as ContactRow : c)));

      const { data, error } = await supabase
        .from("contacts")
        .update(payload)
        .eq("id", old.id)
        .select(CONTACT_FIELDS)
        .single();
      setIsSaving(false);
      if (error) {
        setContacts((prev) => prev.map((c) => (c.id === old.id ? old : c)));
        toast.error("Erro ao salvar contato");
        return;
      }
      setContacts((prev) => prev.map((c) => (c.id === old.id ? data as ContactRow : c)));
      setDrawerContact(data as ContactRow);
      toast.success("Contato salvo");
    }
  }

  // ── Delete ────────────────────────────────────────────────

  async function handleDelete() {
    if (!drawerContact) return;
    setIsDeleting(true);
    const { error } = await supabase.from("contacts").delete().eq("id", drawerContact.id);
    setIsDeleting(false);
    if (error) {
      setConfirmDelete(false);
      if (error.code === "23503") {
        toast.error("Este contato tem conversas vinculadas e não pode ser excluído.", { duration: 6000 });
      } else {
        toast.error("Erro ao excluir contato");
      }
      return;
    }
    setContacts((prev) => prev.filter((c) => c.id !== drawerContact.id));
    closeDrawer();
    toast.success("Contato excluído");
  }

  // ── Render ────────────────────────────────────────────────

  const hasActiveFilters = filterTemp !== "all" || filterStage !== "all" || search.trim() !== "";

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#0D0B0B]">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-5 h-[57px] border-b border-white/7">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-foreground">Contatos</span>
          <span className="text-[11px] font-mono text-muted-foreground/45">
            {contacts.length}{hasMore ? "+" : ""} paciente{contacts.length !== 1 ? "s" : ""}
          </span>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary/15 text-primary hover:bg-primary/20 border border-primary/25 transition-colors duration-75"
        >
          <Plus className="h-3.5 w-3.5" />
          Novo contato
        </button>
      </div>

      {/* Search + filters */}
      <div className="shrink-0 flex flex-wrap items-center gap-2 px-4 py-3 border-b border-white/7">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar por nome, telefone ou email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#161210] text-sm pl-9 pr-4 py-2 rounded-lg border border-white/7 text-foreground placeholder:text-muted-foreground/35 focus:outline-none focus:border-primary/35 transition-colors duration-75"
          />
        </div>
        <FilterSelect value={filterTemp} onChange={setFilterTemp} options={TEMP_OPTIONS} />
        <FilterSelect value={filterStage} onChange={setFilterStage} options={STAGE_OPTIONS} />
        {hasActiveFilters && (
          <button
            onClick={() => { setSearch(""); setFilterTemp("all"); setFilterStage("all"); }}
            className="flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs text-muted-foreground/60 hover:text-foreground hover:bg-white/5 border border-white/7 transition-colors duration-75"
          >
            <X className="h-3 w-3" />
            Limpar
          </button>
        )}
      </div>

      {/* Table area */}
      <div className="flex-1 overflow-auto">
        {isLoading && contacts.length === 0 ? (
          <SkeletonTable />
        ) : contacts.length === 0 ? (
          <EmptyState search={search} onNew={openCreate} />
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 z-10 bg-[#0D0B0B]">
              <tr className="border-b border-white/7">
                <SortHeader label="Nome" col="name" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} className="pl-5 w-[220px]" />
                <th className="py-3 px-4 text-left text-xs font-medium text-muted-foreground/50 whitespace-nowrap">Telefone</th>
                <th className="py-3 px-4 text-left text-xs font-medium text-muted-foreground/50 whitespace-nowrap hidden md:table-cell">Email</th>
                <th className="py-3 px-4 text-left text-xs font-medium text-muted-foreground/50 whitespace-nowrap">Temp.</th>
                <th className="py-3 px-4 text-left text-xs font-medium text-muted-foreground/50 whitespace-nowrap hidden lg:table-cell">Etapa</th>
                <th className="py-3 px-4 text-left text-xs font-medium text-muted-foreground/50 whitespace-nowrap hidden xl:table-cell">Procedimento</th>
                <SortHeader label="Cadastro" col="created_at" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} className="pr-5 w-[90px]" />
              </tr>
            </thead>
            <tbody>
              {contacts.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => openEdit(c)}
                  className="border-b border-white/4 hover:bg-[#1C1917] cursor-pointer transition-colors duration-75 group"
                >
                  <td className="py-3 pl-5 pr-4">
                    <div className="flex items-center gap-2.5">
                      <div className="h-7 w-7 rounded-full bg-primary/12 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
                        {c.name.slice(0, 2).toUpperCase()}
                      </div>
                      <span className="font-medium text-foreground/90 truncate max-w-[140px]">{c.name}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-xs font-mono text-muted-foreground/60 whitespace-nowrap">
                    {c.phone ?? <span className="text-muted-foreground/25">—</span>}
                  </td>
                  <td className="py-3 px-4 text-xs text-muted-foreground/60 hidden md:table-cell max-w-[160px] truncate">
                    {c.email ?? <span className="text-muted-foreground/25">—</span>}
                  </td>
                  <td className="py-3 px-4">
                    {c.temperature && TEMP_CONFIG[c.temperature] ? (
                      <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full", TEMP_CONFIG[c.temperature].cls)}>
                        {TEMP_CONFIG[c.temperature].label}
                      </span>
                    ) : <span className="text-muted-foreground/25 text-xs">—</span>}
                  </td>
                  <td className="py-3 px-4 hidden lg:table-cell">
                    {c.kanban_stage && STAGE_CONFIG[c.kanban_stage] ? (
                      <span className="text-[10px] font-medium" style={{ color: STAGE_CONFIG[c.kanban_stage].color }}>
                        {STAGE_CONFIG[c.kanban_stage].label}
                      </span>
                    ) : <span className="text-muted-foreground/25 text-xs">—</span>}
                  </td>
                  <td className="py-3 px-4 text-xs text-muted-foreground/55 hidden xl:table-cell max-w-[140px] truncate">
                    {c.procedure_interest ?? <span className="text-muted-foreground/25">—</span>}
                  </td>
                  <td className="py-3 px-4 pr-5 text-[11px] font-mono text-muted-foreground/40 whitespace-nowrap">
                    {fmtDate(c.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Load more */}
        {hasMore && contacts.length > 0 && (
          <div className="flex justify-center py-6">
            <button
              onClick={handleLoadMore}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-muted-foreground/60 hover:text-foreground hover:bg-white/5 border border-white/7 transition-colors duration-75 disabled:opacity-40"
            >
              {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Carregar mais
            </button>
          </div>
        )}
      </div>

      {/* Drawer */}
      <ContactDrawer
        open={drawerOpen}
        mode={drawerMode}
        contact={drawerContact}
        form={form}
        isSaving={isSaving}
        isDeleting={isDeleting}
        confirmDelete={confirmDelete}
        onClose={closeDrawer}
        onUpdateField={updateField}
        onSave={handleSave}
        onDelete={handleDelete}
        onSetConfirmDelete={setConfirmDelete}
      />
    </div>
  );
}

// ─── FilterSelect ─────────────────────────────────────────────

function FilterSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-[#161210] text-xs px-3 py-2 rounded-lg border border-white/7 text-muted-foreground/70 focus:outline-none focus:border-primary/35 transition-colors duration-75 cursor-pointer"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

// ─── SortHeader ───────────────────────────────────────────────

function SortHeader({
  label,
  col,
  sortBy,
  sortDir,
  onSort,
  className,
}: {
  label: string;
  col: "created_at" | "name";
  sortBy: string;
  sortDir: "asc" | "desc";
  onSort: (col: "created_at" | "name") => void;
  className?: string;
}) {
  const active = sortBy === col;
  return (
    <th className={cn("py-3 px-4 text-left whitespace-nowrap", className)}>
      <button
        onClick={() => onSort(col)}
        className="flex items-center gap-1 text-xs font-medium text-muted-foreground/50 hover:text-foreground/70 transition-colors duration-75"
      >
        {label}
        {active ? (
          sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronsUpDown className="h-3 w-3 opacity-40" />
        )}
      </button>
    </th>
  );
}

// ─── SkeletonTable ────────────────────────────────────────────

function SkeletonTable() {
  return (
    <div className="p-5 space-y-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex gap-4 items-center py-2 animate-pulse">
          <div className="h-7 w-7 rounded-full bg-white/6 shrink-0" />
          <div className="h-3 bg-white/6 rounded w-32" />
          <div className="h-3 bg-white/4 rounded w-24 hidden md:block" />
          <div className="h-3 bg-white/4 rounded w-28 hidden md:block" />
          <div className="h-4 bg-white/5 rounded-full w-14" />
          <div className="h-3 bg-white/4 rounded w-20 hidden lg:block" />
          <div className="h-3 bg-white/4 rounded w-16 ml-auto" />
        </div>
      ))}
    </div>
  );
}

// ─── EmptyState ───────────────────────────────────────────────

function EmptyState({ search, onNew }: { search: string; onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-center px-8">
      <div className="h-14 w-14 rounded-2xl bg-[#1E1916] border border-white/5 flex items-center justify-center mb-4">
        <User className="h-6 w-6 text-primary/30" />
      </div>
      <p className="text-sm font-medium text-foreground/60 mb-1">
        {search ? `Nenhum resultado para "${search}"` : "Nenhum contato ainda"}
      </p>
      <p className="text-xs text-muted-foreground/35 mb-4">
        {search ? "Tente outros termos ou limpe o filtro" : "Adicione o primeiro contato manualmente"}
      </p>
      {!search && (
        <button
          onClick={onNew}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary/15 text-primary hover:bg-primary/20 border border-primary/25 transition-colors duration-75"
        >
          <Plus className="h-3.5 w-3.5" />
          Novo contato
        </button>
      )}
    </div>
  );
}

// ─── ContactDrawer ────────────────────────────────────────────

interface ContactDrawerProps {
  open: boolean;
  mode: "create" | "edit";
  contact: ContactRow | null;
  form: ContactFormData;
  isSaving: boolean;
  isDeleting: boolean;
  confirmDelete: boolean;
  onClose: () => void;
  onUpdateField: <K extends keyof ContactFormData>(k: K, v: ContactFormData[K]) => void;
  onSave: () => void;
  onDelete: () => void;
  onSetConfirmDelete: (v: boolean) => void;
}

function ContactDrawer({
  open,
  mode,
  contact,
  form,
  isSaving,
  isDeleting,
  confirmDelete,
  onClose,
  onUpdateField,
  onSave,
  onDelete,
  onSetConfirmDelete,
}: ContactDrawerProps) {
  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-40 bg-black/55 backdrop-blur-sm transition-opacity duration-200",
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      />

      {/* Panel */}
      <div
        className={cn(
          "fixed right-0 top-0 bottom-0 z-50 w-full sm:w-[420px] flex flex-col bg-[#131110] border-l border-white/8 transition-transform duration-200 ease-out",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Drawer header */}
        <div className="shrink-0 flex items-center justify-between px-5 h-[57px] border-b border-white/7">
          <span className="text-sm font-semibold text-foreground">
            {mode === "create" ? "Novo contato" : "Editar contato"}
          </span>
          <button
            onClick={onClose}
            className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground/60 hover:text-foreground hover:bg-white/5 transition-colors duration-75"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 scrollbar-none">
          {/* Nome */}
          <Field label="Nome" required>
            <input
              value={form.name}
              onChange={(e) => onUpdateField("name", e.target.value)}
              placeholder="Nome completo"
              className={inputCls}
            />
          </Field>

          {/* Telefone + Email em linha */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Telefone">
              <input
                value={form.phone}
                onChange={(e) => onUpdateField("phone", e.target.value)}
                placeholder="+55 00 00000-0000"
                className={inputCls}
              />
            </Field>
            <Field label="Email">
              <input
                type="email"
                value={form.email}
                onChange={(e) => onUpdateField("email", e.target.value)}
                placeholder="email@exemplo.com"
                className={inputCls}
              />
            </Field>
          </div>

          {/* Procedimento */}
          <Field label="Procedimento de interesse">
            <input
              value={form.procedure_interest}
              onChange={(e) => onUpdateField("procedure_interest", e.target.value)}
              placeholder="Ex: Implante, Clareamento…"
              className={inputCls}
            />
          </Field>

          {/* Temperatura + Etapa em linha */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Temperatura">
              <select
                value={form.temperature}
                onChange={(e) => onUpdateField("temperature", e.target.value as TemperatureValue)}
                className={selectCls}
              >
                <option value="hot">Quente</option>
                <option value="warm">Morno</option>
                <option value="cold">Frio</option>
              </select>
            </Field>
            <Field label="Etapa">
              <select
                value={form.kanban_stage}
                onChange={(e) => onUpdateField("kanban_stage", e.target.value as KanbanStageKey)}
                className={selectCls}
              >
                <option value="novo">Novo Lead</option>
                <option value="contato">Contato Feito</option>
                <option value="agendado">Avaliação Agendada</option>
                <option value="compareceu">Compareceu</option>
                <option value="fechado">Fechado</option>
              </select>
            </Field>
          </div>

          {/* Notas */}
          <Field label="Notas">
            <textarea
              value={form.notes}
              onChange={(e) => onUpdateField("notes", e.target.value)}
              placeholder="Observações sobre o paciente…"
              rows={3}
              className={cn(inputCls, "resize-none leading-relaxed")}
            />
          </Field>

          {/* Tags */}
          <Field label="Tags">
            <TagInput tags={form.tags} onChange={(t) => onUpdateField("tags", t)} />
          </Field>

          {/* Metadados (somente leitura, modo edição) */}
          {mode === "edit" && contact && (
            <div className="pt-4 mt-2 border-t border-white/7 space-y-2.5">
              <MetaRow label="Fonte" value={contact.source ?? "—"} />
              {contact.whatsapp_chat_id && (
                <MetaRow label="WhatsApp ID" value={contact.whatsapp_chat_id} mono />
              )}
              <MetaRow
                label="Cadastrado em"
                value={new Date(contact.created_at).toLocaleString("pt-BR")}
              />

              {/* Link para conversa */}
              <a
                href={`/conversas?contact=${contact.id}`}
                className="mt-1 flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-muted-foreground/60 hover:text-foreground hover:bg-white/5 border border-white/7 transition-colors duration-75 w-fit"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                Ver conversa no WhatsApp
              </a>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 p-5 border-t border-white/7 space-y-3">
          {/* Save */}
          <button
            onClick={onSave}
            disabled={isSaving}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-primary text-white hover:bg-primary/90 transition-colors duration-75 disabled:opacity-50"
          >
            {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {mode === "create" ? "Criar contato" : "Salvar alterações"}
          </button>

          {/* Delete (edit mode only) */}
          {mode === "edit" && (
            confirmDelete ? (
              <div className="flex gap-2">
                <button
                  onClick={onDelete}
                  disabled={isDeleting}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/25 transition-colors duration-75 disabled:opacity-50"
                >
                  {isDeleting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Confirmar exclusão
                </button>
                <button
                  onClick={() => onSetConfirmDelete(false)}
                  className="px-4 py-2 rounded-lg text-sm text-muted-foreground/60 hover:text-foreground hover:bg-white/5 border border-white/7 transition-colors duration-75"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                onClick={() => onSetConfirmDelete(true)}
                className="w-full px-4 py-2 rounded-lg text-sm text-muted-foreground/45 hover:text-red-400 hover:bg-red-500/8 border border-white/6 hover:border-red-500/20 transition-colors duration-75"
              >
                Excluir contato
              </button>
            )
          )}
        </div>
      </div>
    </>
  );
}

// ─── TagInput ─────────────────────────────────────────────────

function TagInput({ tags, onChange }: { tags: string[]; onChange: (t: string[]) => void }) {
  const [input, setInput] = useState("");

  function commit() {
    const v = input.trim().replace(/,+$/, "");
    if (v && !tags.includes(v)) onChange([...tags, v]);
    setInput("");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); commit(); }
    else if (e.key === "Backspace" && input === "" && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  }

  return (
    <div className="flex flex-wrap gap-1.5 min-h-[38px] bg-[#1C1917] border border-white/8 rounded-lg px-3 py-2 focus-within:border-primary/30 transition-colors duration-75">
      {tags.map((tag) => (
        <span key={tag} className="flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-md bg-white/8 text-muted-foreground/70 border border-white/8">
          {tag}
          <button
            type="button"
            onClick={() => onChange(tags.filter((t) => t !== tag))}
            className="text-muted-foreground/40 hover:text-muted-foreground/80 transition-colors"
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </span>
      ))}
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={commit}
        placeholder={tags.length === 0 ? "Adicionar tag… (Enter ou vírgula)" : ""}
        className="flex-1 min-w-[120px] bg-transparent text-xs text-foreground placeholder:text-muted-foreground/30 outline-none"
      />
    </div>
  );
}

// ─── Small helpers ─────────────────────────────────────────────

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground/60">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

function MetaRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-[11px] text-muted-foreground/40 w-24 shrink-0">{label}</span>
      <span className={cn("text-[11px] text-muted-foreground/60", mono && "font-mono")}>{value}</span>
    </div>
  );
}

const inputCls =
  "w-full bg-[#1C1917] border border-white/8 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary/30 transition-colors duration-75";

const selectCls =
  "w-full bg-[#1C1917] border border-white/8 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary/30 transition-colors duration-75 cursor-pointer";
