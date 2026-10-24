import { describe, expect, it } from "vitest";
import { generatePlan, parseHHMM, plannedHours, startOffsetDays, topicHours, type PlanCourse, type PlanSettings } from "./planner";

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
    const fixed = [{ courseId: "a", start: new Date(2026, 9, 20, 9), end: new Date(2026, 9, 20, 10), minutes: 60 * 100, topicIds: [] }];
    const p = generatePlan({ courses: [a], busy: [], fixed, settings, now });
    const total = p.sessions.filter((s) => !s.isReview).reduce((m, s) => m + (s.end.getTime() - s.start.getTime()) / 60000, 0);
    expect(total).toBeCloseTo((135 - 100) * 60, -2);
  });
});
