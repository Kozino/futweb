# Competitive Analysis — and how FutWeb inverts every weakness

**Purpose:** not a feature-comparison spreadsheet. This documents the *specific,
sourced failures* of the incumbent platforms and the design decision FutWeb took
in response. Every claim below is cited.

---

## 1. The incumbents

| Platform | Model | Entry price | Notes |
|---|---|---|---|
| **Wyscout** (now Hudl Wyscout) | Video + event data | ~€250/yr | 2.5/5 from 52 app reviews [1](https://mwm.ai/apps/wyscout/562191381) |
| **InStat** | Event + physical data | Enterprise | Scouted via Sales; widely reported as enterprise-only |
| **TransferRoom** | Club-to-club transfer marketplace | Club subscription | Targets clubs' *recruitment workflow*, not player discovery |
| **ScoutingStats** | AI scouting toolkit | £12.99–£19.99/mo [2](https://scoutingstats.ai/) | Data-first, not player-identity-first |
| **Playerhunter** | Club↔player matching | Free until deal closes [3](https://playerhunter.com/) | Deal-contingent; no verification layer described |
| **Player App** | Player-owned profiles | Not public | "The only place to browse footballer-owned profiles" [4](https://join.playerapp.co/) |
| **Afriq Foot Scout** | African scouting | Not public | Founded 2024; ~80 clubs claimed [5](https://afriqfootscout.com/) |
| **ScoreInn** | Agency/consulting | Not public | Nigerian-player-focused, but an agency, not software [6](https://scoreinn.com/) |

**The category gap:** not one of these is a *player-identity platform with
enforced verification, priced in naira, that works offline.* That is the opening.

---

## 2. Weakness → Strength

### Weakness A — Priced in hard currency for a naira market

**Evidence.** Wyscout's basic individual plan starts around €250 a year and
delivers very little — one reviewer notes the entry tier includes only ~70
minutes of video, with comprehensive access requiring enterprise upgrades "often
tens of thousands of euros" [7](https://grokipedia.com/page/Wyscout). Users
describe it as "not cost-effective for smaller organizations or independent
scouts."

**Why it matters.** €250 is roughly ₦400,000+. For a state-league academy in
Katsina or a grassroots setup in Makurdi, that is not a price point — it is an
exclusion. The entire Nigerian domestic market is priced out of the category.

**FutWeb's response.**
- Club plans start at **₦25,000/month** (Academy, 50 players, 3 staff).
- Player plans start at **₦3,500/month**, with a permanently free Scout tier.
- Billing via **Flutterwave**: card, bank transfer and **USSD** in naira. USSD
  matters — it works on feature phones and requires no data connection.
- Annual billing discounts two months, because Nigerian academies budget
  seasonally, not monthly.
- Prices live in the `plans` table, so they can be tuned per market without a
  redeploy.

---

### Weakness B — Fake agents are an industry, and nobody in software is stopping it

**Evidence.** Didier Drogba has compared the exploitation of young African
players by fake agents to **human trafficking**, working with FIFPRO on it [8](https://inews.co.uk/sport/football/didier-drogba-fake-agents-young-african-players-human-trafficking-2453324). FIFPRO documents families paying between **£4,300 and £8,600** to secure fake meetings at clubs; in the worst cases players end up stranded abroad with no money to return home [9](https://www.fifpro.org/en/articles/2021/01/fake-agents-are-scamming-players-by-impersonating-real-agents). Other reporting puts amounts as high as **£10,000** [10](https://nation.africa/kenya/sports/football/Fake-UK-football-agents-kill-dreams-of-young-Africans/1102-4520988-ipjf53z/index.html), and the ISS documents boys from Nigeria, Ghana and Cameroon paying **€1,000–€1,500** for phantom contracts, with one family paying over **€5,000** [11](https://issafrica.org/iss-today/going-for-gold-africas-young-footballers-exploited-by-smugglers).

A recurring mechanism is **impersonation**: scammers reuse a real agent's name
and photographs. One genuine agent reported 20–30 players calling him about
trials he never arranged [9](https://www.fifpro.org/en/articles/2021/01/fake-agents-are-scamming-players-by-impersonating-real-agents).

**Why it matters.** This is the single largest source of harm in the market
FutWeb is entering. A platform that ignores it is not neutral — it is a venue.

**FutWeb's response — the trust layer.**
1. **Eight discrete checks**, each independently visible: email, phone, identity
   (NIN/BVN/passport), entity (CAC + NFF or state FA affiliation), liveness
   video, references, billing standing, conduct record.
2. **Liveness check specifically defeats impersonation**, which is the dominant
   attack in the FIFPRO reporting.
3. **Players see the trust badge before they reply**, not after.
4. **Zero-fee trials are enforced in the database**, not in the terms of service:
   ```sql
   fee_charged_to_player integer not null default 0
     check (fee_charged_to_player = 0)
   ```
   No client, bug or stolen token can create a fee-bearing trial.
5. **Immutable audit trail** — `UPDATE` and `DELETE` on `audit_log` raise an
   exception. If a case reaches the NFF or the EFCC, there is a record that
   cannot be quietly rewritten.
6. **One-tap reporting** with a documented escalation path to the NFF and EFCC.

---

### Weakness C — Built for fibre, used on 3G

**Evidence.** Wyscout reviewers report "app instability, including freezing and
server problems" and note it is "more often used on PC" [1](https://mwm.ai/apps/wyscout/562191381). Nigeria has roughly **45.5% internet penetration** with about **165 million mobile connections** — the access model is overwhelmingly mobile [12](https://www.statista.com/topics/7199/internet-usage-in-nigeria/). Mobile data is cheap by global standards — around **$0.38/GB** per ITU/GSMA [13](https://broadcastmediaafrica.com/2025/01/16/nigeria-offers-most-affordable-mobile-data-in-africa-report/) — but *cheap data is not the same as a reliable connection* in a stadium, at a rural pitch, or during a state FA tournament.

**Why it matters.** The moment that matters most in scouting — watching an
unknown player at a grassroots tournament — is exactly the moment with the worst
connectivity. Every incumbent loses that data.

**FutWeb's response — offline-first.**
- **Write-behind queue.** Every rating and report is written to IndexedDB first,
  then flushed. `OfflineContext.enqueue()` resolves locally and always succeeds.
- **Service worker** caches the app shell; the app still opens with zero signal.
- **Explicit UI feedback**: a banner states exactly how many records are pending,
  and the save button reads "Save offline" when disconnected.
- **Data-saver mode** compresses thumbnails and lowers video bitrate.
- Sync is opportunistic: on `online` event, on window focus, and on demand.

---

### Weakness D — Numbers without context

**Evidence.** Wyscout "lacks built-in predictive depth or player rankings
tailored to specific user criteria," requiring supplements "such as WhoScored
for deeper statistical insights" [7](https://grokipedia.com/page/Wyscout). The
category publishes raw attributes and leaves interpretation to the scout.

**Why it matters.** A raw "72 dribbling" is not a decision input. It is
unanchored. Three questions go unanswered by every incumbent:
1. Is it good **for that position**?
2. Is it good **for that age**?
3. Is it **corroborated**?

**FutWeb's response — the rating engine** (see [`RATING_MODEL.md`](RATING_MODEL.md)):
- **Position-weighted.** A centre-back is not penalised for a low crossing score.
- **Age-adjusted.** Development curves differ by position (GK peaks ~29, FW ~26);
  we project toward the positional prime rather than comparing a 17-year-old to
  a 27-year-old.
- **Confidence-discounted.** An uncorroborated self-rating is regressed up to 30%
  toward the population mean. Full corroboration → no regression.
- **Weights live in the database too** (`compute_trust_score`, plan pricing) so a
  tampered client cannot inflate its own output.

---

### Weakness E — Opaque, painful account and billing operations

**Evidence.** The dominant complaint cluster about Wyscout is *not* about data —
it is about **account creation and subscription management**. Reviews describe
being "renvoyé sur plusieurs sites différents" when trying to register, an
inability to purchase a subscription at all, no way to unsubscribe, and customer
service that could not help [1](https://mwm.ai/apps/wyscout/562191381). Trustpilot
sentiment is characterised as "among the absolute worst CS I have ever seen," with
threats of legal action over subscription disputes [7](https://grokipedia.com/page/Wyscout).

**Why it matters.** In a market where users are often first-time SaaS customers
paying in naira, an opaque billing experience does not frustrate — it convinces
people the product is a scam. Which, in this market, they have good reason to
suspect.

**FutWeb's response.**
- **One-click cancel** from billing, visible, no phone call.
- **Idempotent billing.** Every charge keys on `tx_ref`; the database rejects
  illegal payment state transitions. A webhook retry can never double-charge.
- **Grace period** on failed renewal with daily notification, before restriction.
- **Payment history** is visible to the customer with provider references.
- **Transparent pricing** on the public site, in naira, before signup.

---

### Weakness F — Rigid data: you cannot add your own players

**Evidence.** Users point to "limitations in data editing flexibility, noting
that the platform does not easily allow for adding new player entries or
customizing existing profiles, which hinders personalized scouting workflows"
[7](https://grokipedia.com/page/Wyscout).

**Why it matters.** This is disqualifying for the actual use case in Nigeria.
The players who most need a profile are, by definition, **not in any commercial
database**. A platform you cannot add an unknown 17-year-old to is useless for
discovering unknown 17-year-olds.

**FutWeb's response.**
- Player creation is a **first-class path**, not an afterthought. A club can
  invite a player by link; the player completes their own profile.
- Clubs can **manage players who have not claimed accounts yet**
  (`managed_by_club_id` with a nullable `user_id` on the player row).
- **CSV import** for bulk onboarding of an existing academy squad.
- Self-reported data is explicitly **labelled** as such via the confidence
  score — we do not pretend unverified data is verified, which is the honest
  version of "rigid."

---

### Weakness G — African competitions are an afterthought

**Evidence.** ScoutingStats advertises "150+ leagues" [2](https://scoutingstats.ai/);
Wyscout is valued for "extensive leagues." These are overwhelmingly European.
The NPFL, NNL, NLO, NWFL and state FA structures — where Nigerian players
actually develop — are thin or absent.

**Why it matters.** If a player's competitive history cannot be expressed in
your data model, that player effectively does not exist in your system.

**FutWeb's response.**
- Nigerian competitions are **first-class enums**: NPFL, NNL, NLO, NWFL, State
  FA, Academy, School (NUGA/NISSA), Street/Unattached.
- Regional leagues modelled alongside (Ghana Premier League, other African).
- **36 states** selectable as state of origin — because recruitment in Nigeria
  is genuinely regional.
- **Video-first CVs.** Where federation stats do not exist, footage is the
  evidence. Media carries **provenance** (when/where recorded) to stop borrowed
  footage being passed off as a player's own.
- **WhatsApp-ready share cards.** Distribution in this market runs on WhatsApp,
  not on portals. A forwarded image gets watched; a link gets ignored.

---

## 3. Positioning

> **Wyscout tells you about players who already have a record.**
> **FutWeb gives a record to the players who do not have one.**

That is the wedge. The incumbents index the documented world. FutWeb's market is
the undocumented one — and it is enormous.

---

## 4. What we deliberately did not copy

| Incumbent behaviour | Our decision | Reason |
|---|---|---|
| Annual-only, hard-currency pricing | Monthly, naira, USSD | Cash flow reality of Nigerian clubs |
| Video minutes metered by tier | Generous uploads from the Pro tier | Metered video punishes the exact behaviour we want |
| Opaque cancellation | One-click, visible | Trust is the product |
| Raw attribute dumps | Contextualised, confidence-scored | A number without context is not a decision input |
| Desktop-first | Mobile-first, offline-capable | 165m mobile connections, scouting happens on pitches |
| Global league coverage as the headline | African competitions first | Depth where our users are beats breadth where they are not |

---

## 5. Open risks

1. **Verification is operationally expensive.** Eight checks per club requires
   human review. Until volume justifies automation, this is a cost centre.
2. **Cold start.** Discovery is worthless with 100 players. Seeding must be
   academy-by-academy, state by state.
3. **Video hosting costs.** Video-first CVs on 3G is the right product decision
   and the wrong cost curve. Needs aggressive transcoding and lifecycle rules.
4. **Federation data access.** The NPFL and NFF do not currently expose a public
   stats feed. Until they do, verified stats will be a manual partnership.
5. **Fraudulent accounts will target us.** A platform whose value is "you can
   trust this club" becomes a target for people who want that badge. The
   verification queue and audit trail are the mitigation, not a cure.
