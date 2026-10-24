import type { it } from "./it";

type Shape<T> = { [K in keyof T]: T[K] extends string ? string : T[K] extends readonly (infer U)[] ? readonly Shape<U>[] : Shape<T[K]> };

export const en: Shape<typeof it> = {
  app: {
    name: "UniMate",
    tagline: "Organize your study time, understand your courses, review smarter, find people to study with.",
    partner: "In partnership with universities",
  },
  nav: { home: "Home", studio: "Study", mappa: "Map", persone: "People", chat: "Chat", signOut: "Sign out" },
  landing: {
    title: "Your semester, finally in order.",
    cta: "Sign in with your university email",
    goToApp: "Go to your Home",
    features: [
      { title: "Study time", text: "Plan your weeks around real classes and exams." },
      { title: "Clear courses", text: "Official topics with their weight, materials from your professor." },
      { title: "Study buddies", text: "Find people in your course to review with." },
    ],
  },
  auth: {
    signInTitle: "Welcome back",
    signUpTitle: "Create your account",
    subtitle: "Use your institutional email from a partner university.",
    fullName: "Full name",
    email: "University email",
    password: "Password",
    signIn: "Sign in",
    signUp: "Sign up",
    toSignUp: "No account yet? Sign up",
    toSignIn: "Already have an account? Sign in",
    domainNotAllowed: "This email doesn't belong to a partner university. Accepted domains:",
    checkEmail: "We sent you a confirmation email. Open the link to activate your account.",
    genericError: "Something went wrong. Please try again.",
    invalidCredentials: "Wrong email or password.",
  },
  home: {
    greeting: "Hi",
    yourCourses: "Your courses this semester",
    cfu: "CFU",
    nextExam: "Next exam",
    noExam: "No exam scheduled",
    professor: "Professor",
    year: "year",
    source: "Data provided by your university",
    addedByYou: "added by you",
    empty: "No courses found for your account.",
    teacherBadge: "Teacher",
  },
  placeholder: {
    soon: "Coming soon",
    studio: "Your personal study tutor. Conversations stay private.",
    mappa: "See where others study, only if you choose to.",
    persone: "Find study partners who match you.",
    chat: "Messages with your groups and study partners.",
  },
  weight: { high: "High weight", medium: "Medium weight", low: "Low weight" },
  demo: "Demo",
  meta: {
    homeDesc: "UniMate helps university students organize study time, understand courses and find study partners.",
  },
};
