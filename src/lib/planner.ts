// Pure study-plan generator. All times are local (browser) time.

export type Weight = "high" | "medium" | "low";
export const WEIGHT_FACTOR: Record<Weight, number> = { high: 3, medium: 2, low: 1 };

export type PlanTopic = { id: string; weight: Weight; sortOrder: number };
export type PlanCourse = {
  id: string;
  credits: number;
  classHours: number;
  examAt: Date | null;
  topics: PlanTopic[];
};
export type Busy = { start: Date; end: Date };
/** Sessions the generator must keep: completed ones and manually placed ones. */
export type FixedSession = { courseId: string; start: Date; end: Date; minutes: number; topicIds: string[] };
export type PlanSettings = {
  maxHoursPerDay: number;
  noStudyAfter: string; // "HH:MM"
  buffer: number;
  mode: "full" | "reduced";
  preferredSlots: string[]; // morning | afternoon | evening | night
};
export type GeneratedSession = { courseId: string; topicIds: string[]; start: Date; end: Date; isReview: boolean };
export type PlanResult = {
  sessions: GeneratedSession[];
  /** Hours that could not be scheduled before the review window, per course. */
  missingHours: Record<string, number>;
  courseStart: Record<string, Date>;
};

export const MIN_SESSION = 25;
export const MAX_SESSION = 90;
const BREAK = 15;
const DAY_START = 8 * 60;
const MAX_PER_COURSE_PER_DAY = 180;
const REVIEW_DAYS = 2;
const SLOT_WINDOWS: Record<string, [number, number]> = {
  morning: [8 * 60, 12 * 60],
  afternoon: [12 * 60, 18 * 60],
  evening: [18 * 60, 22 * 60],
  night: [22 * 60, 24 * 60],
};

/** credits × 25 − class hours, times the personal buffer. */
export function selfStudyHours(c: Pick<PlanCourse, "credits" | "classHours">): number {
  return Math.max(0, c.credits * 25 - c.classHours);
}
export function plannedHours(c: Pick<PlanCourse, "credits" | "classHours">, buffer: number): number {
  return selfStudyHours(c) * buffer;
}

/** Splits hours across topics proportionally to weight (high 3, medium 2, low 1). */
export function topicHours(topics: PlanTopic[], hours: number): Record<string, number> {
  const total = topics.reduce((s, t) => s + WEIGHT_FACTOR[t.weight], 0);
  const out: Record<string, number> = {};
  for (const t of topics) out[t.id] = total ? (hours * WEIGHT_FACTOR[t.weight]) / total : 0;
  return out;
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const atMinute = (day: Date, min: number) => new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, min);
const minuteOf = (d: Date) => d.getHours() * 60 + d.getMinutes();
const sameDay = (a: Date, b: Date) => startOfDay(a).getTime() === startOfDay(b).getTime();
const daysBetween = (a: Date, b: Date) => Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / 86400000);
export const parseHHMM = (s: string) => {
  const [h, m] = s.split(":").map(Number);
  return (h ?? 23) * 60 + (m ?? 0);
};

type Range = [number, number];

function subtract(free: Range[], a: number, b: number): Range[] {
  const out: Range[] = [];
  for (const [s, e] of free) {
    if (b <= s || a >= e) out.push([s, e]);
    else {
      if (a > s) out.push([s, a]);
      if (b < e) out.push([b, e]);
    }
  }
  return out;
}

function findSlot(free: Range[], len: number, preferred: string[]): number | null {
  for (const p of preferred) {
    const w = SLOT_WINDOWS[p];
    if (!w) continue;
    for (const [s, e] of free) {
      const a = Math.max(s, w[0]);
      const b = Math.min(e, w[1]);
      if (b - a >= len) return a;
    }
  }
  for (const [s, e] of free) if (e - s >= len) return s;
  return null;
}

function longestFree(free: Range[]): number {
  return free.reduce((m, [s, e]) => Math.max(m, e - s), 0);
}

