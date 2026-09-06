# Prawko — First Session / Diagnostic Flow

## Цель

Первая сессия:

**onboarding → dashboard → diagnostic 10 questions → useful result → notification permission → ad → dashboard**

После неё пользователь должен понимать:

**Prawko уже понял, где у меня слабые места, и дальше будет учитывать это в обучении.**

Dashboard layout не переделываем.

---

# TASK 1 — убрать notification permission из onboarding

### Сейчас

Onboarding:

1. Driving category
2. Exam date
3. Notifications
4. Dashboard

### Должно стать

1. Driving category
2. Exam date
3. Dashboard

Экран notifications полностью убрать из onboarding flow.

Не вызывать system notification permission во время onboarding.

### Exam date

Оставить текущий экран.

Под input добавить:

> Dopasujemy naukę do terminu Twojego egzaminu.

Для пользователя без даты оставить возможность пропустить:

> Jeszcze nie wiem

---

# TASK 2 — изменить tooltip первого dashboard

Tooltip появляется пользователю, который закончил onboarding, но ещё не прошёл initial diagnostic.

Существующий UI tooltip не менять.

### Новый copy

**Title**

> Find your starting point

**Description**

> 10 quick questions. We'll find your weak areas and personalize your practice.

**CTA**

> Check my level

Польский:

**Title**

> Sprawdź swój poziom

**Description**

> 10 krótkich pytań. Znajdziemy Twoje słabsze obszary i dopasujemy dalszą naukę.

**CTA**

> Sprawdź mój poziom

`Later` оставить.

При `Later` просто закрыть tooltip.

---

# TASK 3 — Initial Diagnostic должен отличаться от обычного Training

Создать отдельный тип первой диагностической сессии:

```text
INITIAL_DIAGNOSTIC
10 questions
no timer
```

Не брать просто 10 полностью случайных вопросов.

Цель — за 10 вопросов максимально широко проверить знания пользователя.

## Предпочтительный mix

```text
2 × Signs & Signals

2 × Intersections / Right of Way

1 × Speed / Road position / Manoeuvres

1 × Vulnerable Road Users

1 × Safety / Emergency / First Aid

1 × Vehicle / Technical / Driving rules

1 × Passenger / Cargo / General regulations

1 × visual/video traffic situation
```

Последний visual/video question может относиться к одной из категорий выше.

Главное — чтобы среди первых 10 был хотя бы один вопрос с реальной дорожной ситуацией / media.

---

## Selection rules

Для этих первых 10 вопросов:

1. без duplicate questions;
2. не использовать несколько почти одинаковых вопросов подряд;
3. брать достаточно типичные и полезные экзаменационные темы;
4. не перегружать initial diagnostic слишком редкими или специфическими вопросами;
5. внутри подходящих вопросов выбирать случайно.

Если невозможно идеально собрать указанный mix — собрать максимально близкий вариант.

Всегда должно быть ровно 10 вопросов.

---

# TASK 4 — собрать результат diagnostic

После прохождения 10 вопросов определить:

```text
correctCount
wrongCount
scorePercent
category performance
strongest areas
weakest areas
```

### Weak areas

Определить максимум **2 weak areas**.

Приоритет:

1. больше неправильных ответов;
2. ниже процент правильных ответов.

### Strong area

Определить максимум **1 strongest area**.

Не делать слишком категоричных выводов после всего 10 вопросов.

Не писать:

> You don't know intersections.

Использовать формулировки:

> Needs more attention

или:

> Focus area

---

# TASK 5 — не показывать рекламу после первых 10 diagnostic questions

Это относится **только к первым 10 вопросам INITIAL_DIAGNOSTIC**.

Сейчас первый diagnostic flow:

```text
10th diagnostic question
↓
Interstitial Ad
↓
Result
```

Изменить на:

```text
10th diagnostic question
↓
Result immediately
```

После ответа на 10-й вопрос первой диагностической сессии результат должен открываться сразу.

**Не показывать interstitial между первым diagnostic и его результатом.**

Это изменение не должно влиять на рекламу после обычных Training / Exam / других сессий.

---

# TASK 6 — переделать верх Result Screen для INITIAL_DIAGNOSTIC

Layout оставить максимально близким к текущему.

Но initial diagnostic не должен выглядеть как провал экзамена.

### Убрать как главный акцент

Большой красный:

> X
> 30%

### Вместо этого

**Title**

> Your starting point

Score оставить как вторичную информацию:

> 3 of 10 correct

или:

> 30% correct

