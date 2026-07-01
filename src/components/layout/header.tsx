"use client";

import { usePathname } from "next/navigation";
import { Menu, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logoutAction } from "@/app/actions/auth";

const PAGE_NAMES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/conversas": "Conversas",
  "/leads": "Leads",
  "/contatos": "Contatos",
  "/configuracoes": "Configurações",
};

// Estático por enquanto — virá do banco na tela de Configurações
const HERMES_ATIVO = true;

interface HeaderProps {
  onToggleSidebar: () => void;
}

export function Header({ onToggleSidebar }: HeaderProps) {
  const pathname = usePathname();
  const pageTitle = PAGE_NAMES[pathname] ?? "DLX Clinic";

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-4">
      {/* Esquerda: hamburger (mobile) + título da página */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="lg:hidden rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          aria-label="Abrir menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <h1 className="text-sm font-semibold text-foreground">{pageTitle}</h1>
      </div>

      {/* Direita: status Hermes + botão sair */}
      <div className="flex items-center gap-2">
        {/* Indicador Hermes */}
        <div className="flex items-center gap-1.5 rounded-full border border-border bg-muted/30 px-2.5 py-1">
          {HERMES_ATIVO ? (
            <>
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
              </span>
              <span className="text-xs text-muted-foreground">Hermes ativo</span>
            </>
          ) : (
            <>
              <span className="h-2 w-2 rounded-full bg-muted-foreground" />
              <span className="text-xs text-muted-foreground">Hermes pausado</span>
            </>
          )}
        </div>

        {/* Logout */}
        <form action={logoutAction}>
          <Button
            variant="ghost"
            size="sm"
            type="submit"
            className="h-8 gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline text-xs">Sair</span>
          </Button>
        </form>
      </div>
    </header>
  );
}
