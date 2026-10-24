import { describe, expect, it } from "vitest";
import { compatibility, matchLabel, whyLine, type DeckCandidate, type Profile } from "./compat";

const me: Profile = {
  likert: { explain: 5, silence: 3, plan: 3, social: 3 },
  lookingFor: "review",
  groupSize: "pair",
  places: ["library"],
  timeSlots: ["evening"],
  tags: ["Coffee", "Hiking"],
  languages: ["italiano"],
};
const base: DeckCandidate = {
  id: "x",
  firstName: "Marta",
  likert: { explain: 1, silence: 3, plan: 3, social: 3 },
  lookingFor: "review",
  groupSize: "pair",
  places: ["library"],
  timeSlots: ["evening"],
  tags: ["Coffee", "Hiking"],
  languages: ["italiano"],
  sharedCourseIds: ["a1"],
};

describe("compatibility", () => {
  it("perfect pair with shared upcoming exam scores 100", () => {
    expect(compatibility(me, { ...base, sharedCourseIds: ["a1", "f1"] }, ["a1"])).toBe(100);
  });
  it("no shared course loses the 30% course weight", () => {
    expect(compatibility(me, { ...base, sharedCourseIds: [] }, ["a1"])).toBe(70);
  });
  it("review needs explain difference of at least 2", () => {
    const similar = { ...base, likert: { ...base.likert, explain: 4 } };
    expect(compatibility(me, similar, ["a1"])).toBe(compatibility(me, base, ["a1"]) - 25);
  });
  it("no overlapping slots loses 20", () => {
    expect(compatibility(me, { ...base, timeSlots: ["morning"] }, ["a1"])).toBe(compatibility(me, base, ["a1"]) - 20);
  });
  it("label threshold", () => {
    expect(matchLabel(65)).toBe("great");
    expect(matchLabel(64)).toBe("good");
  });
});

describe("whyLine", () => {
  const s = {
    courseAndSlot: (c: string, sl: string) => `You're both preparing ${c} and study in the ${sl}.`,
    course: (c: string) => `You're both preparing ${c};`,
    theyExplain: (n: string) => `${n} prefers explaining, you prefer listening`,
    youExplain: (n: string) => `you prefer explaining, ${n} prefers listening`,
    slot: (sl: string) => `You both study in the ${sl}.`,
    tag: (tg: string) => `You're both into ${tg}.`,
    lookingFor: (l: string) => `You're both looking for ${l}.`,
    fallback: "A new face to study with.",
  };
  const id = (x: string) => x;
  it("uses shared course and time slot", () => {
    expect(whyLine(me, base, { a1: "Analisi Matematica 1" }, id, id, s)).toBe(
      "You're both preparing Analisi Matematica 1 and study in the evening.",
    );
  });
  it("falls back to explain contrast when no course or slot", () => {
    expect(whyLine(me, { ...base, sharedCourseIds: [], timeSlots: [] }, {}, id, id, s)).toBe(
      "You prefer explaining, Marta prefers listening.",
    );
  });
});
