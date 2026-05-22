import {
  AI_LIMITS,
  EXAM_RULES,
  FREE_TIER_LIMITS,
  STUDY_PLAN_LIMITS,
  SUPPORTED_LOCALES,
} from "@prawko/config";

export const siteNavigation = [
  { href: "/pricing", label: "Pricing" },
  { href: "/how-it-works", label: "How It Works" },
  { href: "/schools", label: "Schools" },
  { href: "/faq", label: "FAQ" },
  { href: "/support", label: "Support" },
] as const;

export const footerGroups = [
  {
    title: "Product",
    links: [
      { href: "/", label: "Home" },
      { href: "/pricing", label: "Pricing" },
      { href: "/how-it-works", label: "How It Works" },
      { href: "/schools", label: "Schools" },
    ],
  },
  {
    title: "Help",
    links: [
      { href: "/faq", label: "FAQ" },
      { href: "/support", label: "Support" },
      { href: "/lab", label: "Web Lab" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/legal/privacy", label: "Privacy" },
      { href: "/legal/terms", label: "Terms" },
      { href: "/admin", label: "Admin Foundation" },
    ],
  },
] as const;

export const landingStats = [
  {
    label: "Exam format",
    value: `${EXAM_RULES.totalQuestions} questions / ${EXAM_RULES.durationMinutes} min`,
    detail: `${EXAM_RULES.passingPoints}+ points to pass`,
  },
  {
    label: "Supported languages",
    value: SUPPORTED_LOCALES.join(" / ").toUpperCase(),
    detail: "UI and explanations can stay bilingual from day one",
  },
  {
    label: "Plan window",
    value: `${STUDY_PLAN_LIMITS.minDays}-${STUDY_PLAN_LIMITS.maxDays} days`,
    detail: "Designed for dense exam sprints, not endless subscriptions",
  },
  {
    label: "Free AI cap",
    value: `${AI_LIMITS.freeQuestionChatPerDay} questions a day`,
    detail: "Enough to prove value before the paywall",
  },
] as const;

export const landingHighlights = [
  {
    eyebrow: "Daily path",
    title: "A real study plan, not a bucket of random questions",
    description:
      "The user picks the exam date and minutes per day. The app turns it into a day-by-day queue with topic blocks, weak-spot reviews, mini tests, and full exam days.",
  },
  {
    eyebrow: "Hard question loop",
    title: "Rare and painful questions come back until they stick",
    description:
      "Wrong answers, hard questions, and almost-mastered items get their own repeat modes instead of disappearing after one lucky attempt.",
  },
  {
    eyebrow: "Explain why",
    title: "AI covers the screenshot-to-ChatGPT behavior inside the product",
    description:
      "When a student does not understand the answer, they can ask why this option is correct and why the others are wrong without leaving the app.",
  },
  {
    eyebrow: "Two channels",
    title: "Direct purchase and school codes can coexist cleanly",
    description:
      "The same product supports a self-serve sprint offer and a school-issued code with a predictable entitlement flow.",
  },
] as const;

export const howItWorksSteps = [
  {
    title: "Set the exam date",
    description:
      "Choose when the student wants to sit the Polish theory exam and how many minutes they can really commit each day.",
  },
  {
    title: "Generate the path",
    description:
      "Prawko builds a realistic plan with learn-topic blocks, weak-spot sessions, mini tests, and full exam simulator days.",
  },
  {
    title: "Study adaptively",
    description:
      "Hard questions, saved questions, and recent mistakes feed the next sessions automatically instead of being lost in the catalog.",
  },
  {
    title: "Adjust when life happens",
    description:
      "Skipped days and changed exam dates trigger plan adjustments so the plan keeps moving instead of silently breaking.",
  },
] as const;

export const readinessFactors = [
  {
    eyebrow: "Simple score",
    title: "Recent accuracy",
    description:
      "The score leans on the last attempts instead of old lucky streaks.",
  },
  {
    eyebrow: "Simple score",
    title: "Unresolved weak spots",
    description:
      "Questions that stay wrong or unstable keep the readiness signal honest.",
  },
  {
    eyebrow: "Simple score",
    title: "Exam simulator results",
    description:
      "Recent exam runs matter more than isolated question wins.",
  },
  {
    eyebrow: "Simple score",
    title: "Plan completion ratio",
    description:
      "If the student skips most planned days, the score reflects it instead of pretending they are ready.",
  },
] as const;

export const taskTypes = [
  {
    eyebrow: "Task type",
    title: "Learn topic block",
    description:
      "Focused work on one topic instead of endless mixed drilling.",
  },
  {
    eyebrow: "Task type",
    title: "Review weak spots",
    description:
      "A short, high-value loop for unstable and repeatedly missed questions.",
  },
  {
    eyebrow: "Task type",
    title: "Mini test",
    description:
      "Fast confidence check when the student only has 10-15 minutes.",
  },
  {
    eyebrow: "Task type",
    title: "Full exam",
    description:
      "A realistic rehearsal against the official structure and time pressure.",
  },
] as const;

export const pricingTiers = [
  {
    badge: "Starter",
    title: "Free preview",
    price: "0 PLN",
    subtitle: "Enough to feel the product before paying",
    features: [
      `${FREE_TIER_LIMITS.questionPracticePerDay} questions per day`,
      "Daily plan preview",
      "AI explanations with daily cap",
      "No unlimited simulator access",
    ],
  },
  {
    badge: "Core offer",
    title: "Exam Sprint",
    price: "Pilot offer",
    subtitle: "Built for the dense final 14 days before the exam",
    features: [
      "Unlimited question practice",
      "Full simulator access",
      "Adaptive weak-spot modes",
      "AI explanation flow inside the app",
    ],
  },
  {
    badge: "Flexible",
    title: "Premium 30",
    price: "Pilot offer",
    subtitle: "For students who want a longer runway and calmer pacing",
    features: [
      "Everything in Sprint",
      "Longer plan horizon",
      "More room for skipped-day adjustment",
      "Better fit for first-time learners",
    ],
  },
  {
    badge: "B2B",
    title: "School access",
    price: "Custom",
    subtitle: "Issued as codes by driving schools",
    features: [
      "Bulk code distribution",
      "Predictable access window",
      "Bilingual student onboarding",
      "Pilot rollout for immigrant-focused schools",
    ],
  },
] as const;

export const faqItems = [
  {
    question: "Who is Prawko for right now?",
    answer:
      "The first version is optimized around Category B theory prep in Poland, especially for students who want a guided sprint before the exam instead of months of passive drilling.",
  },
  {
    question: "Which languages are supported?",
    answer:
      "The product is designed around Polish, Ukrainian, and English so the interface, question context, and explanations can stay understandable for foreign students in Poland.",
  },
  {
    question: "Does it replace the official exam?",
    answer:
      "No. It prepares the student for the real format: 32 questions, 25 minutes, and a pass threshold above 68 points. The simulator exists to rehearse the pressure, not to pretend the real exam is inside the app.",
  },
  {
    question: "Why is the study plan the main feature?",
    answer:
      "Because the real pain is not lack of questions. It is lack of structure. Most students already have access to question banks, but they still study randomly and do not know what to do today.",
  },
  {
    question: "How do school codes work?",
    answer:
      "A school issues a code, the student redeems it in the app, and the entitlement bypasses the standard paywall. That keeps B2B and direct purchase inside one product.",
  },
  {
    question: "What happens if the student skips a day?",
    answer:
      "The plan can be adjusted instead of silently failing. Future tasks get reshaped, and the minimum-mode path keeps momentum when the user only has a few minutes.",
  },
  {
    question: "Can the AI explain why an answer is correct?",
    answer:
      "Yes. That is one of the core reasons the app exists. The student should not have to take screenshots and leave the product just to understand a confusing question.",
  },
  {
    question: "Is the app fully offline?",
    answer:
      "No. Question media can be heavy, especially video, so the product assumes network access for the full experience while still keeping the learning flow lightweight and fast.",
  },
] as const;

export const schoolBenefits = [
  {
    eyebrow: "Distribution",
    title: "Bulk access through redeemable codes",
    description:
      "Schools can issue time-boxed access codes instead of manually creating accounts or handling one-off billing for every student.",
  },
  {
    eyebrow: "Student fit",
    title: "Better offer for Ukrainian and Belarusian students",
    description:
      "The messaging, language support, and AI explanation flow are built around the exact pain foreign students hit while preparing in Poland.",
  },
  {
    eyebrow: "Operations",
    title: "A simpler support surface",
    description:
      "One school flow, one entitlement model, one place to understand whether the student is blocked by billing, content, or plan quality.",
  },
  {
    eyebrow: "Pilot",
    title: "Designed to win the first 3-5 partner schools",
    description:
      "The v1 web layer is there to help school conversations close faster, not to become a second full learning product.",
  },
] as const;

export const schoolRolloutSteps = [
  {
    title: "Agree the pilot",
    description:
      "Pick cohort size, access duration, and who inside the school owns student support.",
  },
  {
    title: "Issue codes",
    description:
      "Students receive a code and unlock the right entitlement without a manual support loop.",
  },
  {
    title: "Track problem points",
    description:
      "Question import health, support requests, and AI review queues become visible in the admin foundation.",
  },
  {
    title: "Scale only after proof",
    description:
      "The goal is not broad SEO first. The goal is a product schools want to recommend because it solves the actual prep pain better.",
  },
] as const;

export const supportCards = [
  {
    eyebrow: "Student support",
    title: "Question or access issue",
    description:
      "Use support for billing, code redemption, and suspicious question content.",
  },
  {
    eyebrow: "School support",
    title: "Pilot or rollout inquiry",
    description:
      "Use the school channel for bulk access, launch support, and custom pilot terms.",
  },
  {
    eyebrow: "Content quality",
    title: "Report a confusing question",
    description:
      "Attach the question id, chosen answer, and what felt wrong so the review queue can act on something concrete.",
  },
  {
    eyebrow: "Reliability",
    title: "App bug or AI fallback issue",
    description:
      "Include device, platform, and a short repro path. The faster the repro, the faster the fix.",
  },
] as const;

export const adminModules = [
  {
    eyebrow: "Next slice",
    title: "Users summary",
    description:
      "Quick pulse on signups, active learners, and plan creation without opening SQL every time.",
  },
  {
    eyebrow: "Next slice",
    title: "School code management",
    description:
      "Create, review, and revoke school codes from one place instead of patching data manually.",
  },
  {
    eyebrow: "Next slice",
    title: "Question import health",
    description:
      "See whether the pipeline last ran cleanly and whether media delivery is out of date.",
  },
  {
    eyebrow: "Next slice",
    title: "AI review queue",
    description:
      "Catch bad explanations, provider errors, and manual review candidates before they become trust damage.",
  },
] as const;
