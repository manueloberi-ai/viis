import { createFileRoute } from "@tanstack/react-router";
import { Settings } from "lucide-react";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <Card className="border-border bg-card p-8">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary"><Settings className="h-5 w-5" /></div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground">Schermata in preparazione.</p>
        </div>
      </div>
    </Card>
  );
}
