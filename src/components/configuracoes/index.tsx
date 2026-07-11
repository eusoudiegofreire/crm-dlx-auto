"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import {
  Building2,
  Phone,
  Palette,
  Shield,
  Loader2,
  ImageIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface WorkspaceRow {
  id: string;
  name: string;
  slug: string | null;
  logo_url: string | null;
  primary_color: string | null;
  whatsapp_number: string | null;
  plan: string | null;
  created_at: string;
}

interface FormData {
  name: string;
  whatsapp_number: string;
  primary_color: string;
  logo_url: string;
}

// ─── Config ────────────────────────────────────────────────────────────────────

const TABS = [
  { key: "clinica", label: "Dados da Clínica", active: true },
  { key: "sofia", label: "Sofia / IA", active: false },
  { key: "equipe", label: "Equipe", active: false },
  { key: "apikeys", label: "API Keys", active: false },
] as const;

const PLAN_LABELS: Record<string, { label: string; cls: string }> = {
  free: {
    label: "Gratuito",
    cls: "bg-white/8 text-white/50 border border-white/10",
  },
  starter: {
    label: "Starter",
    cls: "bg-blue-500/15 text-blue-400 border border-blue-500/20",
  },
  pro: {
    label: "Pro",
    cls: "bg-primary/15 text-primary border border-primary/25",
  },
  enterprise: {
    label: "Enterprise",
    cls: "bg-purple-500/15 text-purple-400 border border-purple-500/20",
  },
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function isValidHex(h: string): boolean {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(h);
}

function toColorInputValue(hex: string): string {
  if (/^#[0-9a-fA-F]{3}$/.test(hex)) {
    const r = hex[1];
    const g = hex[2];
    const b = hex[3];
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  if (/^#[0-9a-fA-F]{6}$/.test(hex)) return hex;
  return "#E84C1F";
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function toForm(w: WorkspaceRow): FormData {
  return {
    name: w.name ?? "",
    whatsapp_number: w.whatsapp_number ?? "",
    primary_color: w.primary_color ?? "#E84C1F",
    logo_url: w.logo_url ?? "",
  };
}

// ─── ConfiguracoesClient ───────────────────────────────────────────────────────

interface ConfiguracoesClientProps {
  initialWorkspace: WorkspaceRow | null;
}

export function ConfiguracoesClient({
  initialWorkspace,
}: ConfiguracoesClientProps) {
  const supabase = useMemo(() => createClient(), []);
  const [activeTab, setActiveTab] = useState<string>("clinica");

  const [workspace, setWorkspace] = useState<WorkspaceRow | null>(
    initialWorkspace
  );
  const [form, setForm] = useState<FormData>(
    initialWorkspace
      ? toForm(initialWorkspace)
      : { name: "", whatsapp_number: "", primary_color: "#E84C1F", logo_url: "" }
  );
  const [isSaving, setIsSaving] = useState(false);
  const [logoError, setLogoError] = useState(false);

  const prevLogoUrl = useRef(form.logo_url);
  useEffect(() => {
    if (form.logo_url !== prevLogoUrl.current) {
      setLogoError(false);
      prevLogoUrl.current = form.logo_url;
    }
  }, [form.logo_url]);

  // ── Dirty state ─────────────────────────────────────────────────────────────
  const isDirty = useMemo(() => {
    if (!workspace) return false;
    const orig = toForm(workspace);
    return (
      form.name !== orig.name ||
      form.whatsapp_number !== orig.whatsapp_number ||
      form.primary_color !== orig.primary_color ||
      form.logo_url !== orig.logo_url
    );
  }, [form, workspace]);

  function updateField<K extends keyof FormData>(k: K, v: FormData[K]) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  // ── Validation ──────────────────────────────────────────────────────────────
  function validate(): string | null {
    if (!form.name.trim()) return "Nome da clínica é obrigatório";
    if (form.primary_color && !isValidHex(form.primary_color))
      return "Cor primária deve ser um hex válido (ex: #E84C1F)";
    if (form.whatsapp_number.trim()) {
      const digits = form.whatsapp_number.replace(/\D/g, "");
      if (digits.length < 10 || digits.length > 15)
        return "Número de WhatsApp inválido (10–15 dígitos)";
    }
    return null;
  }

  // ── Save ─────────────────────────────────────────────────────────────────────
  async function handleSave() {
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    if (!workspace) return;

    setIsSaving(true);
    const oldWorkspace = workspace;

    const patch = {
      name: form.name.trim(),
      whatsapp_number: form.whatsapp_number.trim() || null,
      primary_color: isValidHex(form.primary_color) ? form.primary_color : null,
      logo_url: form.logo_url.trim() || null,
    };

    // Optimistic update
    setWorkspace({ ...workspace, ...patch });

    const { error } = await supabase
      .from("workspaces")
      .update(patch)
      .eq("id", workspace.id);

    setIsSaving(false);

    if (error) {
      setWorkspace(oldWorkspace);
      setForm(toForm(oldWorkspace));
      toast.error("Erro ao salvar: " + error.message);
      return;
    }

    setWorkspace((prev) => (prev ? { ...prev, ...patch } : prev));
    toast.success("Configurações salvas");
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 overflow-y-auto bg-[#0D0B0B]">
      <div className="p-5 md:p-6 max-w-3xl mx-auto space-y-5">
        {/* Page header */}
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Configurações
          </h1>
          <p className="text-[13px] text-muted-foreground/45 mt-0.5">
            Gerencie as configurações da clínica
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-0.5 border-b border-white/7 -mx-1">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => tab.active && setActiveTab(tab.key)}
              disabled={!tab.active}
              className={cn(
                "relative px-4 py-2.5 text-[13px] font-medium transition-colors duration-75 rounded-t",
                activeTab === tab.key && tab.active
                  ? "text-foreground"
                  : tab.active
                  ? "text-muted-foreground/50 hover:text-muted-foreground/80"
                  : "text-muted-foreground/22 cursor-not-allowed"
              )}
            >
              {tab.label}
              {!tab.active && (
                <span className="ml-1.5 text-[9px] font-bold tracking-wide text-muted-foreground/22 align-middle">
                  EM BREVE
                </span>
              )}
              {activeTab === tab.key && tab.active && (
                <span className="absolute bottom-0 left-3 right-3 h-px bg-primary rounded-full" />
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === "clinica" &&
          (!workspace ? (
            <div className="bg-[#161311] border border-white/7 rounded-xl p-10 text-center">
              <p className="text-sm text-muted-foreground/40">
                Não foi possível carregar os dados do workspace.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Identidade */}
              <Section
                icon={<Building2 className="h-4 w-4" />}
                title="Identidade"
              >
                <Field label="Nome da clínica" required>
                  <input
                    value={form.name}
                    onChange={(e) => updateField("name", e.target.value)}
                    placeholder="Ex: Sorrir Odontologia"
                    className={inputCls}
                  />
                </Field>

                <Field label="Slug do workspace">
                  <div className="flex items-center gap-3">
                    <input
                      value={workspace.slug ?? ""}
                      readOnly
                      className={cn(
                        inputCls,
                        "opacity-40 cursor-not-allowed font-mono select-all"
                      )}
                    />
                    <span className="text-[11px] text-muted-foreground/30 whitespace-nowrap shrink-0">
                      Somente leitura
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground/30 mt-1">
                    Para alterar o slug, entre em contato com o suporte.
                  </p>
                </Field>

                <Field label="Logo da clínica">
                  <input
                    type="url"
                    value={form.logo_url}
                    onChange={(e) => updateField("logo_url", e.target.value)}
                    placeholder="https://exemplo.com/logo.png"
                    className={inputCls}
                  />
                  {form.logo_url && !logoError && (
                    <div className="flex items-center gap-3 mt-2.5">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={form.logo_url}
                        alt="Preview do logo"
                        onError={() => setLogoError(true)}
                        className="h-14 w-14 rounded-xl object-contain bg-[#1C1917] border border-white/8 p-1.5 shrink-0"
                      />
                      <p className="text-[11px] text-muted-foreground/35">
                        Preview do logo
                      </p>
                    </div>
                  )}
                  {form.logo_url && logoError && (
                    <div className="flex items-center gap-1.5 mt-2 text-[11px] text-amber-500/60">
                      <ImageIcon className="h-3.5 w-3.5 shrink-0" />
                      URL inválida ou imagem inacessível
                    </div>
                  )}
                  <p className="text-[11px] text-muted-foreground/30 mt-1.5">
                    Cole a URL pública da imagem.
                    {/* TODO: Upload direto de arquivo via Supabase Storage pode ser adicionado futuramente */}
                  </p>
                </Field>
              </Section>

              {/* Contato */}
              <Section icon={<Phone className="h-4 w-4" />} title="Contato">
                <Field label="Número do WhatsApp">
                  <input
                    value={form.whatsapp_number}
                    onChange={(e) =>
                      updateField("whatsapp_number", e.target.value)
                    }
                    placeholder="55 69 99999-9999"
                    className={cn(inputCls, "font-mono")}
                  />
                  <p className="text-[11px] text-muted-foreground/30 mt-1.5 leading-relaxed">
                    Este número é apenas referência no CRM. Alterar aqui{" "}
                    <strong className="font-semibold text-muted-foreground/45">
                      não
                    </strong>{" "}
                    reconfigura a conexão real do WhatsApp com o gateway — isso
                    é feito no painel do provedor.
                  </p>
                </Field>
              </Section>

              {/* Marca */}
              <Section icon={<Palette className="h-4 w-4" />} title="Marca">
                <Field label="Cor primária">
                  <div className="flex items-center gap-3">
                    {/* Color swatch that triggers the native picker */}
                    <label className="relative cursor-pointer shrink-0">
                      <input
                        type="color"
                        value={toColorInputValue(form.primary_color)}
                        onChange={(e) =>
                          updateField("primary_color", e.target.value)
                        }
                        className="sr-only"
                      />
                      <div
                        className="h-9 w-9 rounded-lg border-2 border-white/15 cursor-pointer shadow-md transition-transform duration-100 hover:scale-110 active:scale-95"
                        style={{
                          background: isValidHex(form.primary_color)
                            ? form.primary_color
                            : "#E84C1F",
                        }}
                      />
                    </label>

                    {/* Hex text input */}
                    <input
                      type="text"
                      value={form.primary_color}
                      onChange={(e) =>
                        updateField("primary_color", e.target.value.trim())
                      }
                      placeholder="#E84C1F"
                      maxLength={7}
                      spellCheck={false}
                      className={cn(inputCls, "font-mono w-32")}
                    />

                    {form.primary_color && !isValidHex(form.primary_color) && (
                      <span className="text-[11px] text-amber-500/60">
                        hex inválido
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground/30 mt-1.5">
                    A cor é salva no banco para uso futuro na personalização da
                    interface.
                    {/* TODO: Aplicar cor dinamicamente ao tema CSS quando suportado */}
                  </p>
                </Field>
              </Section>

              {/* Conta — read-only */}
              <Section icon={<Shield className="h-4 w-4" />} title="Conta">
                <div className="space-y-3.5">
                  <MetaRow label="Plano">
                    {(() => {
                      const key = workspace.plan ?? "free";
                      const cfg = PLAN_LABELS[key] ?? PLAN_LABELS.free;
                      return (
                        <span
                          className={cn(
                            "text-[11px] font-semibold px-2.5 py-1 rounded-full",
                            cfg.cls
                          )}
                        >
                          {cfg.label}
                        </span>
                      );
                    })()}
                  </MetaRow>

                  <MetaRow label="Cadastrado em">
                    <span className="text-[13px] text-muted-foreground/60">
                      {fmtDate(workspace.created_at)}
                    </span>
                  </MetaRow>
                </div>
              </Section>

              {/* Footer */}
              <div className="flex items-center justify-between pt-1 pb-6">
                <p
                  className={cn(
                    "text-[12px] text-amber-500/60 transition-opacity duration-200",
                    isDirty ? "opacity-100" : "opacity-0 pointer-events-none"
                  )}
                >
                  Você tem alterações não salvas
                </p>
                <button
                  onClick={handleSave}
                  disabled={!isDirty || isSaving}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium bg-primary text-white hover:bg-primary/90 transition-colors duration-75 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Salvar alterações
                </button>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

// ─── Section ───────────────────────────────────────────────────────────────────

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-[#161311] border border-white/7 rounded-xl p-5 space-y-4">
      <div className="flex items-center gap-2 pb-3 border-b border-white/5">
        <span className="text-primary/45">{icon}</span>
        <h3 className="text-[13px] font-semibold text-foreground/80">
          {title}
        </h3>
      </div>
      {children}
    </div>
  );
}

// ─── Field ─────────────────────────────────────────────────────────────────────

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground/60">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

// ─── MetaRow ───────────────────────────────────────────────────────────────────

function MetaRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs font-medium text-muted-foreground/45 w-28 shrink-0">
        {label}
      </span>
      {children}
    </div>
  );
}

// ─── Shared styles ──────────────────────────────────────────────────────────────

const inputCls =
  "w-full bg-[#1C1917] border border-white/8 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary/30 transition-colors duration-75";
