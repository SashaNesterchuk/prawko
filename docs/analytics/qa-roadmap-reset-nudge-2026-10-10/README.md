# Reset restores the first-step hint

Profile progress reset now clears `hasStartedLearning` together with lesson pools and completion IDs. After category/date onboarding, the first-step double bounce becomes eligible again in PL/CZ/SK and stops after the next accepted answer.

Native Maestro `roadmap_reset_restores_nudge.yaml` passed on iPhone 17 Pro / iOS 26.0, 10 October 2026: three incorrect answers hide the hint; Profile reset → onboarding → Home restores it; the restored hint remains eligible after restart. Last bootstrap omits the synthetic question scenario to leave the simulator with normal content.

Raw commands, native logs and the inspected final screenshot are in `2026-10-10_230940/roadmap_reset_restores_nudge/`.
