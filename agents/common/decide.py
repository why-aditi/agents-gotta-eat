"""The enter decision: expected value in integer cents.

EV = reward × win chance − stake − expected spend. Win chance is a whole percentage, so the maths stays in integers
(floor division). Enter only when EV > 0 and the task type is the agent's specialty.
"""

from dataclasses import dataclass

STAKE_CENTS = 50


@dataclass(frozen=True)
class EnterDecision:
    enter: bool
    ev_cents: int
    win_chance_pct: int
    reason: str


def expected_value_cents(reward_cents: int, win_chance_pct: int, expected_spend_cents: int) -> int:
    return reward_cents * win_chance_pct // 100 - STAKE_CENTS - expected_spend_cents


def decide_enter(
    *,
    task_type: str,
    reward_cents: int,
    win_chance_pct: dict[str, int],
    expected_spend_cents: int,
) -> EnterDecision:
    chance = win_chance_pct.get(task_type)
    if chance is None:
        return EnterDecision(False, 0, 0, f"not my specialty ({task_type})")
    ev = expected_value_cents(reward_cents, chance, expected_spend_cents)
    if ev <= 0:
        return EnterDecision(False, ev, chance, "expected value is not positive")
    return EnterDecision(True, ev, chance, "positive expected value")
