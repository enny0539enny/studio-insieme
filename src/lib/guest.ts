import { supabase } from "@/integrations/supabase/client";

/** Starts an anonymous guest session; the backend links it to the demo university data. */
export async function startGuestSession() {
  const { error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
}
