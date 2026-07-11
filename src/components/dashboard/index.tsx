"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import {
  Users,
  MessageSquare,
  Flame,
  CheckCircle2,
  Bot,
  Percent,
  MessageCircle,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  AreaChart,
  Area,
  CartesianGrid,
  Legend,
} from "recharts";
import { cn } from "@/lib/utils";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface ContactForDash {
  id: string;
  kanban_stage: string | null;
  temperature: string | null;
  created_at: string;
}

interface ConvForDash {
  id: string;
  contact_id: string;
  status: string | null;
  unread_count: number;
  last_message_at: string | null;
  created_at: string;
  contacts: { id: string; name: string } | null;
}

interface MsgForDash {
  id: string;
  direction: string;
  sender: string;
  created_at: string;
}

interface DashboardClientProps {
  contacts: ContactForDash[];
  conversations: ConvForDash[];
  messages: MsgForDash[];
}

// ─── Config ────────────────────────────────────────────────────────────────────

const STAGES = [
  { key: "novo", label: "Novo Lead", color: "#3b82f6" },
  { key: "contato", label: "Contato Feito", color: "#06b6d4" },
  { key: "agendado", label: "Agendado", color: "#eab308" },
  { key: "compareceu", label: "Compareceu", color: "#8b5cf6" },
  { key: "fechado", label: "Fechado", color: "#22c55e" },
];

const TEMP_CFG = {
  hot: { label: "Quente", color: "#ef4444" },
  warm: { label: "Morno", color: "#f59e0b" },
  cold: { label: "Frio", color: "#3b82f6" },
};

