# Gameplay Invariants

Status: Current

This document captures compact gameplay rules that are easy to lose in implementation details.

## Round Ending

- A round ends when one player remains active or when the first two finishers are partners.
- A 1-2 finish takes precedence over ordinary trick cleanup because the winning team receives all card points.
- Round scoring builds a full four-seat finish order for scoring, but the live round state should only mark players who actually went out.

## Dragon Gift

- A Dragon-won trick is normally given to one opponent.
- If only one eligible opponent remains, the server may auto-gift the trick.
- If the Dragon is the final play that creates a 1-2 finish, no Dragon gift choice is offered. The round proceeds directly to scoring.
- A stale `dragonGiftPending` must not survive into round scoring.

## Client Projection

- `awaitingDragonGift` is projected as `playing` for the client, with `dragonGiftPending` indicating the decision.
- If the server does not set `dragonGiftPending`, the client should not display Dragon recipient controls.
