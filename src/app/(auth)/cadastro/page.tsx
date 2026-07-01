"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Zap } from "lucide-react";
import { signupAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";

export default function CadastroPage() {
  const [state, action, pending] = useActionState(signupAction, null);

  return (
    <div className="w-full max-w-sm">
      {/* Logo */}
      <div className="mb-8 text-center">
        <div className="inline-flex items-center justify-center gap-2 mb-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
            <Zap className="h-5 w-5 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <span className="text-2xl font-black tracking-tight">
            DLX{" "}
            <span className="font-light text-muted-foreground">Clinic</span>
          </span>
        </div>
        <p className="text-sm text-muted-foreground">Configure sua clínica em segundos</p>
      </div>

      {/* Card */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-xl">
        <h1 className="mb-1 text-xl font-semibold">Criar conta</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Comece de graça, sem cartão de crédito
        </p>

        <form action={action} className="space-y-4">
          <div>
            <label htmlFor="clinicName" className="mb-1.5 block text-sm font-medium">
              Nome da clínica
            </label>
            <input
              id="clinicName"
              name="clinicName"
              type="text"
              required
              placeholder="Ex: Sorrir Odontologia"
              className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
            />
          </div>

          <div>
            <label htmlFor="fullName" className="mb-1.5 block text-sm font-medium">
              Seu nome completo
            </label>
            <input
              id="fullName"
              name="fullName"
              type="text"
              required
              placeholder="Ex: Ana Lima"
              className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
            />
          </div>

          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="seu@email.com"
              className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium">
              Senha
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              placeholder="Mínimo 6 caracteres"
              className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
            />
          </div>

          {state?.error && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {state.error}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Criando conta..." : "Criar conta gratuitamente"}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          Já tem conta?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