Но не оформлять его как большой `FAIL` state.

---

# TASK 7 — добавить блок «что Prawko узнал»

На Result Screen после basic score добавить персональный diagnostic summary.

### Если есть weak areas

**Title**

> Focus areas

Показать максимум 2 категории:

```text
Intersections & Right of Way
Signs & Signals
```

Под ними:

> We'll use these results to personalize your practice.

### Если есть strong area

Можно показать:

**Strongest area**

> Road Signs

Но только если есть достаточно понятный результат.

---

## Copy в зависимости от результата

### 0–3 / 10

Не писать:

> Failed
> Poor
> Very low knowledge

Использовать:

> Good starting point — now we know what to focus on.

### 8–10 / 10

Использовать:

> Strong start. We'll focus more on the areas that still need attention.

---

# TASK 8 — существующий Questions block оставить

Текущий блок:

```text
Questions

1 ✓
2 ✗
3 ✗
...
10
```

оставить.

Переход к `Answers` / review тоже оставить.

Пользователь должен иметь возможность посмотреть конкретные ответы.

---

# TASK 9 — category statistics оставить, но показывать только проверенные категории

Текущий блок типа:

```text
Signs & Signals            25%
Intersections              0%
...
```

оставить.

Но отображать только категории, по которым пользователь реально получил вопросы в этих первых 10.

Не показывать категорию с `0%`, если она вообще не проверялась.

`0%` должно означать:

**был вопрос по категории, пользователь ответил неправильно.**

---

# TASK 10 — notification permission перенести после результата

После просмотра результата и нажатия основного CTA показать собственный notification pre-permission screen / bottom sheet.

### Copy

**PL**

> **Pomożemy Ci pamiętać o nauce**
>
> Przypomnimy o krótkiej sesji, kiedy będzie warto wrócić do pytań, z którymi miałeś problem.

Если пользователь указал дату экзамена, можно также показать:

> Twój egzamin: 24 września

Buttons:

**Włącz przypomnienia**

**Nie teraz**

### EN

> **Stay on track**
>
> We'll remind you when it's a good time to return to the questions that need more practice.

Buttons:

**Enable reminders**

**Not now**

---

## Behaviour

Только после:

> Enable reminders

вызывать native notification permission.

Если пользователь нажал:

> Not now

просто продолжить flow.

Не показывать notification prompt повторно в рамках первой сессии.

---

# TASK 11 — реклама остаётся в первой сессии, но показывается после результата

Итоговый порядок:

```text
10th INITIAL_DIAGNOSTIC question
↓
Result
↓
user sees diagnostic summary
↓
Continue
↓
notification pre-prompt
↓
native notification permission if accepted
↓
Interstitial Ad
↓
Dashboard
```

То есть реклама в первой сессии **остаётся**.

Меняется только её позиция.

Нельзя показывать её между первыми 10 diagnostic questions и результатом.

Если реклама:

- не загрузилась;
- вернула error;
- timeout;
- no fill;

не задерживать пользователя.

Сразу открыть dashboard.

---

# TASK 12 — основной CTA Result Screen

Для INITIAL_DIAGNOSTIC заменить основной:

> Work on mistakes

на:

**PL**

> Przejdź dalej

**EN**

> Continue

`Work on mistakes` оставить secondary action:

**PL**

> Powtórz błędy

**EN**

> Work on mistakes

### Behaviour

`Continue`

```text
notification pre-prompt
↓
ad
↓
dashboard
```

`Work on mistakes`

открывает существующий mistakes flow.

---

# TASK 13 — dashboard после diagnostic почти не менять

Текущий dashboard layout оставить полностью.

Не менять структуру:

- Readiness
- Quick session
- Training
- Exam
- Mistakes
- Traps

После завершённого initial diagnostic:

- больше не показывать initial diagnostic tooltip;
- `Mistakes` уже должен отражать ошибки из первых 10 вопросов;
- dashboard работает дальше как сейчас.

---

# Итоговый First Session Flow

```text
INSTALL
↓
Onboarding: category
↓
Onboarding: exam date / skip
↓
Dashboard
↓
Diagnostic tooltip
↓
INITIAL_DIAGNOSTIC
10 diversified questions
no timer
↓
Result immediately
NO AD between diagnostic and result
↓
Starting point
3/10 correct

Focus areas:
• Intersections
• Signs

Strongest area:
• Safety

Questions 1–10
Category breakdown
↓
Continue
↓
Notification pre-prompt
↓
Native notification permission
if accepted
↓
Interstitial
↓
Dashboard
```
