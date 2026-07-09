# Mobile Tabs Product Direction

## Goal

The mobile tabs should feel like a learner-facing app, not an internal beta dashboard.

Each tab needs a clear job:

- `Сьогодні`: what should I do right now?
- `Теми`: what can I learn by topic?
- `Практика`: how can I do extra practice?
- `Профіль`: what is my account, plan, and access state?

The most important product principle is to reduce decisions. The app should guide the learner toward the next useful action, not expose every internal queue, metric, or implementation detail.

## Today Goal

The `Сьогодні` screen should answer one user question:

> What should I do right now?

Today should feel like a simple daily coach, not a diagnostics dashboard. The user should open the app, understand the next learning action within a few seconds, and start it from one primary button.

## Current Today Problem

The current screen exposes too much internal product and learning-state logic. Concepts like readiness breakdown, score components, remote progress, weak spot counts, review hygiene, plan components, and AI modal access are useful internally, but they make the home experience feel technical.

For a learner, this creates unnecessary decisions:

- What does this score mean?
- Which metric matters most?
- Should I open practice, AI, plan preview, or today's task?
- Is this a status page or a start-learning page?

The main screen should reduce cognitive load instead of explaining the whole system.

## Recommended Today Mental Model

Use this model:

> Open app -> see today's focus -> press start.

Everything on the screen should support that path. Secondary information can exist, but it should not compete with the primary action.

## Recommended Today Structure

### 1. Daily Focus

Show one clear summary at the top:

```text
Сьогодні: Знаки пріоритету
20 хвилин · 15 питань
```

This can be based on the first incomplete task or the strongest focus area for the current plan day.

### 2. Primary Action

Use one dominant button:

```text
Почати сьогоднішнє заняття
```

The button should open the next incomplete actionable task. If a task is already in progress, it should resume that task.

### 3. Day Progress

Show progress in simple daily terms:

```text
Виконано 1 з 3 задач
```

A small progress bar would be enough. Avoid readiness percentages on this screen.

### 4. Human Task List

Show today's tasks as plain learning actions:

```text
Вивчити тему: Знаки пріоритету
Пройти 15 питань
Повторити 5 помилок
```

Each item should be readable without knowing internal task types. Keep completion state visible, but do not expose technical metadata unless it helps the learner.

### 5. Completed State

When all daily tasks are done, switch the screen tone:

```text
Гарна робота. На сьогодні план виконано.
```

Secondary action:

```text
Додаткова практика
```

This keeps the primary daily loop complete while still allowing motivated users to continue.

### 6. Empty State

If the user has no plan, avoid showing `0%` or technical fallback language.

Use:

```text
У тебе ще немає плану навчання
Створити план
```

The empty state should guide the user toward setup, not explain missing data.

## What To Remove From Today

The following items should not be prominent on the main Today screen:

- Readiness snapshot
- Readiness score breakdown
- Accuracy component / plan component wording
- Raw due review and weak spot counters
- Remote progress or fallback terminology
- Plan preview terminology after onboarding
- `remaining flow`, `minimum mode`, and other generator language
- AI modal entry point as a main Today action
- Practice entry point as a peer to the main daily action

Some of this can move to a separate progress or profile screen where users intentionally inspect their learning state.

## Learn Tab Direction

The `Теми` tab is mostly on the right track. Its job should be simple:

> Choose a topic and continue learning.

Current useful elements:

- Topic cards
- Per-topic progress
- Start or continue action
- A lightweight overall progress summary

What to remove or rewrite:

- Avoid copy like `реальний прогрес` and `локальна черга питань`.
- Replace `weak spots` with learner language like `потребує повторення`.
- Avoid showing too many raw stats in every topic card.
- Do not make `review due`, `seen`, `mastered`, and `weak` all equally prominent.

Recommended structure:

- Header: `Теми для навчання`
- Optional summary: `Ти вже бачив 120 з 800 питань`
- Topic card title
- One progress bar
- One human status, for example `Почато`, `Добре просуваєшся`, or `Потрібно повторити`
- One button: `Продовжити тему` or `Почати тему`

The topic tab can contain more detail than Today, but it should still read like learning progress, not analytics.

## Practice Tab Direction

The `Практика` tab currently exposes too many modes at once. It feels like a menu of internal queues:

- Exam simulator
- Wrong answers
- Weak spots
- Hard questions
- Seen, not mastered
- Saved questions
- Saved sprint
- Exam tomorrow
- Recent exam sessions
- Paywall

This is too much for a learner to parse. Practice should answer:

> What kind of extra practice do I want?

Recommended first-level modes:

- `Іспит`
- `Повторити помилки`
- `Збережені питання`
- `Швидка практика`

What to remove from the first level:

- `Hard questions`
- `Seen, not mastered`
- `Saved sprint`
- `Exam tomorrow`, unless the exam is actually tomorrow or very close
- `Open paywall`
- `Review queue` snapshot
- Internal words like `queue`, `replay`, `mastery`, `simulator`, and `session`

Recent exams can stay, but should be compact:

```text
Останній іспит: складено
Результат: 68 / 74
```

The detailed history can live behind a separate action like `Історія іспитів`.

## Profile Tab Direction

The `Профіль` tab is currently the most debug-oriented screen. It mixes real account settings with developer state.

Current user-facing items worth keeping:

- Name and email
- Language
- Category
- Active plan
- Exam date
- Access status
- School access, if active
- Purchase or premium status
- PJM switch, if this is a real learner preference
- Manage access
- Sign out

What to remove from the normal user profile:

- `Auth mode`
- `Supabase env`
- `RevenueCat env`
- `Каталог питань`
- Catalog status, count, and error
- `Mock fallback`
- `Supabase remote`
- `Remote fallback`
- `Reset shell state`
- `Open paywall`
- `Open AI modal`
- `Plan Preview` wording

Recommended structure:

- Account
- Learning settings
- Current plan
- Access
- Accessibility options
- Sign out

Developer/debug state should move behind a hidden dev screen or only appear in development builds.

## Global Copy Cleanup

The following terms should not appear in normal learner-facing copy:

- `remote`
- `shell`
- `auth mode`
- `env`
- `mock`
- `fallback`
- `preview`, after onboarding is complete
- `AI modal`
- `paywall`
- `queue`
- `weak spots`
- `hard state`
- `mastery`
- `simulator`
- `session`, except in detailed exam history
- `remaining flow`
- `minimum mode`

Use learner language instead:

- `План навчання`
- `Повторення`
- `Помилки`
- `Складні питання`
- `Додаткова практика`
- `Доступ`
- `Преміум`
- `Історія іспитів`

## Suggested Information Architecture

Keep `Сьогодні` focused on execution:

- Daily focus
- Start/resume button
- Today's task list
- Simple daily progress
- Friendly completed or empty state

Move deeper analytics elsewhere:

- Progress screen: readiness, accuracy, plan progress, exams, weak spots
- Practice screen: extra modes, review queues, exam simulator
- Profile/settings: plan rebuild, plan metadata, account state
- AI entry point: contextual inside a question or as a secondary support feature

Recommended final tab responsibilities:

- `Сьогодні`: daily focus, start/resume, daily tasks, simple progress
- `Теми`: topic browsing and topic progress
- `Практика`: a small set of extra practice modes
- `Профіль`: account, plan, access, settings

## Product Principle

If a piece of information does not help the user decide what to do next today, it probably does not belong on `Сьогодні`.

For other tabs, the same rule applies in a slightly broader form:

> If a piece of information does not help the user choose or understand an action in that tab, hide it, simplify it, or move it to a deeper screen.