export function generatePlan(input: {
  courses: PlanCourse[];
  busy: Busy[];
  fixed: FixedSession[];
  settings: PlanSettings;
  now: Date;
}): PlanResult {
  const { courses, busy, fixed, settings, now } = input;
  const dayEnd = Math.min(parseHHMM(settings.noStudyAfter), 24 * 60);
  const today = startOfDay(now);
  const sessions: GeneratedSession[] = [];
  const courseStart: Record<string, Date> = {};

  type State = {
    c: PlanCourse;
    examDay: Date;
    reviewStart: Date;
    topicLeft: { id: string; left: number }[];
    remaining: number; // minutes
  };

  const states: State[] = [];
  for (const c of courses) {
    if (!c.examAt || c.examAt <= now) continue;
    const examDay = startOfDay(c.examAt);
    const reviewStart = addDays(examDay, -REVIEW_DAYS);
    const hours = topicHours(c.topics, plannedHours(c, settings.buffer));
    const order =
      settings.mode === "reduced"
        ? [...c.topics].sort((a, b) => WEIGHT_FACTOR[b.weight] - WEIGHT_FACTOR[a.weight] || a.sortOrder - b.sortOrder)
        : [...c.topics].sort((a, b) => a.sortOrder - b.sortOrder);
    const topicLeft = order.map((t) => ({ id: t.id, left: (hours[t.id] ?? 0) * 60 }));
    // Work already done or placed by hand counts against the topics in order.
    let done = fixed.filter((f) => f.courseId === c.id).reduce((s, f) => s + f.minutes, 0);
    for (const t of topicLeft) {
      const take = Math.min(t.left, done);
      t.left -= take;
      done -= take;
    }
    const remaining = topicLeft.reduce((s, t) => s + t.left, 0);
    // Work backward from the exam: how many days does this course need at a steady daily rate?
    const dailyRate = Math.min(MAX_PER_COURSE_PER_DAY, (settings.maxHoursPerDay * 60) / 2);
    // 30% slack for classes, other exams and review days of other courses.
    const daysNeeded = Math.ceil((remaining / dailyRate) * 1.3);
    let start = addDays(reviewStart, -daysNeeded);
    if (start < today) start = today;
    courseStart[c.id] = start;
    states.push({ c, examDay, reviewStart, topicLeft, remaining });
  }

  if (states.length === 0) return { sessions, missingHours: {}, courseStart };
  const lastDay = states.reduce((m, s) => (s.examDay > m ? s.examDay : m), today);

  for (let d = today; d <= lastDay; d = addDays(d, 1)) {
    let free: Range[] = [[sameDay(d, now) ? Math.max(DAY_START, minuteOf(now) + 15) : DAY_START, dayEnd]];
    if (free[0]![0] >= free[0]![1]) continue;
    for (const b of busy) {
      if (b.end <= d || b.start >= addDays(d, 1)) continue;
      const a = sameDay(b.start, d) ? minuteOf(b.start) - 10 : 0;
      const e = sameDay(b.end, d) ? minuteOf(b.end) + 10 : 24 * 60;
      free = subtract(free, a, e);
    }
    let capacity = settings.maxHoursPerDay * 60;
    for (const f of fixed) {
      if (!sameDay(f.start, d)) continue;
      free = subtract(free, minuteOf(f.start) - BREAK, minuteOf(f.end) + BREAK);
      capacity -= (f.end.getTime() - f.start.getTime()) / 60000;
    }

    const place = (courseId: string, len: number, topicIds: string[], isReview: boolean): boolean => {
      const s = findSlot(free, len, settings.preferredSlots);
      if (s == null) return false;
      sessions.push({ courseId, topicIds, start: atMinute(d, s), end: atMinute(d, s + len), isReview });
      free = subtract(free, s, s + len + BREAK);
      capacity -= len;
      return true;
    };

    // Review-only days: the last 2 days before an exam.
    const reviewing = states.filter((s) => d >= s.reviewStart && d < s.examDay);
    if (reviewing.length > 0) {
      let i = 0;
      let guard = 0;
      while (capacity >= MIN_SESSION && guard++ < 20) {
        const s = reviewing[i % reviewing.length]!;
        const len = Math.min(MAX_SESSION, capacity, longestFree(free));
        if (len < MIN_SESSION) break;
        const high = s.c.topics.filter((t) => t.weight === "high").map((t) => t.id);
        if (!place(s.c.id, len, high.length ? high : s.c.topics.map((t) => t.id), true)) break;
        i++;
      }
      continue;
    }

    const perCourse: Record<string, number> = {};
    let last: string | null = null;
    let guard = 0;
    while (capacity >= MIN_SESSION && guard++ < 30) {
      const active = states
        .filter((s) => s.remaining > 0.5 && d >= courseStart[s.c.id]! && d < s.reviewStart)
        .filter((s) => (perCourse[s.c.id] ?? 0) + MIN_SESSION <= MAX_PER_COURSE_PER_DAY)
        .sort(
          (a, b) =>
            b.remaining / Math.max(1, daysBetween(d, b.reviewStart)) -
            a.remaining / Math.max(1, daysBetween(d, a.reviewStart)),
        );
      if (active.length === 0) break;
      // Alternate courses: avoid the same course twice in a row when another is available.
      const s = active.find((x) => x.c.id !== last) ?? active[0]!;
      let len = Math.min(
        MAX_SESSION,
        Math.max(MIN_SESSION, Math.round(s.remaining)),
        capacity,
        MAX_PER_COURSE_PER_DAY - (perCourse[s.c.id] ?? 0),
      );
      len = Math.min(len, longestFree(free));
      if (len < MIN_SESSION) break;
      // Consume topics in order.
      const ids: string[] = [];
      let need = len;
      for (const t of s.topicLeft) {
        if (need <= 0) break;
        if (t.left <= 0.5) continue;
        const take = Math.min(t.left, need);
        t.left -= take;
        need -= take;
        ids.push(t.id);
      }
      if (!place(s.c.id, len, ids, false)) break;
      s.remaining = s.topicLeft.reduce((acc, t) => acc + Math.max(0, t.left), 0);
      perCourse[s.c.id] = (perCourse[s.c.id] ?? 0) + len;
      last = s.c.id;
    }
  }

  const missingHours: Record<string, number> = {};
  for (const s of states) if (s.remaining > 30) missingHours[s.c.id] = Math.round((s.remaining / 60) * 10) / 10;
  return { sessions, missingHours, courseStart };
}
