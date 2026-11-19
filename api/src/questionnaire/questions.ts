/**
 * v2 questionnaire — the single source of truth.
 *
 * The seed, the Zod validator, the scorer's ordinal lookups and the LLM
 * prompt snippet all read this module. Option order is meaningful: ordinal
 * questions are compared by index (see matching/scorer.ts).
 *
 * `shared` is opt-in and default-deny: only `shared: true` answers may be
 * shown to a match or sent to OpenAI. Items are written for Ons and modelled
 * on ECR-S (attachment) and BFI-10 (personality); they are not those scales.
 */

import type { Question, QuestionOption, Section } from "../models/questionnaire.model.js";

export const QUESTIONNAIRE_VERSION = "2.0.0";

type Extra = Partial<Pick<Question, "shared" | "sensitive" | "required" | "placeholder" | "maxSelect">>;

/** `[value, label]` pairs, or a bare string when the stored value is the label. */
type Opt = string | [value: string, label: string];

const opts = (list: Opt[]): QuestionOption[] =>
  list.map((o) => (typeof o === "string" ? { value: o, label: o } : { value: o[0], label: o[1] }));

const base = (id: string, label: string, type: Question["type"], extra: Extra = {}): Omit<Question, "order"> => ({
  id, label, type, sensitive: false, required: true, ...extra,
});

const text = (id: string, label: string, extra: Extra = {}) => base(id, label, "text", extra);
const select = (id: string, label: string, options: Opt[], extra: Extra = {}) =>
  ({ ...base(id, label, "select", extra), options: opts(options) });
const agree = (id: string, label: string) => ({ ...base(id, label, "range"), min: 1, max: 5 });

const section = (id: string, title: string, order: number, questions: Omit<Question, "order">[]): Section => ({
  id, title, order, questions: questions.map((q, i) => ({ ...q, order: i + 1 })),
});

const S = { shared: true } as const;

const PARTNER_HABIT: Opt[] = [["fine", "Fine with me"], ["rather_not", "I'd rather not"], ["deal_breaker", "A deal breaker"]];
const HABIT: Opt[] = [["never", "Never"], ["sometimes", "Sometimes"], ["regularly", "Regularly"]];

