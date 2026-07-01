export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar — será implementada no PASSO 4 */}
      <aside className="w-64 shrink-0 border-r border-border bg-sidebar" />
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header — será implementado no PASSO 4 */}
        <header className="h-14 shrink-0 border-b border-border" />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
