использовать @gorhom/bottom-sheet пакет
модалка снизу должна быть написана так что с любого екрана её можно вызывать и закрыть, тоесть лежать на самом верхнем слое, и открыватся через зустанг, или контекст, тут реши сам как лучше

## План: Premium teaser + aggressive paywall flow

Существующий Premium paywall **не менять**.
Premium state уже есть — **не переделывать**.

Нужно добавить только:

1. Premium teaser.
2. Логику **в какие конкретные моменты** показывать teaser или сразу paywall.
3. Ограничение частоты внутри session.
4. Полную monetization analytics.
5. AdMob impression revenue analytics.

---

# 1. Premium teaser

Добавить небольшой bottom sheet/banner:

```text
Premium na zawsze — 24,99 zł
Bez reklam + pełny dostęp

[Zobacz Premium]
```

Цена берётся из RevenueCat.

Tap:

```text
→ открыть существующий Premium paywall
```

Dismiss:

```text
→ просто закрыть
```

---

# 2. Конкретные моменты показа

Не делать абстрактную eligibility policy типа «через 24 часа».

Нам нужна достаточно агрессивная monetization sequence.

### Первый запуск после onboarding

После onboarding пользователь попадает на Home.

**Ничего сразу не показывать.**

Пусть сначала реально попробует приложение.

---

### После первой завершённой training session

Когда пользователь:

```text
training_session_completed
```

и возвращается на результат/Home:

### показать Premium teaser.

Не full paywall.

Логика:

```text
finish training
→ показать result
→ через ~500–1000ms показать Premium teaser
```

---

### После второй завершённой training session

Если пользователь ещё не Premium:

### открыть сразу существующий Premium paywall.

То есть:

```text
finish second training
→ result screen
→ Premium modal
```

Без дополнительного teaser.

Это уже пользователь, который дважды получил value.

---

### После завершённого exam

После:

```text
exam_session_completed
```

показать результат экзамена.

После того как result screen полностью появился:

### открыть Premium paywall напрямую.

Не перекрывать сам момент результата до того, как пользователь увидел score.

Flow:

```text
Exam completed
→ show exam result
→ ~1 sec
→ Premium paywall
```

---

### После рекламы

Не после каждой рекламы.

Считать количество показанных interstitial в текущей session.

После:

```text
2nd ad shown + dismissed in current session
```

показать:

### Premium teaser.

После:

```text
4th ad shown + dismissed
```

открыть:

### Premium paywall directly.

То есть сама реклама создаёт естественный upgrade trigger:

```text
ad
ad
→ "убери рекламу навсегда"

ещё использование
ad
ad
→ full Premium paywall
```

---

# 3. При повторном открытии приложения

Вот здесь я бы был агрессивнее.

Если:

```text
не Premium
AND
это не первый-ever launch
AND
пользователь уже когда-либо завершил training/exam
```

то после открытия приложения:

```text
App opened
→ Home rendered
→ wait 800–1200ms
→ Premium teaser
```

То есть возвращающийся пользователь сразу видит ненавязчивое предложение.

Не показывать full paywall сразу при launch.

Только teaser.

---

# 4. Если пользователь уже видел paywall раньше

Не делать `24h cooldown`.

Это слишком медленно для приложения, которым человек может пользоваться интенсивно несколько дней перед экзаменом.

После dismiss full paywall:

### можно показать снова при следующем meaningful moment:

```text
next completed training
OR
next completed exam
OR
next app session
OR
after another 2 ads
```

Но не показывать два full paywall подряд в течение минуты.

---

# 5. Session limits

Чтобы aggressive не превратилось в broken UX:

### Premium teaser

Maximum:

```text
2 teaser shows / app session
```

Минимум между teaser:

```text
2 minutes
```

### Full paywall

Maximum:

```text
2 automatic paywall shows / app session
```

Минимум между automatic paywalls:

```text
5 minutes
```

Manual paywall из Profile не считать в этот limit.

То есть пользователь всегда может сам открыть Premium.

---

# 6. Priority, если одновременно сработало несколько моментов

Например пользователь завершил training и одновременно достиг лимита ads.

Не показывать два UI подряд.

Priority:

```text
exam_completed
>
training_completed
>
ad_threshold
>
app_open
```

На один moment — максимум один monetization surface.

Если moment требует full paywall:

```text
не показывать teaser
```

---

# 7. Analytics — конкретно что и когда отправлять

Нужно не просто добавить event names, а отправлять их строго в следующих местах.

---

## `premium_prompt_shown`

Отправить **в момент, когда teaser реально появился на экране**.

Не когда policy решила его показать.

```text
premium_prompt_shown
```

Properties:

