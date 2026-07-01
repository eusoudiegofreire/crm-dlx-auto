"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  MessageSquare,
  TrendingUp,
  Users,
  Settings,
  X,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Conversas", href: "/conversas", icon: MessageSquare },
  { label: "Leads", href: "/leads", icon: TrendingUp },
  { label: "Contatos", href: "/contatos", icon: Users },
  { label: "Configurações", href: "/configuracoes", icon: Settings },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  clinicName: string;
  userInitials: string;
}

export function Sidebar({ isOpen, onClose, clinicName, userInitials }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-30 flex w-64 flex-col bg-sidebar border-r border-sidebar-border transition-transform duration-200 ease-in-out lg:relative lg:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}
    >
      {/* Logo */}
      <div className="flex h-14 shrink-0 items-center justify-between px-4 border-b border-sidebar-border">
        <Link href="/dashboard" className="flex items-center gap-2.5" onClick={onClose}>
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
            <Zap className="h-3.5 w-3.5 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <span className="text-sm font-bold tracking-tight text-sidebar-foreground">
            DLX{" "}
            <span className="font-normal text-muted-foreground">Clinic</span>
          </span>
        </Link>
        <button
          onClick={onClose}
          className="lg:hidden rounded-md p-1 text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
          aria-label="Fechar menu"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Nav items */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <Icon
                className={cn("h-4 w-4 shrink-0", isActive && "text-primary")}
              />
              {item.label}
              {/* Badge de notificação — placeholder para Conversas */}
              {item.href === "/conversas" && (
                <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                  0
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Rodapé com info da clínica */}
      <div className="shrink-0 border-t border-sidebar-border p-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
            {userInitials}
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-sidebar-foreground">
              {clinicName}
            </p>
            <p className="text-[11px] text-muted-foreground">Proprietário</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
