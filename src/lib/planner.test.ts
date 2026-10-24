import { describe, expect, it } from "vitest";
import { classTopics, generatePlan, parseHHMM, plannedHours, startOffsetDays, topicHours, type PlanCourse, type PlanSettings } from "./planner";

const settings: PlanSettings = { maxHoursPerDay: 6, noStudyAfter: "23:00", buffer: 1.5, mode: "full", preferredSlots: [] };
const now = new Date(2026, 9, 26, 7, 0); // Mon 26 Oct 2026, 07:00

const course = (id: string, examAt: Date, credits = 6, classHours = 60): PlanCourse => ({
  id,
  credits,
  classHours,
  examAt,
  topics: [
    { id: `${id}-h`, weight: "high", sortOrder: 1 },
    { id: `${id}-m`, weight: "medium", sortOrder: 2 },
    { id: `${id}-l`, weight: "low", sortOrder: 3 },
  ],
});

describe("hours", () => {
  it("8 CFU with 80 class hours plans 120 hours (buffer does not inflate it)", () =>
    expect(plannedHours({ credits: 8, classHours: 80 })).toBe(120));
  it("start offset = remaining ÷ max per day × buffer: 60h, 6h/day, 1.5 → 15 days", () =>
    expect(startOffsetDays(60, 6, 1.5)).toBe(15));
  it("past class hours and completed study count as done", () => {
    const c = { ...course("p", new Date(2027, 0, 18, 9, 0), 6, 60), pastClassHours: 40 }; // 90 − 40 = 50h left
    const done = [{ courseId: "p", start: new Date(2026, 9, 20, 9), end: new Date(2026, 9, 20, 10), minutes: 600, topicIds: [] }];
    const r = generatePlan({ courses: [c], busy: [], fixed: done, settings, now });
    const h = r.sessions.filter((s) => !s.isReview).reduce((m, s) => m + (s.end.getTime() - s.start.getTime()) / 3600000, 0);
    expect(Math.round(h)).toBe(40);
  });
  it("splits hours 3:2:1 by weight", () => {
    const h = topicHours(course("a", now).topics, 60);
    expect([h["a-h"], h["a-m"], h["a-l"]]).toEqual([30, 20, 10]);
  });
});

describe("generatePlan", () => {
  const a = course("a", new Date(2027, 0, 18, 9, 0));
  const b = course("b", new Date(2027, 0, 25, 9, 0));
  const classes = [{ start: new Date(2026, 9, 27, 10, 0), end: new Date(2026, 9, 27, 12, 0) }];
  const plan = generatePlan({ courses: [a, b], busy: classes, fixed: [], settings, now });

  it("schedules every hour when there is enough time", () => expect(plan.missingHours).toEqual({}));
  it("sessions last 25–90 minutes", () => {
    for (const s of plan.sessions) {
      const m = (s.end.getTime() - s.start.getTime()) / 60000;
      expect(m).toBeGreaterThanOrEqual(25);
      expect(m).toBeLessThanOrEqual(90);
    }
  });
  it("nothing ends after 23:00", () => {
    for (const s of plan.sessions) expect(s.end.getHours() * 60 + s.end.getMinutes()).toBeLessThanOrEqual(parseHHMM("23:00"));
  });
  it("never exceeds 6 hours a day", () => {
    const perDay: Record<string, number> = {};
    for (const s of plan.sessions) {
      const k = s.start.toDateString();
      perDay[k] = (perDay[k] ?? 0) + (s.end.getTime() - s.start.getTime()) / 60000;
    }
    for (const v of Object.values(perDay)) expect(v).toBeLessThanOrEqual(360);
  });
  it("never overlaps a class", () => {
    for (const s of plan.sessions) expect(s.end <= classes[0]!.start || s.start >= classes[0]!.end).toBe(true);
  });
  it("the 2 days before an exam are review only", () => {
    const review = plan.sessions.filter((s) => s.start >= new Date(2027, 0, 16) && s.start < new Date(2027, 0, 18));
    expect(review.length).toBeGreaterThan(0);
    expect(review.every((s) => s.isReview && s.courseId === "a")).toBe(true);
  });
  it("starts by working backward from the exam, not today, when there is slack", () =>
    expect(plan.courseStart["a"]!.getTime()).toBeGreaterThan(now.getTime()));
  it("alternates courses within a day", () => {
    const day = plan.sessions.filter((s) => s.start.toDateString() === plan.sessions.find((x) => x.courseId === "a" && !x.isReview && plan.sessions.some((y) => y.courseId === "b" && y.start.toDateString() === x.start.toDateString()))?.start.toDateString());
    for (let i = 1; i < day.length; i++) {
      const prev = day[i - 1]!;
      const cur = day[i]!;
      if (prev.courseId === cur.courseId) expect(day.every((s) => s.courseId === cur.courseId)).toBe(true);
    }
  });
  it("reports missing hours when the plan doesn't fit", () => {
    const tight = generatePlan({ courses: [course("t", new Date(2026, 10, 2, 9, 0), 12, 0)], busy: [], fixed: [], settings, now });
    expect(tight.missingHours["t"]).toBeGreaterThan(0);
  });
  it("reduced plan covers high-weight topics first", () => {
    const c = course("r", new Date(2026, 10, 2, 9, 0), 12, 0);
    c.topics = [
      { id: "low", weight: "low", sortOrder: 1 },
      { id: "high", weight: "high", sortOrder: 2 },
    ];
    const p = generatePlan({ courses: [c], busy: [], fixed: [], settings: { ...settings, mode: "reduced" }, now });
    expect(p.sessions[0]!.topicIds[0]).toBe("high");
  });
  it("completed work reduces what is left to plan", () => {
    const fixed = [{ courseId: "a", start: new Date(2026, 9, 20, 9), end: new Date(2026, 9, 20, 10), minutes: 60 * 50, topicIds: [] }];
    const p = generatePlan({ courses: [a], busy: [], fixed, settings, now });
    const total = p.sessions.filter((s) => !s.isReview).reduce((m, s) => m + (s.end.getTime() - s.start.getTime()) / 60000, 0);
    expect(total).toBeCloseTo((90 - 50) * 60, -2);
  });
});

