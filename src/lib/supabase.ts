import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export async function writeAuditLog(
  action: string,
  targetId?: string,
  details?: Record<string, unknown>
) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await supabase.from('audit_logs').insert({
    user_id: user.id,
    user_email: user.email,
    action,
    target_id: targetId ?? null,
    details: details ?? null,
  })
}
