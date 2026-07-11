export type KanbanStageKey =
  | "novo"
  | "contato"
  | "agendado"
  | "compareceu"
  | "fechado";

export type TemperatureValue = "hot" | "warm" | "cold";

export interface ContactRow {
  id: string;
  workspace_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  whatsapp_chat_id: string | null;
  kanban_stage: KanbanStageKey | null;
  temperature: TemperatureValue | null;
  procedure_interest: string | null;
  tags: string[] | null;
  notes: string | null;
  source: string | null;
  created_at: string;
  updated_at: string;
}
