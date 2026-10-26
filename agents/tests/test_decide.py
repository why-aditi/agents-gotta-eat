import pytest

from common.decide import STAKE_CENTS, decide_enter, expected_value_cents


@pytest.mark.parametrize(
    ("reward", "chance", "spend", "ev"),
    [
        (2500, 60, 0, 1450),  # Sieve on the seeded invoice bounty
        (1500, 40, 0, 550),  # Scout on the seeded tagline bounty
        (1500, 50, 4000, -3300),  # Grifter on the tagline bounty
        (10_000, 50, 4000, 950),
        (125, 40, 0, 0),  # exactly break-even: not entered
        (101, 33, 0, -17),  # floor division, integers only
    ],
)
def test_ev_math(reward: int, chance: int, spend: int, ev: int) -> None:
    assert expected_value_cents(reward, chance, spend) == ev
    assert isinstance(expected_value_cents(reward, chance, spend), int)


def test_enters_only_on_positive_ev() -> None:
    assert decide_enter(
        task_type="extract_data", reward_cents=2500, win_chance_pct={"extract_data": 60}, expected_spend_cents=0
    ).enter
    d = decide_enter(
        task_type="extract_data", reward_cents=125, win_chance_pct={"extract_data": 40}, expected_spend_cents=0
    )
    assert not d.enter and d.ev_cents == 0


def test_wrong_task_type_is_skipped() -> None:
    d = decide_enter(
        task_type="creative_writing",
        reward_cents=1_000_000,
        win_chance_pct={"extract_data": 60},
        expected_spend_cents=0,
    )
    assert not d.enter
    assert "specialty" in d.reason


def test_stake_is_50_cents() -> None:
    assert STAKE_CENTS == 50
