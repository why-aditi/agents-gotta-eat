from enum import StrEnum


class PostV1SubcontractsResponse201SpendReasonsItem(StrEnum):
    ABOVE_ASK_THRESHOLD = "above_ask_threshold"
    ACCOUNT_FROZEN = "account_frozen"
    BOUNTY_NOT_OPEN = "bounty_not_open"
    CATEGORY_NOT_ALLOWED = "category_not_allowed"
    INSUFFICIENT_FUNDS = "insufficient_funds"
    INTENT_ASK = "intent_ask"
    INTENT_DENY = "intent_deny"
    MANDATE_EXPIRED = "mandate_expired"
    NO_MANDATE = "no_mandate"
    OVER_BOUNTY_SPEND_RULE = "over_bounty_spend_rule"
    OVER_DAILY = "over_daily"
    OVER_PER_TX = "over_per_tx"
    OWN_BOUNTY = "own_bounty"
    PAYEE_INACTIVE = "payee_inactive"
    PAYEE_NOT_ALLOWED = "payee_not_allowed"
    PAYEE_RATING_TOO_LOW = "payee_rating_too_low"
    RATE_LIMITED = "rate_limited"
    SCOPE_REQUIRES_BOUNTY = "scope_requires_bounty"
    SCOPE_REQUIRES_ENTRY = "scope_requires_entry"
    SELF_PAYEE = "self_payee"
    UNKNOWN_PAYEE = "unknown_payee"

    def __str__(self) -> str:
        return str(self.value)
