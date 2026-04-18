import { supabase } from "@/integrations/supabase/client";

export type AuditAction = "LOGIN" | "SIGNUP" | "CREATE" | "UPDATE" | "DELETE" | "EXPORT" | "ROLE_CHANGE" | "INVITE" | "OTHER";

export async function logAction(
  action: AuditAction,
  entityType: string,
  entityId?: string | null,
  details?: Record<string, any>
) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;

    // Try to get display name from profiles to embed it in the log row
    let userName: string | undefined;
    if (userId) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("user_id", userId)
        .single();
      userName = profile?.display_name ?? undefined;
    }

    await (supabase as any).from("audit_logs").insert({
      user_id: userId || null,
      action,
      entity_type: entityType,
      entity_id: entityId || null,
      details: {
        ...(details || {}),
        // Embed name as fallback so audit reads correctly even if join fails
        ...(userName ? { _user_name: userName } : {}),
      },
    });
  } catch (error) {
    console.error("Failed to log action:", error);
  }
}

/** Convenience: human-readable description of an audit log row */
export function describeLog(log: any): string {
  const action = log.action as AuditAction;
  const entity = log.entity_type ?? "";
  const name = log.details?._user_name ?? log.profiles?.display_name ?? "Someone";

  const map: Partial<Record<AuditAction, string>> = {
    LOGIN:       `${name} logged in`,
    SIGNUP:      `${name} created an account`,
    CREATE:      `${name} created a new ${entity.toLowerCase()} record`,
    UPDATE:      `${name} updated a ${entity.toLowerCase()} record`,
    DELETE:      `${name} deleted a ${entity.toLowerCase()} record`,
    EXPORT:      `${name} exported ${entity.toLowerCase()} data`,
    ROLE_CHANGE: `${name} changed a user role`,
    INVITE:      `${name} invited a new user`,
    OTHER:       `${name} performed an action on ${entity}`,
  };

  return map[action] ?? `${name} – ${action} on ${entity}`;
}
