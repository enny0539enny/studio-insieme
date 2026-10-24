// Browser wrappers around the plan sync, bound to the signed-in client.
import { supabase } from "@/integrations/supabase/client";
import { ensurePlanWith, regeneratePlanWith } from "./plan-sync";

export const regeneratePlan = (uid: string) => regeneratePlanWith(supabase, uid);
export const ensurePlan = (uid: string) => ensurePlanWith(supabase, uid);