export const SECTIONS: Section[] = [
  section("identity", "About you", 1, [
    text("first_name", "First name", { sensitive: true, placeholder: "Your first name" }),
    text("last_name", "Last name", { sensitive: true, placeholder: "Your last name" }),
    text("instagram_handle", "Instagram handle", { sensitive: true, placeholder: "@yourhandle" }),
  ]),
  section("basics", "Basics", 2, [
    text("location", "Where are you based?", { ...S, placeholder: "City, Country" }),
    base("birth_date", "Birth date", "date"),
    select("gender_identity", "How do you identify?", ["Male", "Female", "Non-binary", "Other"]),
    select("sexual_orientation", "Who are you attracted to?", ["Straight", "Gay", "Bisexual", "Other"]),
    select("religion", "What is your religion?", [
      ["muslim", "Muslim"], ["christian", "Christian"], ["jewish", "Jewish"],
      ["spiritual", "Spiritual, not religious"], ["not_religious", "Not religious"],
      ["other", "Other"], ["prefer_not_to_say", "Prefer not to say"],
    ], S),
    select("religion_practice", "How much is faith part of your daily life?", [
      ["not_at_all", "Not at all"], ["a_little", "A little"], ["quite_a_lot", "Quite a lot"], ["central", "It is central"],
    ], S),
  ]),
  section("essentials", "The essentials", 3, [
    select("relationship_type", "What are you looking for?", [
      ["Long Term", "Long term"], ["Short Term", "Short term"], ["Open to Both", "Open to both"],
      ["Casual", "Casual"], ["Not Sure", "Not sure"],
    ], S),
    select("wants_children", "Do you want children?", [
      ["want", "Want children"], ["open", "Open to it"], ["dont_want", "Don't want children"], ["not_sure", "Not sure yet"],
    ], S),
    select("smoking", "Do you smoke?", HABIT, S),
    select("partner_smoking", "A partner who smokes is…", PARTNER_HABIT),
    select("alcohol", "Do you drink alcohol?", HABIT, S),
    select("partner_alcohol", "A partner who drinks is…", PARTNER_HABIT),
    select("religion_match", "A partner with a different faith is…", [
      ["fine", "Fine with me"], ["rather_share", "I'd rather share a faith"], ["deal_breaker", "A deal breaker"],
    ]),
    base("open_to_long_distance", "Are you open to long distance?", "boolean"),
    select("age_gap", "Biggest age gap you are comfortable with?", [
      ["3", "3 years"], ["5", "5 years"], ["10", "10 years"], ["any", "No limit"],
    ]),
    select("age_direction", "Older or younger?", [
      ["either", "Either"], ["older", "Older than me"], ["younger", "Younger than me"],
    ]),
  ]),
  section("values", "Values", 4, [
    {
      ...base("top_values", "Pick the three that matter most to you", "multiselect", S),
      maxSelect: 3,
      options: opts([
        ["family", "Family"], ["faith", "Faith"], ["career", "Career and ambition"],
        ["adventure", "Adventure and freedom"], ["stability", "Stability and security"],
        ["growth", "Learning and growth"], ["helping", "Helping others"], ["fun", "Fun and enjoyment"],
      ]),
    },
  ]),
  section("lifestyle", "Lifestyle", 5, [
    select("social_energy", "Your ideal weekend?", [
      ["home", "Quiet time at home"], ["small_circle", "A small circle of friends"],
      ["mix", "A mix of both"], ["big_crowd", "Out with lots of people"],
    ], S),
    select("sleep_rhythm", "Early bird or night owl?", [
      ["early", "Early bird"], ["between", "Somewhere in between"], ["night", "Night owl"],
    ], S),
    select("activity_level", "How active are you?", [
      ["rarely", "I rarely exercise"], ["weekly", "Once or twice a week"], ["most_days", "Most days"],
    ], S),
    select("planning_style", "Plans or spontaneity?", [
      ["plan_all", "I plan everything"], ["mostly_plan", "I mostly plan"],
      ["mostly_spontaneous", "Mostly spontaneous"], ["spontaneous", "Fully spontaneous"],
    ], S),
    select("money_style", "With money, you are more of a…", [
      ["saver", "Saver"], ["between", "Somewhere in between"], ["spender", "Spender"],
    ], S),
    select("opposite_gender_friends", "A partner having close friends of the opposite gender is…", [
      ["fine", "Fine with me"], ["depends", "It depends"], ["not_ok", "Not okay"],
    ]),
  ]),
  section("connection", "How you connect", 6, [
    agree("attach_anxiety_1", "I worry a partner won't care about me as much as I care about them."),
    agree("attach_anxiety_2", "I need a lot of reassurance that I am loved."),
    agree("attach_avoidance_1", "I prefer not to depend on a partner."),
    agree("attach_avoidance_2", "I get uncomfortable when someone wants to be very close."),
    select("conflict_style", "When you disagree with a partner, you usually…", [
      ["talk_now", "Talk it out right away"], ["cool_off", "Cool off first, then talk"],
      ["let_go", "Let it go to keep the peace"], ["avoid", "Avoid the subject"],
    ], S),
    select("physical_affection", "How important is physical affection to you?", [
      ["not_important", "Not important"], ["a_little", "A little"], ["quite", "Quite important"], ["essential", "Essential"],
    ], S),
    select("contact_frequency", "How often do you like to be in touch?", [
      ["all_day", "All through the day"], ["few_times", "A few times a day"],
      ["once", "Once a day"], ["when_needed", "When there is something to say"],
    ], S),
  ]),
  section("personality", "Personality", 7, [
    agree("p_calm", "I stay calm under stress."),
    agree("p_trust", "I tend to trust people easily."),
    agree("p_thorough", "I finish what I start."),
    agree("p_open", "I love trying new things."),
  ]),
  section("final", "Last step", 8, [
    text("note_to_match", "One thing you would love a match to know?", { required: false, placeholder: "e.g. I make a great couscous" }),
    base("disclaimer_agreed",
      "I agree that my data will be used solely for the purpose of this matching exercise and will be handled with care.",
      "boolean"),
  ]),
];

export const QUESTIONS: Question[] = SECTIONS.flatMap((s) => s.questions);

const BY_ID = new Map(QUESTIONS.map((q) => [q.id, q]));

export const SHARED_QUESTION_IDS: ReadonlySet<string> = new Set(QUESTIONS.filter((q) => q.shared).map((q) => q.id));

/** Religions a "same faith" comparison can confirm; `other` / `prefer_not_to_say` never match. */
export const NAMED_RELIGIONS: ReadonlySet<string> = new Set(["muslim", "christian", "jewish", "spiritual", "not_religious"]);

export function questionById(id: string): Question | undefined {
  return BY_ID.get(id);
}

/** Position of `value` in the question's option order, or -1 if unknown. */
export function optionIndex(id: string, value: unknown): number {
  return BY_ID.get(id)?.options?.findIndex((o) => o.value === value) ?? -1;
}

export function optionCount(id: string): number {
  return BY_ID.get(id)?.options?.length ?? 0;
}

/** English label for a stored value; falls back to the raw value. */
export function optionLabel(id: string, value: unknown): string {
  return BY_ID.get(id)?.options?.find((o) => o.value === value)?.label ?? String(value);
}