```text
source
moment

session_id

ads_shown_session
ads_shown_lifetime

training_completed_session
training_completed_lifetime

exam_completed_lifetime

questions_answered_lifetime

days_since_install
active_days

price
currency
product_id
```

`moment`:

```text
after_first_training
after_ad_2
app_open
manual_test
```

---

## `premium_prompt_clicked`

Отправить **когда пользователь нажал teaser / CTA**.

```text
premium_prompt_clicked
```

Properties:

```text
source
moment

time_visible_ms

price
currency
product_id
```

После этого открыть existing paywall.

---

## `premium_prompt_dismissed`

Когда пользователь:

```text
tap X
swipe down
tap outside
```

и teaser реально закрывается.

Properties:

```text
source
moment
dismiss_method
time_visible_ms
```

`dismiss_method`:

```text
close_button
swipe
outside_tap
```

---

# 8. `paywall_viewed`

Отправлять только когда существующий paywall **реально появился пользователю**.

Не при вызове navigation.

```text
paywall_viewed
```

Properties:

```text
source
moment
presentation

price
currency
product_id
offering_id

ads_shown_session
ads_shown_lifetime

training_completed_lifetime
exam_completed_lifetime
questions_answered_lifetime

days_since_install
active_days
```

`presentation`:

```text
modal
```

`source`:

```text
premium_prompt
automatic
profile
```

`moment`:

```text
after_second_training
after_exam
after_ad_4
premium_prompt
profile
```

---

# 9. `paywall_dismissed`

В момент, когда paywall закрывается **без successful purchase**.

```text
paywall_dismissed
```

Properties:

```text
source
moment

dismiss_method
time_visible_ms

price
currency
product_id
```

Важно:

если purchase succeeded и после этого modal закрывается —

### `paywall_dismissed` не отправлять.

---

# 10. `purchase_started`

Отправить непосредственно при нажатии CTA покупки, **перед RevenueCat purchase call**.

```text
purchase_started
```

Properties:

```text
source
moment

product_id
offering_id
package_id

price
currency
```

---

# 11. `purchase_succeeded`

Только после того, как RevenueCat вернул успешный результат и entitlement Premium active.

```text
purchase_succeeded
```

Properties:

```text
source
moment

product_id
offering_id
package_id

price
currency

transaction_id
```

После этого existing logic отключает ads.

---

# 12. `purchase_cancelled`

Если RevenueCat возвращает user cancellation:

```text
purchase_cancelled
```

Properties:

```text
source
moment

product_id
price
currency
```

Cancellation **не считать error**.

---

# 13. `purchase_failed`

Только настоящая ошибка RevenueCat / StoreKit.

```text
purchase_failed
```

Properties:

```text
source
moment

product_id
price
currency

error_code
error_message
```

---

# 14. Restore

При tap Restore:

```text
restore_started
```

После RevenueCat:

```text
restore_succeeded
```

или:

```text
restore_failed
```

Для success:

```text
entitlement_active = true/false
```

Чтобы отличать:

> реально восстановили Premium

от:

> restore прошёл нормально, но покупок у аккаунта нет.

---

# 15. AdMob revenue

На **каждый paid impression callback Google Mobile Ads SDK** отправлять:

```text
ad_impression_revenue
```

Properties:

```text
revenue
currency

ad_unit_id
ad_format

ad_network
revenue_precision

placement
```

`placement` должен показывать, где была реклама:

```text
after_training
training_questions
after_exam
sign_test
other
```

Не рассчитывать revenue из eCPM самостоятельно.

---

# 16. Итоговый monetization flow

Первая session:

```text
Install
→ onboarding
→ Home

→ first training completed
→ TEASER

→ second training completed
→ FULL PAYWALL
```

Если продолжает бесплатно:

```text
ad #1
ad #2
→ TEASER

ad #3
ad #4
→ FULL PAYWALL
```

Следующий запуск:

```text
App opened
→ Home
→ TEASER
```

Exam:

```text
exam completed
→ result shown
→ FULL PAYWALL
```

Profile:

```text
Premium tap
→ FULL PAYWALL
```

---

# 17. Что потом должно быть видно в PostHog

Главная funnel:

```text
premium_prompt_shown
→ premium_prompt_clicked
→ paywall_viewed
→ purchase_started
→ purchase_succeeded
```

Но главное — segmentation по:

```text
moment
```

Чтобы увидеть:

```text
after_first_training → purchase 3%
after_second_training → 8%
after_exam → 12%
after_ad_4 → 17%
app_open → 2%
```

И тогда уже не гадать, **когда продавать Premium**, а оставить наиболее прибыльные моменты.

Это именно **план первой версии monetization flow**. Ничего сложнее пока не строить, A/B tests не делать и существующий paywall не переделывать.