describe("realistic timetable", () => {
  const exam = new Date(2027, 0, 25, 9, 0);
  const c = course("x", exam, 12, 0);
  const y = course("y", new Date(2027, 1, 1, 9, 0), 12, 0);
  // Monday 26 Oct 2026, class 08:30–10:30 and 10:30–12:30 (back to back), and one 14:15–16:15.
  const cls = [
    { id: "c1", start: new Date(2026, 9, 26, 8, 30), end: new Date(2026, 9, 26, 10, 30), topicIds: ["x-h"] },
    { id: "c2", start: new Date(2026, 9, 26, 10, 30), end: new Date(2026, 9, 26, 12, 30), topicIds: ["x-m"] },
    { id: "c3", start: new Date(2026, 9, 26, 14, 15), end: new Date(2026, 9, 26, 16, 15), topicIds: ["x-l"] },
  ];
  c.classes = cls;
  const p = generatePlan({ courses: [c, y], busy: cls.map((k) => ({ start: k.start, end: k.end })), fixed: [], settings, now });
  const min = (x: Date) => x.getHours() * 60 + x.getMinutes();
  const dur = (s: { start: Date; end: Date }) => (s.end.getTime() - s.start.getTime()) / 60000;

  it("nothing before 08:00 or after 23:00", () => {
    for (const s of p.sessions) {
      expect(min(s.start)).toBeGreaterThanOrEqual(480);
      expect(min(s.end)).toBeLessThanOrEqual(1380);
    }
  });
  it("Saturday only 09:00–18:00", () => {
    for (const s of p.sessions.filter((s) => s.start.getDay() === 6)) {
      expect(min(s.start)).toBeGreaterThanOrEqual(540);
      expect(min(s.end)).toBeLessThanOrEqual(1080);
    }
  });
  it("Sunday at most 3 hours, 10:00–19:00", () => {
    const perDay: Record<string, number> = {};
    for (const s of p.sessions.filter((s) => s.start.getDay() === 0)) {
      expect(min(s.start)).toBeGreaterThanOrEqual(600);
      expect(min(s.end)).toBeLessThanOrEqual(1140);
      perDay[s.start.toDateString()] = (perDay[s.start.toDateString()] ?? 0) + dur(s);
    }
    for (const v of Object.values(perDay)) expect(v).toBeLessThanOrEqual(180);
  });
  it("weekdays keep lunch 13–14 and dinner 19:30–20:30 free", () => {
    for (const s of p.sessions.filter((s) => s.start.getDay() >= 1 && s.start.getDay() <= 5)) {
      expect(min(s.end) <= 780 || min(s.start) >= 840).toBe(true);
      expect(min(s.end) <= 1170 || min(s.start) >= 1230).toBe(true);
    }
  });
  it("at least 15 minutes between sessions", () => {
    const sorted = [...p.sessions].sort((a, b) => a.start.getTime() - b.start.getTime());
    for (let i = 1; i < sorted.length; i++)
      if (sameDate(sorted[i]!.start, sorted[i - 1]!.start)) expect(sorted[i]!.start.getTime() - sorted[i - 1]!.end.getTime()).toBeGreaterThanOrEqual(15 * 60000);
  });
  it("every class gets a 20–30 min review the same day covering its topics", () => {
    for (const k of cls) {
      const r = p.sessions.find((s) => s.classEventId === k.id)!;
      expect(r.kind).toBe("review");
      expect(dur(r)).toBeGreaterThanOrEqual(20);
      expect(dur(r)).toBeLessThanOrEqual(30);
      expect(r.start.toDateString()).toBe(k.start.toDateString());
      expect(r.topicIds).toEqual(k.topicIds);
    }
  });
  it("review starts right after class + 15 min travel when free, else in the evening", () => {
    expect(min(p.sessions.find((s) => s.classEventId === "c3")!.start)).toBe(16 * 60 + 30);
    expect(min(p.sessions.find((s) => s.classEventId === "c1")!.start)).toBeGreaterThanOrEqual(1230);
  });
  it("classes map to topics in order across the semester", () => {
    const m = classTopics(
      [0, 1, 2, 3].map((i) => ({ id: `k${i}`, start: new Date(2026, 9, 1 + i) })),
      [{ id: "a", weight: "high", sortOrder: 1 }, { id: "b", weight: "low", sortOrder: 2 }],
    );
    expect(m).toEqual({ k0: ["a"], k1: ["a"], k2: ["b"], k3: ["b"] });
  });
});
const sameDate = (a: Date, b: Date) => a.toDateString() === b.toDateString();
