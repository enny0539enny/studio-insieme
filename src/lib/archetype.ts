// Pure onboarding logic: archetype computation and match picking.

export type Likert = { explain: number; silence: number; plan: number; social: number };
export type Scenario = "reread" | "ask" | "teach" | "mock" | "panic";
export type LookingFor = "quiet" | "review" | "sparring" | "coach" | "unblock";
export type ArchetypeKey =
  | "lighthouse"
  | "spark"
  | "cartographer"
  | "explorer"
  | "seismograph"
  | "metronome"
  | "sparring"
  | "lantern";
export type AvatarTone = "warm" | "cool" | "sand";

/** Applies the archetype rules in order; first match wins. */
export function computeArchetype(l: Likert, scenario: Scenario, lookingFor: LookingFor): ArchetypeKey {
  if (l.silence <= 2 && l.plan <= 2) return "metronome";
  if (scenario === "mock" && lookingFor === "sparring") return "sparring";
  if (l.social <= 2 && l.explain >= 4) return "lantern";
  if (l.explain === 3 && l.plan === 3) return "seismograph";

  let explainHigh = l.explain >= 4;
  let planHigh = l.plan >= 4;
  // Exactly one axis is 3 here: resolve it with the scenario, otherwise treat as low.
  if (l.explain === 3) explainHigh = scenario === "ask";
  if (l.plan === 3) planHigh = scenario === "panic";

  if (!explainHigh && !planHigh) return "lighthouse";
  if (!explainHigh && planHigh) return "spark";
  if (explainHigh && !planHigh) return "cartographer";
  return "explorer";
}

export function avatarTone(social: number | undefined): AvatarTone {
  if (social == null) return "sand";
  if (social <= 2) return "warm";
  if (social >= 4) return "cool";
  return "sand";
}

export type Candidate = {
  candidate_id: string;
  first_name: string;
  is_demo: boolean;
  archetype: string | null;
  likert: Likert;
  looking_for: string | null;
  time_slots: string[];
  tags: string[];
  shared_course_ids: string[];
  next_session: { starts_at: string; place: string; looking_for: string | null } | null;
};

export type Me = {
  likert: Likert;
  lookingFor: LookingFor;
  timeSlots: string[];
  tags: string[];
  /** Courses the student is enrolled in that have an upcoming exam. */
  upcomingExamCourseIds: string[];
};

const overlap = (a: string[], b: string[]) => a.filter((x) => b.includes(x));

export function isPreferred(me: Me, c: Candidate): boolean {
  switch (me.lookingFor) {
    case "review":
    case "sparring":
      return Math.abs(me.likert.explain - c.likert.explain) >= 2;
    case "quiet":
      return Math.abs(me.likert.silence - c.likert.silence) <= 1;
    case "coach":
      return Math.abs(me.likert.plan - c.likert.plan) <= 1;
    case "unblock":
      return overlap(c.shared_course_ids, me.upcomingExamCourseIds).length > 0;
  }
}

/** Real onboarded students first; demo students only if no real candidate exists. */
export function pickMatch(me: Me, candidates: Candidate[]): Candidate | null {
  const valid = candidates.filter((c) => c.archetype && c.likert && c.shared_course_ids.length > 0);
  const real = valid.filter((c) => !c.is_demo);
  const pool = real.length > 0 ? real : valid.filter((c) => c.is_demo);
  const scored = pool
    .map((c) => ({
      c,
      pref: isPreferred(me, c) ? 1 : 0,
      time: overlap(me.timeSlots, c.time_slots).length,
      tags: overlap(me.tags, c.tags).length,
    }))
    .sort((a, b) => b.pref - a.pref || b.time - a.time || b.tags - a.tags);
  return scored[0]?.c ?? null;
}

export type MatchFacts = {
  explainOpposite?: "theyExplain" | "youExplain";
  bothSilent?: boolean;
  bothPlan?: "plan" | "sprint";
  sharedExamCourseId?: string;
  sharedSlot?: string;
  sharedCourseId?: string;
};

/** Collects only facts that are actually true for this pair, most relevant first. */
export function matchFacts(me: Me, c: Candidate): MatchFacts {
  const f: MatchFacts = {};
  if (me.likert.explain >= 4 && c.likert.explain <= 2) f.explainOpposite = "theyExplain";
  if (me.likert.explain <= 2 && c.likert.explain >= 4) f.explainOpposite = "youExplain";
  if (me.likert.silence <= 2 && c.likert.silence <= 2) f.bothSilent = true;
  if (me.likert.plan <= 2 && c.likert.plan <= 2) f.bothPlan = "plan";
  if (me.likert.plan >= 4 && c.likert.plan >= 4) f.bothPlan = "sprint";
  f.sharedExamCourseId = overlap(c.shared_course_ids, me.upcomingExamCourseIds)[0];
  f.sharedSlot = overlap(me.timeSlots, c.time_slots)[0];
  f.sharedCourseId = c.shared_course_ids[0];
  return f;
}
