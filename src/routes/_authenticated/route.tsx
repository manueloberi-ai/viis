import {
  createFileRoute,
  Outlet,
  redirect,
  Link,
  useRouter,
  useRouterState,
} from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  LayoutDashboard,
  Boxes,
  LayoutGrid,
  BarChart3,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
  ReceiptText,
  Megaphone,
  Images,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthLayout,
});

const NAV = [
  { to: "/home" as const,                  label: "Home",                   icon: LayoutDashboard },
  { to: "/inventory" as const,             label: "Inventory",              icon: Boxes },
  { to: "/annunci" as const,               label: "Annunci",                icon: Megaphone },
  { to: "/galleria-foto" as const,         label: "Galleria foto",          icon: Images },
  { to: "/platforms" as const,             label: "Piattaforme",            icon: LayoutGrid },
  { to: "/reports" as const,               label: "Reports",                icon: BarChart3 },
  { to: "/registro-corrispettivi" as const, label: "Registro Corrispettivi", icon: ReceiptText },
  // /audit-log: route conservata, link rimosso dal menu (l'audit log lavora sotto il cofano).
  { to: "/contacts" as const,              label: "Contatti",               icon: Users },
  { to: "/settings" as const,              label: "Settings",               icon: Settings },
];

function AuthLayout() {
  const { user } = Route.useRouteContext();
  const [mobileOpen, setMobileOpen] = useState(false);
  const router = useRouter();
  const qc = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ["profile", user.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      return data;
    },
  });

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    router.navigate({ to: "/auth", replace: true });
  };

  const displayName =
    profile?.full_name ||
    (user.user_metadata?.full_name as string | undefined) ||
    (user.email?.split("@")[0] ?? "Utente");
  const avatarUrl = profile?.avatar_url || (user.user_metadata?.avatar_url as string | undefined);

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 inset-x-0 z-40 flex h-14 items-center justify-between border-b border-border bg-sidebar px-4">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground font-bold">V</div>
          <span className="font-bold">Viis</span>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setMobileOpen((o) => !o)}>
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {/* Sidebar */}
      <Sidebar
        navItems={NAV}
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
        displayName={displayName}
        avatarUrl={avatarUrl ?? undefined}
        email={user.email ?? ""}
        plan={profile?.plan ?? "pro_flipper"}
        onSignOut={signOut}
      />

      {/* Main */}
      <main className="flex-1 min-w-0 pt-14 md:pt-0 md:pl-64">
        <div className="mx-auto w-full max-w-[1400px] p-4 md:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function Sidebar({
  navItems,
  mobileOpen,
  onClose,
  displayName,
  avatarUrl,
  email,
  plan,
  onSignOut,
}: {
  navItems: typeof NAV;
  mobileOpen: boolean;
  onClose: () => void;
  displayName: string;
  avatarUrl?: string;
  email: string;
  plan: string;
  onSignOut: () => void;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <>
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-30 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      )}
      <aside
        className={[
          "fixed inset-y-0 left-0 z-40 w-64 border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
      >
        <div className="flex h-full flex-col">
          <div className="hidden md:flex h-16 items-center gap-2.5 px-5 border-b border-sidebar-border">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground font-bold shadow-lg shadow-primary/30">V</div>
            <div className="flex flex-col leading-tight">
              <span className="font-bold tracking-tight">Viis</span>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Reseller CRM</span>
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
            {navItems.map((item) => {
              const active = pathname === item.to || (item.to !== "/home" && pathname.startsWith(item.to));
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={onClose}
                  className={[
                    "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                    active
                      ? "bg-primary/15 text-primary shadow-[inset_0_0_0_1px_oklch(0.62_0.21_275_/_0.3)]"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                  ].join(" ")}
                >
                  <Icon className={["h-4.5 w-4.5 h-5 w-5", active ? "text-primary" : ""].join(" ")} />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-sidebar-border p-3">
            <div className="flex items-center gap-3 rounded-xl bg-sidebar-accent/40 p-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={avatarUrl} alt={displayName} />
                <AvatarFallback className="bg-primary text-primary-foreground text-sm font-semibold">
                  {displayName.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{displayName}</div>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <Badge className="h-5 bg-gradient-to-r from-amber-500 to-orange-500 px-1.5 text-[10px] font-bold text-zinc-950 hover:from-amber-500 hover:to-orange-500 border-0">
                    {plan === "pro_flipper" ? "PRO FLIPPER" : plan.toUpperCase()}
                  </Badge>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onSignOut} title="Esci">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
            <div className="mt-2 truncate px-1 text-[11px] text-muted-foreground">{email}</div>
          </div>
        </div>
      </aside>
    </>
  );
}
