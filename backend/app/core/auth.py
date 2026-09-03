"""Placeholder for the real Zoho-backed auth dependency.

get_current_account always returns None right now — there's no session/JWT
validation yet, that lands with the Zoho OAuth flow. Routes that will need
"who's making this change" already depend on this function, so wiring up real
auth later means changing this one function, not every route that uses it.
"""

from app.models.account import Account


async def get_current_account() -> Account | None:
    return None
