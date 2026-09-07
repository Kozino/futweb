# Access & subscription-withdrawal audit

**Goal:** confirm a club (and a player) can only ever access what their current
subscription actually covers, and that when a subscription/tier is downgraded
or lapses the **database** withdraws the no-longer-covered access — not just the UI.

The rule of thumb used throughout this product:
- **Client entitlement layer** (`src/lib/entitlements.ts`) decides *which buttons
  to show* and recomputes from the user's live `sub_status`/`plan_code` **on every
  render**, so the UI locks the instant the DB state changes.
- **Supabase RLS is the real security boundary.** This audit is about making the
  DB match the entitlement promise, because UI hiding alone is not enforcement.

---

## Model summary

| Sub state | Meaning for access |
|---|---|
| `trialing` | Full access for the account's audience (TRIAL_GRANTS_FULL) |
| `active`, `grace` | Features of the plan in `plan_code` |
| `expired` / `paused` / `cancelled` / `none` | No premium features; `RequireSubscription` also blocks at route level |

Plan tiers: players `scout(0) < pro(1) < elite(2)`; clubs `academy(0) < pro(1) < enterprise(2)`.

RLS helpers: `is_admin()`, `has_active_sub()` (any of active/trialing/grace),
`my_club_ids()` (clubs where caller is a non-revoked member), `is_club_staff(club)`
(owner or active member of *that* club), `user_in_club_tree(club)` (owner/member of
the club or any ancestor), `club_is_federation(club)` (owner's plan is
club_enterprise and active/grace/trial), `is_club_staff`.

---

## Findings

### ✅ 1. Trial publication is server-gated (good)
`trial_may_publish` re-checks `entity_verified` + active sub on `club_pro`/
`club_enterprise` (or trial) *inside* a security-definer function, and a guard
trigger (`trials_guard_publication`) blocks a club from self-marking a posting
open/verified unless it qualifies. A club that stops qualifying cannot newly
self-publish verified trials. (Open postings already live are not auto-closed —
a product decision, see Open items.)

### ✅ 2. Messaging / profile-views (elite) are server-gated
`player_can_message`, the messaging RPCs, and messaging RLS re-derive access from
the participant's plan/verification at call time (`plan_code = 'player_elite'`,
`has_active_sub`). Downgrading an Elite player stops new premium messaging reads.

### ✅ 3. Federation links and enterprise requests are server-gated
`link_academy` / `unlink_academy` require `club_is_federation(parent)`, so a club
downgraded off `club_enterprise` cannot create **new** group links.

### ⚠️ 4. Federation group OVERSIGHT reads were NOT withdrawn (FIXED in 0017)
`federation_children`, `federation_academy_squad`, and the cross-club path of
`can_view_player` only checked *membership of the group* (`user_in_club_tree`),
not the plan. A Federation parent that downgraded to `club_pro` (or whose sub
lapsed) kept **silent read access to every child academy's squad and player
records** — cross-organisation access is exactly what `club_enterprise` pays for.

**Fix (migration 0017):** all three now re-verify `club_is_federation(parent)`
before returning any child-academy data. Direct-club access to a club's OWN
players is preserved (that is not a premium cross-org read).

### ⚠️ 5. Minor-guardian consent grouping bug (FIXED in 0017)
In the pre-0017 `can_view_player`, the final
`and (not is_minor or … guardian_consent_at …)` clause bound only to the
`verified_only` branch (AND binds tighter than OR). A club that managed a minor
could read them via the `my_club_ids`/club path **without** consent being checked.
Now the consent guard applies to every non-self/non-admin visibility path.

---

## What the DB enforces after 0017

| Capability | Enforced server-side by | Withdrawn when |
|---|---|---|
| Publish verified trials | `trial_may_publish` + trigger | loses active `pro`/`enterprise` |
| Messaging / elite reads | messaging RPCs + RLS | loses `player_elite` |
| Federation link/unlink | `link_academy`/`unlink_academy` | loses `club_enterprise` |
| Federation group/oversight reads | `federation_children`/`_academy_squad`/`can_view_player` (0017) | loses `club_enterprise` |
| Public & verified-only player discovery | `can_view_player` via `has_active_sub` | sub not active/trial/grace |
| Minor data visibility | `can_view_player` consent guard (0017) | minor without guardian consent |

**Client gate keeps pace:** `entitlementsFor` is derived from `user.subStatus` +
`user.planCode` on every render, and the Federation club pages (`Academies`,
`Developer`) and club routes recompute `level` and switch to an upgrade card /
`RequireSubscription` block the moment `plan_code`/`sub_status` change. So the UI
and DB now agree.

---

## Open items (product policy — not changed here)

1. **No self-serve downgrade/cancel that flips `sub_status`/`plan_code`.**
   `activate_subscription` is the only in-app writer; downgrades/cancellations
   must come from the billing provider webhook. Until a handler flips the DB
   state, nothing (client *or* server) knows to withdraw. Confirm your provider
   event → `sub_status`/`plan_code` mapping exists for downgrade and non-renewal.
2. **Already-live verified trials stay open after a club loses eligibility.**
   Auto-withdrawing an open posting could strand applicants mid-window; decide
   policy (leave open vs. close/flag on lapse).
3. **Tier-vs-tier differences within "active"** (e.g. `per90`, `comparison`,
   `full_discovery`, `audit_export`) are surfaced/withdrawn at the client
   entitlement layer but are not separately hard-gated in RLS (a downgrade across
   tiers while remaining "active" mostly affects reads of the club's own data /
   search UX rather than other clubs' data). If any of these must be a hard DB
   boundary (e.g. `full_discovery` returning other players' private rows), add an
   explicit RLS/RPC condition keyed on `plan_code` — see note below.

> **Note on tier RLS:** the RLS layer generally keys off *having an active
> subscription*, not the specific tier, because the tier differences are about a
> club's own operations and search UX rather than exposing other organisations'
> private data. Federation is the exception: reading **another** club's academy
> data is inherently cross-organisation, which is why it gets an explicit
> `plan_code` check. If you treat any other tier feature as a hard security
> boundary on other parties' rows, mirror the Federation pattern.
