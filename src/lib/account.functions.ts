import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context as { userId: string };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Best-effort cleanup of user-owned data across all tables.
    // RLS is bypassed by supabaseAdmin, so we scope explicitly by user_id.
    const tables = [
      "ads",
      "inventory_items",
      "contacts",
      "inventory_template_fields",
      "platform_accounts",
      "inventory_audit_log",
    ] as const;

    for (const t of tables) {
      const { error } = await supabaseAdmin.from(t).delete().eq("user_id", userId);
      if (error) {
        // Continue on non-fatal errors (table may be empty or column missing).
        console.error(`[deleteMyAccount] delete ${t}:`, error.message);
      }
    }

    // Delete storage objects under ad-photos/<userId>/*
    try {
      const { data: files } = await supabaseAdmin.storage
        .from("ad-photos")
        .list(userId, { limit: 1000 });
      if (files && files.length > 0) {
        const paths = files.map((f) => `${userId}/${f.name}`);
        await supabaseAdmin.storage.from("ad-photos").remove(paths);
      }
    } catch (e) {
      console.error("[deleteMyAccount] storage cleanup:", e);
    }

    // Delete profile row
    const { error: profErr } = await supabaseAdmin.from("profiles").delete().eq("id", userId);
    if (profErr) console.error("[deleteMyAccount] profiles:", profErr.message);

    // Finally, delete the auth user
    const { error: authErr } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (authErr) throw new Error(`Impossibile eliminare l'account: ${authErr.message}`);

    return { ok: true };
  });
