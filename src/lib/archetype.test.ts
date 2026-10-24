import { describe, expect, it } from "vitest";
import { avatarTone, computeArchetype, pickMatch, type Candidate, type Me } from "./archetype";

describe("computeArchetype — demo students", () => {
  it("Marta is The Cartographer", () =>
    expect(computeArchetype({ explain: 4, silence: 4, plan: 2, social: 3 }, "reread", "review")).toBe("cartographer"));
  it("Luca is The Spark", () =>
    expect(computeArchetype({ explain: 1, silence: 5, plan: 4, social: 1 }, "teach", "sparring")).toBe("spark"));
  it("Giulia is The Metronome", () =>
    expect(computeArchetype({ explain: 3, silence: 1, plan: 1, social: 4 }, "reread", "quiet")).toBe("metronome"));
  it("Davide is The Explorer", () =>
    expect(computeArchetype({ explain: 5, silence: 4, plan: 5, social: 4 }, "panic", "unblock")).toBe("explorer"));
  it("Sara is The Lighthouse", () =>
    expect(computeArchetype({ explain: 1, silence: 3, plan: 1, social: 2 }, "teach", "coach")).toBe("lighthouse"));
  it("Tommaso is The Lantern", () =>
    expect(computeArchetype({ explain: 4, silence: 3, plan: 3, social: 1 }, "ask", "quiet")).toBe("lantern"));
});

describe("computeArchetype — rules", () => {
  it("mock + sparring gives The Sparring Partner", () =>
    expect(computeArchetype({ explain: 5, silence: 5, plan: 5, social: 5 }, "mock", "sparring")).toBe("sparring"));
  it("explain 3 and plan 3 gives The Seismograph", () =>
    expect(computeArchetype({ explain: 3, silence: 4, plan: 3, social: 3 }, "reread", "quiet")).toBe("seismograph"));
  it("explain 3 resolved high by 'ask'", () =>
    expect(computeArchetype({ explain: 3, silence: 4, plan: 5, social: 3 }, "ask", "quiet")).toBe("explorer"));
  it("explain 3 unresolved by 'mock' is treated as low", () =>
    expect(computeArchetype({ explain: 3, silence: 4, plan: 5, social: 3 }, "mock", "quiet")).toBe("spark"));
  it("plan 3 resolved high by 'panic'", () =>
    expect(computeArchetype({ explain: 1, silence: 4, plan: 3, social: 3 }, "panic", "quiet")).toBe("spark"));
  it("plan 3 resolved low by 'reread'", () =>
    expect(computeArchetype({ explain: 5, silence: 4, plan: 3, social: 3 }, "reread", "quiet")).toBe("cartographer"));
});

describe("avatarTone", () => {
  it("social 2 is warm", () => expect(avatarTone(2)).toBe("warm"));
  it("social 3 is sand", () => expect(avatarTone(3)).toBe("sand"));
  it("social 4 is cool", () => expect(avatarTone(4)).toBe("cool"));
});

const cand = (id: string, explain: number, demo: boolean, slots: string[] = []): Candidate => ({
  candidate_id: id,
  first_name: id,
  is_demo: demo,
  archetype: "spark",
  likert: { explain, silence: 3, plan: 3, social: 3 },
  looking_for: "review",
  time_slots: slots,
  tags: [],
  shared_course_ids: ["c1"],
  next_session: null,
});
const me: Me = {
  likert: { explain: 5, silence: 3, plan: 3, social: 3 },
  lookingFor: "review",
  timeSlots: ["evening"],
  tags: [],
  upcomingExamCourseIds: ["c1"],
};

describe("pickMatch", () => {
  it("review prefers an explain difference of at least 2", () =>
    expect(pickMatch(me, [cand("near", 4, true), cand("far", 1, true)])?.candidate_id).toBe("far"));
  it("real students win over demo students", () =>
    expect(pickMatch(me, [cand("demo", 1, true), cand("real", 5, false)])?.candidate_id).toBe("real"));
  it("ties break on overlapping time slots", () =>
    expect(pickMatch(me, [cand("a", 1, true), cand("b", 1, true, ["evening"])])?.candidate_id).toBe("b"));
  it("returns null when nobody shares a course", () => expect(pickMatch(me, [])).toBeNull());
});
