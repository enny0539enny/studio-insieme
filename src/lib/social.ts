import { queryOptions, type QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Likert } from "./archetype";
import type { Profile } from "./compat";

export const DEMO_REPLY_MS = 3500;

export type DeckRow = {
  candidate_id: string;
  first_name: string;
  is_demo: boolean;
  archetype: string | null;
  likert: Likert;
  looking_for: string | null;
  group_size: string | null;
  places: string[];
  time_slots: string[];
  tags: string[];
  languages: string[];
  university_id: string | null;
  university_name: string | null;
  program_name: string | null;
  program_year: number | null;
  shared_course_ids: string[];
};

export type MatchRow = {
  match_id: string;
  other_id: string;
  first_name: string;
  is_demo: boolean;
  archetype: string | null;
  social: number | null;
  chat_id: string | null;
  course_name: string | null;
};

export const meSocialQuery = queryOptions({
  queryKey: ["me-social"],
  queryFn: async () => {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user!.id;
    const [sp, enr, prof] = await Promise.all([
      supabase.from("student_profiles").select("*").eq("user_id", uid).maybeSingle(),
      supabase
        .from("enrollments")
        .select("courses(id, name, course_topics(id, name, sort_order), exams(exam_date))")
        .eq("user_id", uid)
        .eq("role", "student"),
      supabase.from("profiles").select("full_name, university_id").eq("id", uid).maybeSingle(),
    ]);
    const now = new Date();
    const courses = (enr.data ?? [])
      .map((e) => e.courses)
      .filter((c) => c != null)
      .sort((a, b) => a.name.localeCompare(b.name));
    const s = sp.data;
    const profile: Profile = {
      likert: { explain: 3, silence: 3, plan: 3, social: 3, ...((s?.likert_answers ?? {}) as Partial<Likert>) },
      lookingFor: s?.looking_for ?? null,
      groupSize: s?.group_size ?? null,
      places: s?.places ?? [],
      timeSlots: s?.time_slots ?? [],
      tags: s?.tags ?? [],
      languages: s?.languages ?? [],
    };
    return {
      uid,
      isGuest: !!auth.user?.is_anonymous,
      firstName: (prof.data?.full_name ?? "").split(" ")[0] ?? "",
      archetype: s?.archetype ?? null,
      student: s,
      profile,
      courses: courses.map((c) => ({
        id: c.id,
        name: c.name,
        topics: [...c.course_topics].sort((a, b) => a.sort_order - b.sort_order),
      })),
      courseNames: Object.fromEntries(courses.map((c) => [c.id, c.name])) as Record<string, string>,
      upcomingExamCourseIds: courses.filter((c) => c.exams.some((e) => new Date(e.exam_date) > now)).map((c) => c.id),
    };
  },
});

export const deckQuery = queryOptions({
  queryKey: ["deck"],
  queryFn: async () => {
    const { data, error } = await supabase.rpc("get_deck");
    if (error) throw error;
    return (data ?? []) as unknown as DeckRow[];
  },
});

export const matchesQuery = queryOptions({
  queryKey: ["matches"],
  queryFn: async () => {
    const { data, error } = await supabase.rpc("my_matches");
    if (error) throw error;
    return (data ?? []) as unknown as MatchRow[];
  },
});

export const venuesQuery = queryOptions({
  queryKey: ["venues-list"],
  queryFn: async () => {
    const { data } = await supabase.from("venues").select("id, name, type").eq("approved", true).order("name");
    return data ?? [];
  },
  staleTime: 600000,
});

/** Sends a chat message; demo members answer a few seconds later. */
export async function sendChatMessage(qc: QueryClient, chatId: string, body: string) {
  const { data: u } = await supabase.auth.getUser();
  const { error } = await supabase.from("chat_messages").insert({ chat_id: chatId, sender_id: u.user!.id, body });
  if (error) throw error;
  qc.invalidateQueries({ queryKey: ["chat", chatId] });
  qc.invalidateQueries({ queryKey: ["chats"] });
  scheduleDemoReply(qc, chatId);
}

export function scheduleDemoReply(qc: QueryClient, chatId: string) {
  setTimeout(async () => {
    await supabase.rpc("demo_chat_reply", { _chat_id: chatId });
    qc.invalidateQueries({ queryKey: ["chat", chatId] });
    qc.invalidateQueries({ queryKey: ["chats"] });
  }, DEMO_REPLY_MS);
}

export function sessionState(starts: string, ends: string, now = new Date()): "upcoming" | "live" | "done" {
  if (now < new Date(starts)) return "upcoming";
  if (now < new Date(ends)) return "live";
  return "done";
}
