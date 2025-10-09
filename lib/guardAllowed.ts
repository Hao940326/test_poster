// /lib/guardAllowed.ts
import type { SupabaseClient } from "@supabase/supabase-js";

/** 檢查目前登入者是否在 allowed_users；會在 Console 打 LOG。 */
export async function guardAllowed(
  supabase: SupabaseClient,
  src: "callback" | "studio"
): Promise<{ allowed: boolean; email: string | null }> {
  const { data: { session } } = await supabase.auth.getSession();
  const email = session?.user?.email?.toLowerCase() ?? null;

  console.log(`[guardAllowed:${src}] session email =`, email);

  if (!email) return { allowed: false, email };

  const { data, error } = await supabase
    .from("allowed_users")
    .select("email")
    .eq("email", email)
    .maybeSingle();

  console.log(`[guardAllowed:${src}] query result:`, { data, error });

  if (error) {
    console.error(`[guardAllowed:${src}] allowed_users error:`, error);
    return { allowed: false, email };
  }
  return { allowed: !!data, email };
}
