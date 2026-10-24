// Pure compatibility scoring for the People deck. Score is 0–100, used only for ordering.
import type { Likert } from "./archetype";

export type Profile = {
  likert: Likert;
  lookingFor: string | null;
  groupSize: string | null;
  places: string[];
  timeSlots: string[];
  tags: string[];
  languages: string[];
};

export type DeckCandidate = Profile & {
  id: string;
  firstName: string;
  sharedCourseIds: string[];
};

const overlap = <T,>(a: T[], b: T[]) => a.filter((x) => b.includes(x));

/** Does the pair fit what `seeker` is looking for? */
export function fitsLookingFor(seeker: Profile, other: Profile, sharedExamCourses: number): boolean {
  switch (seeker.lookingFor) {
    case "review":
    case "sparring":
      return Math.abs(seeker.likert.explain - other.likert.explain) >= 2;
    case "quiet":
      return Math.abs(seeker.likert.silence - other.likert.silence) <= 1;
    case "coach":
      return Math.abs(seeker.likert.plan - other.likert.plan) <= 1;
    case "unblock":
      return sharedExamCourses > 0;
    default:
      return false;
  }
}

export function compatibility(me: Profile, c: DeckCandidate, upcomingExamCourseIds: string[]): number {
  const shared = c.sharedCourseIds.length;
  const sharedExam = overlap(c.sharedCourseIds, upcomingExamCourseIds).length;
  // 30% shared courses, more when the same exam is coming up.
  const courses = shared === 0 ? 0 : Math.min(30, 15 + 5 * shared + (sharedExam > 0 ? 5 : 0));
  // 25% fit for what each one is looking for.
  const fit = 12.5 * (Number(fitsLookingFor(me, c, sharedExam)) + Number(fitsLookingFor(c, me, sharedExam)));
  // 20% overlapping time slots.
  const minSlots = Math.min(me.timeSlots.length, c.timeSlots.length);
  const time = minSlots === 0 ? 0 : (20 * overlap(me.timeSlots, c.timeSlots).length) / minSlots;
  // 15% logistics.
  const sameGroup = !!me.groupSize && me.groupSize === c.groupSize;
  const logistics = (sameGroup ? 7.5 : 0) + (overlap(me.places, c.places).length > 0 ? 7.5 : 0);
  // 10% shared languages and tags.
  const social = (overlap(me.languages, c.languages).length > 0 ? 5 : 0) + 2.5 * Math.min(2, overlap(me.tags, c.tags).length);
  return Math.round(Math.min(100, courses + fit + time + logistics + social));
}

export function matchLabel(score: number): "great" | "good" {
  return score >= 65 ? "great" : "good";
}

export type WhyStrings = {
  courseAndSlot: (course: string, slot: string) => string;
  course: (course: string) => string;
  theyExplain: (name: string) => string;
  youExplain: (name: string) => string;
  slot: (slot: string) => string;
  tag: (tag: string) => string;
  lookingFor: (label: string) => string;
  fallback: string;
};

/** One line built only from facts that are true for both profiles. */
export function whyLine(
  me: Profile,
  c: DeckCandidate,
  courseNames: Record<string, string>,
  slotLabel: (s: string) => string,
  lfLabel: (s: string) => string,
  s: WhyStrings,
): string {
  const course = c.sharedCourseIds.map((id) => courseNames[id]).find(Boolean);
  const slot = overlap(me.timeSlots, c.timeSlots)[0];
  if (course && slot) return s.courseAndSlot(course, slotLabel(slot));
  let explain: string | null = null;
  if (me.likert.explain >= 4 && c.likert.explain <= 2) explain = s.theyExplain(c.firstName);
  if (me.likert.explain <= 2 && c.likert.explain >= 4) explain = s.youExplain(c.firstName);
  if (course) return explain ? `${s.course(course)} ${explain}.` : `${s.course(course)}.`.replace("..", ".");
  if (explain) return explain.charAt(0).toUpperCase() + explain.slice(1) + ".";
  if (slot) return s.slot(slotLabel(slot));
  const tag = overlap(me.tags, c.tags)[0];
  if (tag) return s.tag(tag);
  if (me.lookingFor && me.lookingFor === c.lookingFor) return s.lookingFor(lfLabel(me.lookingFor));
  return s.fallback;
}
