import { describe, expect, it } from "vitest";
import { EMPTY_FILTERS, isOnMap, matchesFilters, spreadAround, type LiveSession } from "./live";

const s = (p: Partial<LiveSession>): LiveSession => ({
  session_id: "s", user_id: "u", first_name: "A", is_demo: true, is_mine: false, archetype: null, social: 3, tags: [],
  university_id: "polimi", university_name: "PoliMi", program_name: null, program_year: 1, course_id: "c1",
  subject_label: "Analisi", general_subject: "math", activity: "exercises", place_kind: "venue", venue_id: "v",
  ends_at: new Date().toISOString(), open_to_invitations: true, ...p,
});

describe("map filters", () => {
  it("own course filter matches only that course", () => {
    const f = { ...EMPTY_FILTERS, subjects: ["course:c1"] };
    expect(matchesFilters(s({}), f)).toBe(true);
    expect(matchesFilters(s({ course_id: "c2" }), f)).toBe(false);
  });
  it("general subject filter matches by subject area", () =>
    expect(matchesFilters(s({ course_id: null }), { ...EMPTY_FILTERS, subjects: ["gen:math"] })).toBe(true));
  it("open-to-invitations-only hides closed sessions", () =>
    expect(matchesFilters(s({ open_to_invitations: false }), { ...EMPTY_FILTERS, openOnly: true })).toBe(false));
  it("home and online sessions never get a pin", () => {
    expect(isOnMap(s({ place_kind: "home", venue_id: null }))).toBe(false);
    expect(isOnMap(s({ place_kind: "online", venue_id: null }))).toBe(false);
    expect(isOnMap(s({}))).toBe(true);
  });
  it("several students at one venue are spread within ~30 m", () => {
    const [lat, lng] = spreadAround(45.478, 9.227, 1, 4);
    expect(Math.abs(lat - 45.478) + Math.abs(lng - 9.227)).toBeGreaterThan(0);
    expect(Math.abs(lat - 45.478)).toBeLessThan(0.0003);
  });
});
