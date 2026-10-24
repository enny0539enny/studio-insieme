// Live study map: shared types, pure filter/layout helpers and data access.
import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type LiveSession = {
  session_id: string;
  user_id: string;
  first_name: string;
  is_demo: boolean;
  is_mine: boolean;
  archetype: string | null;
  social: number | null;
  tags: string[];
  university_id: string | null;
  university_name: string | null;
  program_name: string | null;
  program_year: number | null;
  course_id: string | null;
  subject_label: string;
  general_subject: string;
  activity: string;
  place_kind: string;
  venue_id: string | null;
  ends_at: string;
  open_to_invitations: boolean;
};
export type Venue = { id: string; name: string; type: string; lat: number; lng: number; opening_hours: string | null };
export type Filters = { subjects: string[]; university: string | null; activity: string | null; openOnly: boolean };
export type Bounds = { south: number; west: number; north: number; east: number };

export const EMPTY_FILTERS: Filters = { subjects: [], university: null, activity: null, openOnly: false };
export const GENERAL_SUBJECTS = ["math", "cs", "econ", "eng", "physics", "law", "languages", "other"] as const;
export const ACTIVITIES = ["exam_review", "exercises", "project", "reading"] as const;
export const MAX_SESSION_HOURS = 5;

/** Subject filter keys: `course:<id>` for the student's own courses, `gen:<key>` for general subjects. */
export function matchesFilters(s: LiveSession, f: Filters): boolean {
  if (f.openOnly && !s.open_to_invitations) return false;
  if (f.university && s.university_id !== f.university) return false;
  if (f.activity && s.activity !== f.activity) return false;
  if (f.subjects.length > 0) {
    const ok = f.subjects.some((k) =>
      k.startsWith("course:") ? s.course_id === k.slice(7) : s.general_subject === k.slice(4),
    );
    if (!ok) return false;
  }
  return true;
}

/** Only sessions at a public venue get a pin; Home and Online count in totals only. */
export function isOnMap(s: LiveSession): boolean {
  return s.place_kind === "venue" && !!s.venue_id;
}

export function inBounds(lat: number, lng: number, b: Bounds) {
  return lat >= b.south && lat <= b.north && lng >= b.west && lng <= b.east;
}

/** Spreads several students at one venue on a small circle (~20 m) around the venue point. */
export function spreadAround(lat: number, lng: number, index: number, count: number): [number, number] {
  if (count <= 1) return [lat, lng];
  const r = 0.00018 + 0.00003 * Math.floor(count / 8);
  const a = (2 * Math.PI * index) / count;
  return [lat + r * Math.sin(a), lng + (r * Math.cos(a)) / Math.cos((lat * Math.PI) / 180)];
}

export function guessGeneral(courseName: string): string {
  const n = courseName.toLowerCase();
  if (/anali|statist|matem|algebra|geometr/.test(n)) return "math";
  if (/fisic|physic/.test(n)) return "physics";
  if (/econom|finan|aziend/.test(n)) return "econ";
  if (/informat|program|comput/.test(n)) return "cs";
  return "eng";
}

export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

export const venuesQuery = queryOptions({
  queryKey: ["venues"],
  queryFn: async () => {
    const { data, error } = await supabase.from("venues").select("id,name,type,lat,lng,opening_hours").eq("approved", true).order("name");
    if (error) throw error;
    return data as Venue[];
  },
  staleTime: 5 * 60_000,
});

export const liveQuery = queryOptions({
  queryKey: ["live"],
  queryFn: async () => {
    const { data, error } = await supabase.rpc("get_live_sessions");
    if (error) throw error;
    return (data ?? []) as LiveSession[];
  },
  refetchInterval: 20_000,
});

export type Ping = {
  id: string;
  incoming: boolean;
  other_id: string;
  other_first_name: string;
  other_is_demo: boolean;
  other_archetype: string | null;
  other_social: number | null;
  message: string;
  status: "pending" | "accepted" | "declined" | "cancelled" | "expired";
  chat_id: string | null;
  created_at: string;
};

export const pingsQuery = queryOptions({
  queryKey: ["pings"],
  queryFn: async () => {
    const { data, error } = await supabase.rpc("my_pings");
    if (error) throw error;
    return (data ?? []) as Ping[];
  },
  refetchInterval: 10_000,
});

export function pingErrorKey(e: unknown): string {
  const msg = (e as { message?: string })?.message ?? "";
  const keys = ["SESSION_NOT_ACTIVE", "NOT_OPEN", "ALREADY_PENDING", "RATE_LIMIT", "DECLINED_RECENTLY", "BLOCKED", "SELF"];
  return keys.find((k) => msg.includes(k)) ?? "generic";
}
