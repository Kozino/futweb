# The FutWeb Rating Model

## Why not just publish raw attributes?

Because a raw "72 dribbling" is not a decision input. It is unanchored. It does
not say whether 72 is good for *that position*, good for *that age*, or whether
*anyone credible* confirmed it.

FutWeb publishes a score that answers all three, and publishes the method so a
scout can argue with it.

---

## Pipeline

```
32 attributes (0–99)
        │
        ▼
  [1] Position weighting
        │   weights per position group, Σ = 1.0
        ▼
   raw composite
        │
        ▼
  [2] Confidence discount
        │   shrink 0–30% toward population mean (50)
        ▼
   FutWeb Score  ← "how good is he now"
        │
        ▼
  [3] Age curve
        │   project to positional prime
        ▼
   Potential  ← "how good could he get"
```

---

## [1] Position weighting

Each position group weights attributes differently. Each set sums to 1.0.

| Attribute | GK | DF | MF | FW |
|---|---:|---:|---:|---:|
| Finishing | – | – | – | **0.19** |
| Passing | – | 0.06 | **0.15** | – |
| Dribbling | – | – | 0.07 | 0.09 |
| First touch | – | – | 0.10 | 0.08 |
| Acceleration | 0.03 | 0.06 | – | 0.11 |
| Sprint speed | – | – | – | 0.09 |
| Stamina | – | 0.04 | 0.08 | – |
| Strength | – | 0.08 | – | 0.05 |
| Heading | – | – | – | 0.05 |
| Technique | – | – | 0.05 | 0.06 |
| Vision | – | – | 0.13 | – |
| Positioning | 0.10 | 0.11 | 0.09 | 0.10 |
| Decision making | 0.07 | 0.07 | 0.11 | 0.07 |
| Work rate | – | 0.04 | 0.09 | – |
| Composure | 0.08 | 0.05 | 0.06 | 0.11 |
| Tackling | – | 0.14 | 0.03 | – |
| Marking | – | 0.13 | – | – |
| Interceptions | – | 0.12 | 0.04 | – |
| Aerial duels | 0.06 | 0.10 | – | – |
| Shot stopping | **0.20** | – | – | – |
| Reflexes | 0.18 | – | – | – |
| Handling | 0.14 | – | – | – |
| GK distribution | 0.10 | – | – | – |

A centre-back's crossing score is simply not part of his rating. A striker is
not rewarded for tackling.

**Versatility** falls out for free: we compute fit across *all four* groups and
surface any position where fit ≥ 70.

---

## [2] Confidence discounting

The mechanism that stops inflated self-ratings passing as evidence.

| Signal | Threshold | Points |
|---|---|---:|
| Multiple observations | 3+ ratings on file | 25 |
| Independent raters | 2+ distinct sources | 25 |
| Verified raters | 1+ verified coach or scout | 20 |
| Live match observation | 3+ matches observed | 15 |
| Video evidence | Verified footage attached | 8 |
| Official match stats | Federation data linked | 7 |

Plus up to +10 for account tenure, minus 15 per upheld dispute.

**Regression toward the mean:**

```
shrink  = 0.30 × (1 − confidence/100)
score   = raw × (1 − shrink) + 50 × shrink
```

### Worked example

A player self-rates 85 with one clip and no corroboration. Confidence ≈ 15.

```
shrink = 0.30 × (1 − 0.15) = 0.255
score  = 85 × 0.745 + 50 × 0.255
       = 63.3 + 12.8
       ≈ 76
```

The claimed 85 is published as **76**, with the confidence score displayed next
to it. Add two verified coach ratings and six observations: confidence rises to
~85, shrink falls to 0.045, and the same raw 85 publishes as **83**.

The number did not change. The evidence behind it did. Clubs can see which is
which.

---

## [3] Age adjustment

Peak age differs by position — goalkeepers mature latest, forwards earliest:

| Group | Peak age |
|---|---:|
| Goalkeeper | 29 |
| Defender | 28 |
| Midfielder | 27 |
| Forward | 26 |

```
gap       = peak_age − current_age        (capped to [−6, +12])
factor    = 1 + gap × 0.055               (0.04/yr when declining)
potential = min(99, score × factor)
```

### Worked example

An 18-year-old centre-back rated 62 sits ten years from a defender's peak of 28.

```
factor    = 1 + 10 × 0.055 = 1.55
potential = 62 × 1.55 = 96   → capped and tempered by confidence
```

96 is a **ceiling, not a forecast**. It is always displayed alongside the
confidence score that produced it, so a scout can discount it appropriately. The
cap exists precisely so a 14-year-old's projection does not read as absurd.

---

## Trust Score (separate, and deliberately not a rating)

An orthogonal 0–100 measure of *whether an account is real*. Eight checks:

| Check | Points |
|---|---:|
| Entity verified (CAC + NFF/state FA) | 25 |
| Identity verified (NIN / BVN / passport) | 20 |
| Phone verified | 10 |
| Liveness check | 10 |
| References confirmed | 10 |
| Billing in good standing | 10 |
| Email verified | 10 |
| Clean conduct record | 5 |
| Tenure bonus | up to +10 |
| Per upheld dispute | −15 |

**Tiers:** Gold ≥85 (entity + liveness) · Entity ≥65 · Identity ≥35 · Unverified.

Computed in SQL (`compute_trust_score`) so a client cannot inflate it.

---

## Per-90 performance metrics

Raw counts favour players with more minutes, so all derived metrics are
normalised per 90:

```
goals/90, assists/90, shots/90, tackles/90, interceptions/90
shot accuracy %  = shots_on_target / shots
pass accuracy %  = passes_completed / pass_attempts
duel success %   = duels_won / duels
conversion %     = goals / shots
minutes per goal = minutes / goals
```

Substituting in the 70th minute does not penalise a player relative to someone
who played 90.

---

## Honest limitations

Stated openly, because a model that hides its limits is not trustworthy:

1. **A projection is not a prediction.** Development is non-linear; injuries,
   coaching and opportunity dominate.
2. **Confidence is a proxy for evidence, not for truth.** Three scouts can agree
   and all three be wrong.
3. **Self-reported match data is weak evidence** — which is exactly why it is
   labelled and weighted down until a federation or club confirms it.
4. **Attribute ratings are subjective.** The confidence model reduces the impact
   of a single biased rater; it cannot eliminate it.
5. **Small-sample positions** (goalkeepers, in particular) have thinner
   comparative data than outfield players.

---

## Reproducing it

```ts
import { computeFutWebScore, computeConfidence, computeTrustScore } from '@/lib/ratings'

const score = computeFutWebScore({
  attributes, position: 'ST', age: 21, confidence: 78,
})
// → { current, potential, positionFit, viablePositions, ratingTier, ... }
```

The weights are mirrored server-side in `supabase/migrations/0003_functions.sql`
so a tampered client cannot publish an inflated score.