const CHART_TOOLTIP_STYLE = {
  contentStyle: {
    background: "#1C1917",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "8px",
    fontSize: "12px",
    color: "#d6d3d1",
    boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
  },
  labelStyle: { color: "rgba(255,255,255,0.4)", marginBottom: 4 },
  cursor: { fill: "rgba(255,255,255,0.04)" },
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function relativeTime(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `há ${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  return `há ${days}d`;
}

function initials(name: string): string {
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

// ─── Chart mount guard (prevents SSR issues with ResponsiveContainer) ─────────

function ChartShell({
  height,
  children,
}: {
  height: number;
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted)
    return (
      <div
        style={{ height }}
        className="animate-pulse rounded-lg bg-white/3"
      />
    );
  return <>{children}</>;
}

// ─── Custom Tooltip ────────────────────────────────────────────────────────────

function DayTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { color: string; name: string; value: number }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1C1917] border border-white/8 rounded-lg px-3 py-2.5 text-xs shadow-xl">
      <p className="text-muted-foreground/50 mb-2">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="font-medium mb-0.5" style={{ color: p.color }}>
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export function DashboardClient({
  contacts,
  conversations,
  messages,
}: DashboardClientProps) {
  const weekAgo = useMemo(
    () => new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    []
  );

  // ── KPIs ─────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const total = contacts.length;
    const hot = contacts.filter((c) => c.temperature === "hot").length;
    const fechados = contacts.filter((c) => c.kanban_stage === "fechado").length;
    const newThisWeek = contacts.filter(
      (c) => new Date(c.created_at) >= weekAgo
    ).length;
    const activeConvs = conversations.filter(
      (c) => c.status !== "resolved" && c.status !== "closed"
    ).length;
    const hermesCount = messages.filter((m) => m.sender === "hermes").length;
    const convRate = total > 0 ? Math.round((fechados / total) * 100) : 0;

    return {
      total,
      hot,
      fechados,
      newThisWeek,
      activeConvs,
      hermesCount,
      convRate,
    };
  }, [contacts, conversations, messages, weekAgo]);

  // ── Funnel ───────────────────────────────────────────────────────────────
  const funnelData = useMemo(
    () =>
      STAGES.map((s) => ({
        ...s,
        count: contacts.filter((c) => c.kanban_stage === s.key).length,
      })),
    [contacts]
  );

  // ── Temperature ──────────────────────────────────────────────────────────
  const tempData = useMemo(
    () =>
      (Object.entries(TEMP_CFG) as [string, { label: string; color: string }][])
        .map(([key, cfg]) => ({
          ...cfg,
          key,
          value: contacts.filter((c) => c.temperature === key).length,
        }))
        .filter((d) => d.value > 0),
    [contacts]
  );

  // ── Messages chart (last 14 days) ─────────────────────────────────────
  const msgChartData = useMemo(() => {
    const days = Array.from({ length: 14 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (13 - i));
      return d.toISOString().split("T")[0];
    });
    return days.map((day) => ({
      date: day,
      label: `${day.slice(8)}/${day.slice(5, 7)}`,
      Paciente: messages.filter(
        (m) => m.created_at.startsWith(day) && m.direction === "inbound"
      ).length,
      Sofia: messages.filter(
        (m) => m.created_at.startsWith(day) && m.sender === "hermes"
      ).length,
    }));
  }, [messages]);

  const hasMessages = messages.length > 0;
  const hasTempData = tempData.length > 0;
  const hasFunnelData = funnelData.some((d) => d.count > 0);

  // ── Recent conversations ──────────────────────────────────────────────
  const recentConvs = conversations.slice(0, 8);

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 overflow-y-auto bg-[#0D0B0B]">
      <div className="p-5 md:p-6 space-y-5 max-w-[1400px] mx-auto">
        {/* Page header */}
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Dashboard
          </h1>
          <p className="text-[13px] text-muted-foreground/45 mt-0.5">
            Visão geral do atendimento da clínica
          </p>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
          <KpiCard
            label="Total de pacientes"
            value={kpis.total}
            icon={<Users className="h-4 w-4" />}
            trend={
              kpis.newThisWeek > 0
                ? `+${kpis.newThisWeek} esta semana`
                : undefined
            }
            highlight
          />
          <KpiCard
            label="Conversas ativas"
            value={kpis.activeConvs}
            icon={<MessageSquare className="h-4 w-4" />}
          />
          <KpiCard
            label="Leads quentes"
            value={kpis.hot}
            icon={<Flame className="h-4 w-4" />}
            accentColor="#ef4444"
          />
          <KpiCard
            label="Fechados"
            value={kpis.fechados}
            icon={<CheckCircle2 className="h-4 w-4" />}
            accentColor="#22c55e"
          />
          <KpiCard
            label="Msgs da Sofia (IA)"
            value={kpis.hermesCount}
            icon={<Bot className="h-4 w-4" />}
            accentColor="#E84C1F"
          />
          <KpiCard
            label="Taxa de conversão"
            value={`${kpis.convRate}%`}
            icon={<Percent className="h-4 w-4" />}
            accentColor={kpis.convRate >= 20 ? "#22c55e" : undefined}
          />
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Funnel */}
          <WidgetCard title="Funil de Leads" subtitle="Pacientes por etapa">
            {hasFunnelData ? (
              <ChartShell height={220}>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    data={funnelData}
                    layout="vertical"
                    margin={{ top: 4, right: 12, left: 4, bottom: 4 }}
                    barCategoryGap="28%"
                  >
                    <XAxis
                      type="number"
                      tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      allowDecimals={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="label"
                      width={102}
                      tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      {...CHART_TOOLTIP_STYLE}
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      formatter={(v: any) => [v, "Pacientes"]}
                    />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                      {funnelData.map((entry) => (
                        <Cell key={entry.key} fill={entry.color} fillOpacity={0.8} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartShell>
            ) : (
              <EmptyChart height={220} />
            )}
          </WidgetCard>

          {/* Temperature */}
          <WidgetCard title="Temperatura dos Leads" subtitle="Distribuição por interesse">
            {hasTempData ? (
              <ChartShell height={220}>
                <div className="flex items-center gap-6 h-[220px]">
                  <ResponsiveContainer width="55%" height="100%">
                    <PieChart>
                      <Pie
                        data={tempData}
                        dataKey="value"
                        nameKey="label"
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={88}
                        paddingAngle={3}
                        startAngle={90}
                        endAngle={450}
                      >
                        {tempData.map((entry) => (
                          <Cell
                            key={entry.key}
                            fill={entry.color}
                            fillOpacity={0.85}
                            stroke="transparent"
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        {...CHART_TOOLTIP_STYLE}
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        formatter={(v: any, name: any) => [v, name]}
                      />
                    </PieChart>
                  </ResponsiveContainer>

                  {/* Legend */}
                  <div className="flex flex-col gap-3">
                    {tempData.map((d) => (
                      <div key={d.key} className="flex items-center gap-2.5">
                        <div
                          className="h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ background: d.color }}
                        />
                        <div>
                          <p className="text-xs font-medium text-foreground/80">
                            {d.label}
                          </p>
                          <p className="text-[11px] text-muted-foreground/40">
                            {d.value} paciente{d.value !== 1 ? "s" : ""}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </ChartShell>
            ) : (
              <EmptyChart height={220} />
            )}
          </WidgetCard>
        </div>

        {/* Messages over time */}
        <WidgetCard
          title="Volume de Mensagens"
          subtitle="Últimos 14 dias — Pacientes vs Sofia (IA)"
        >
          {hasMessages ? (
            <ChartShell height={220}>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart
                  data={msgChartData}
                  margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="gradPaciente" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradSofia" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#E84C1F" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#E84C1F" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(255,255,255,0.05)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    interval={1}
                  />
                  <YAxis
                    tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip content={<DayTooltip />} />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    height={28}
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="Paciente"
                    stroke="#06b6d4"
                    strokeWidth={2}
                    fill="url(#gradPaciente)"
                    dot={false}
                    activeDot={{ r: 4, fill: "#06b6d4" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="Sofia"
                    stroke="#E84C1F"
                    strokeWidth={2}
                    fill="url(#gradSofia)"
                    dot={false}
                    activeDot={{ r: 4, fill: "#E84C1F" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartShell>
          ) : (
            <EmptyChart height={220} />
          )}
        </WidgetCard>

        {/* Recent activity */}
        <WidgetCard
          title="Atividade Recente"
          subtitle="Últimas conversas por data da mensagem"
        >
          {recentConvs.length === 0 ? (
            <EmptyChart height={120} label="Nenhuma conversa ainda" />
          ) : (
            <div className="divide-y divide-white/5">
              {recentConvs.map((conv) => {
                const name = conv.contacts?.name ?? "Desconhecido";
                return (
                  <Link
                    key={conv.id}
                    href={`/conversas?contact=${conv.contacts?.id ?? conv.contact_id}`}
                    className="flex items-center gap-3 py-3 px-1 hover:bg-white/3 rounded-lg transition-colors duration-75 group"
                  >
                    {/* Avatar */}
                    <div className="h-8 w-8 rounded-full bg-primary/12 flex items-center justify-center text-[11px] font-bold text-primary shrink-0">
                      {initials(name)}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground/80 truncate">
                        {name}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {conv.unread_count > 0 && (
                          <span className="flex items-center gap-1 text-[10px] text-primary/70">
                            <MessageCircle className="h-3 w-3" />
                            {conv.unread_count} não lida{conv.unread_count !== 1 ? "s" : ""}
                          </span>
                        )}
                        <span className="text-[11px] text-muted-foreground/35">
                          {relativeTime(conv.last_message_at)}
                        </span>
                      </div>
                    </div>

                    {/* Status dot */}
                    <div
                      className={cn(
                        "h-2 w-2 rounded-full shrink-0",
                        conv.status === "resolved" || conv.status === "closed"
                          ? "bg-white/15"
                          : "bg-[#22c55e]"
                      )}
                    />
                  </Link>
                );
              })}
            </div>
          )}
        </WidgetCard>
      </div>
    </div>
  );
}

// ─── KpiCard ──────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  icon,
  trend,
  highlight,
  accentColor,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: string;
  highlight?: boolean;
  accentColor?: string;
}) {
  const valueColor = accentColor ?? (highlight ? "#E84C1F" : "#fafaf9");
  return (
    <div className="bg-[#161311] border border-white/7 rounded-xl p-4 flex flex-col gap-2.5 hover:border-white/10 transition-colors duration-150">
      <div className="flex items-start justify-between">
        <span className="text-[11px] font-medium text-muted-foreground/50 leading-snug">
          {label}
        </span>
        <div className="h-6 w-6 rounded-md bg-[#1E1916] flex items-center justify-center text-muted-foreground/35 shrink-0">
          {icon}
        </div>
      </div>
      <span
        className="text-[2rem] font-extrabold tracking-tight leading-none"
        style={{ color: valueColor }}
      >
        {value}
      </span>
      {trend && (
        <span className="text-[11px] text-muted-foreground/35">{trend}</span>
      )}
    </div>
  );
}

// ─── WidgetCard ───────────────────────────────────────────────────────────────

function WidgetCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-[#161311] border border-white/7 rounded-xl p-5">
      <div className="mb-4">
        <h2 className="text-[13px] font-semibold text-foreground/80">{title}</h2>
        {subtitle && (
          <p className="text-[11px] text-muted-foreground/35 mt-0.5">{subtitle}</p>
        )}
      </div>
      {children}
    </div>
  );
}

// ─── EmptyChart ───────────────────────────────────────────────────────────────

function EmptyChart({
  height,
  label = "Sem dados suficientes ainda",
}: {
  height: number;
  label?: string;
}) {
  return (
    <div
      className="flex items-center justify-center rounded-lg border border-dashed border-white/8"
      style={{ height }}
    >
      <p className="text-xs text-muted-foreground/30">{label}</p>
    </div>
  );
}
