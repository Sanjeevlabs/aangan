# Aangan — Product & Engineering Spec v2

*Status: for review. Nothing below this line is built unless marked ✅. Written before design and build, as asked.*
*Legend: ✅ built · 🔧 partly built · 🆕 proposed · ⏸ later (post-hackathon)*

---

## 0. One line

**WhatsApp moves messages. Aangan keeps a family going** — what elders know is passed down, things are done together across continents, the people we love are cared for and safe, without anyone being watched.

Values, in order: **Needed** (elders give) · **Heard** · **Present** · **Remembered** · **Safe** 🆕 · **Never watched**.
*Safe* is new, and it sits under *Never watched*: every safety feature is owned and switched on by the person it protects.

---

## 1. What families far apart actually care about

You listed: food, safety, connection, gossip, storage, care. The full map, ranked by how often it hurts and how badly WhatsApp serves it:

| # | Need | The real moment | Aangan answer | Status |
|---|---|---|---|---|
| 1 | **Connection** | "I haven't heard Maa's voice in a week" | Voice notes as music cards, Heard loop, *Talk to Maa & Papa*, Sit together | ✅ |
| 2 | **Care for aging parents** | "Who's getting Papa's medicines this month?" | Care board (ticketing), Village, duties, whose week | 🔧 → §6 |
| 3 | **Safety of the young** | "She's alone in Bangalore, it's 11 PM" | Safe & sound check-ins (owned by her) | 🆕 §7 |
| 4 | **Food & home taste** | "I miss Dadi's dal" | Kitchen: taught by voice, cooked abroad, blessed | ✅ |
| 5 | **Presence / ambient closeness** | "What is Maa doing right now?" | One-tap moments, home cards with local time | ✅ |
| 6 | **Occasions** | Birthdays, anniversaries, festivals across zones | Occasions + two-way Reel + gifting (§9) | ✅ / 🆕 |
| 7 | **Family news ("gossip")** | "Did you hear Chachu got a new job?" | **Family news** — short posts, *no feed algorithm*, weekly digest by Muse | 🆕 §5.9 |
| 8 | **Memories & storage** | Old photos rotting in one cousin's phone | Memory Lane ✅ + **Family vault** for important documents 🆕 | 🔧 |
| 9 | **Heritage & language** | Kids losing the mother tongue | Weekly question ✅, "word of the day" from an elder 🆕, recipes ✅ | 🔧 |
| 10 | **Milestones** | First day of school, graduation, new job | Milestone cards (special memory type) 🆕 | ⏸ |
| 11 | **Travel** | "Landed safe" | Safe & sound: *Journey* check-in 🆕 | 🆕 §7 |
| 12 | **Emergencies** | Fall at home, hospital at night | Emergency card per home: local contacts, nearest hospital, Village, one-tap call; **no** medical advice | 🆕 §7.5 |
| 13 | **Pets** | "How's Bruno?" (US/UK families especially) | Pets as family (§4.3), in homes, with care tasks & photos | 🆕 |
| 14 | **Money & bills** | Electricity bill for parents' home | Only as **care tasks** ("Pay electricity bill"). Aangan never holds or moves money. | 🆕 (task) |
| 15 | **Elder tech help** | "How do I video call?" | Elder mode ✅; Sit together one-tap room ✅; Muse explains a screen by voice ⏸ | 🔧 |
| 16 | **Faith & festivals** | Aarti together, Eid, Christmas | Data-driven ritual configs ✅, Sit together reason "festival" ✅ | ✅ |

**Deliberately not:** a social feed, stories/status, counts/likes, location tracking, medical/legal/financial advice, a marketplace.

---

## 2. Navigation (information architecture)

- **Courtyard** (home) — what matters *now*: open doors, each far home's day, Safe & sound statuses, the latest voice, open care tickets assigned to you, coming up.
- **Dock** — *Talk to {home}* · camera · ⋯ rooms.
- **Rooms** (⋯): Care · Kitchen · Sit together · Family (map + tree) · Memory Lane · Occasions · Family news 🆕 · Vault 🆕 · Settings.
- **Badges**, not notifications spam: a room shows a dot only when something needs *you* (assigned ticket, unanswered question, overdue check-in from someone who chose you).

---

## 3. Global by default

| Area | Rule |
|---|---|
| Language | UI English (more later); **content** in 29 languages via Muse ✅ |
| Kinship words | Per culture and language: Dadi/Nani/Grandma/Oma/Abuela — never one culture's words as logic ✅ (kinship resolver) |
| Time | Every time shown in the reader's zone **and** the other person's ✅ |
| Festivals | Data files, not code ✅ |
| Money | Prices per region (INR / USD / GBP / EUR / AED), local payment provider (§8) |
| Emergency | Country-specific emergency numbers in the Emergency card (112 India/EU, 911 US/CA, 999 UK, 000 AU) 🆕 |
| Privacy law | India DPDP Act 2023, GDPR (EU/UK), CCPA (California): consent, export, delete ✅ partly (delete); export 🆕 |

---

## 4. People model

### 4.1 Person
`Member { id, familyId, firstName, displayName (what family calls them), role/generation (elder|adult|child), access (admin|member|child) ✅, tz, birthday?, lang/displayLang, photoRef, email? (has account) }`

### 4.2 Relationships — the family grows beyond parents and children 🆕
Today the guided add supports mother/father/wife/husband/son/daughter/sister/brother ✅. Extended family needs:

| Word | Stored as | Example |
|---|---|---|
| uncle / aunty (parent's sibling) | `sibling` of a parent | Chachu = Papa's brother |
| uncle / aunty (by marriage) | `spouse` of a parent's sibling | Chachi |
| cousin | `child` of an uncle/aunty | |
| nephew / niece | `child` of a sibling | |
| in-laws | `parent` of a spouse ✅ | Amma, Appa |
| grandparent | `parent` of a parent ✅ | |
| step / adoptive | relation word + same edge kinds | "stepmother" |

The add flow asks in plain words: *"Chachu is Papa's younger brother"* → creates the right edge. Regional words (Chacha/Mama/Bua/Mausi; Onkel/Tante; Tío/Tía) are **labels**, resolved by the kinship resolver ✅, never logic.

### 4.3 Pets 🆕
`Pet { id, familyId, name, species (dog|cat|bird|fish|rabbit|other), homeId (which household), photoRef, birthday or "gotcha day", notes }`
- Pets belong to a **home**, appear on the home card ("Bruno is with Maa & Papa"), in the family map, and in Memory Lane (tag a photo).
- Care tasks can be for a pet: *vet visit, food delivery, walker* (the Village can include a dog walker).
- Occasions: pet birthdays/gotcha days (opt-in).
- Pets never have accounts or access.

### 4.4 Households ✅
A home = a couple (incl. inferred co-parents) + children under that roof (same time zone) + pets 🆕. Homes drive *Talk to …*, the Courtyard cards, the Care board.

### 4.5 Access roles ✅
| Access | Can |
|---|---|
| Admin | Everything below + assign roles, remove people with accounts, revoke invites, remove anyone's content (moderation) |
| Member | Add people, edit/remove people without accounts, invite, manage care |
| Child | Talk, share, cook, check in; cannot change the tree, invite, or manage care |
Always ≥1 admin (enforced). Authors own their content.

---

## 5. Screens — purpose, data, every operation, every state

Notation: **C** create · **R** read/list/query · **U** update · **D** delete. *Who* = permission. All screens have **loading** (skeleton), **empty** (one sentence + one action), **error** (one sentence + retry), and **offline** (keeps last data, disables writes) states.

### 5.1 Entry: Landing · Create · Join · Sign in ✅
| Op | What | Who | Edge cases |
|---|---|---|---|
| C | Create family (email code) → you are admin | anyone | duplicate email → "sign in instead"; email limits (Supabase) |
| C | Join with invite code | anyone with code | expired/revoked code → clear message |
| R | Sign in with email code | account holders | unknown email → offer create/join |
| D | Sign out | self | clears cached family data ✅ |
| 🆕 | Demo family | anyone | read-only writes reset on restart |

### 5.2 Courtyard (home) 🔧
| Block | R | C/U/D |
|---|---|---|
| Open doors ("come sit") | active knocks | join room |
| Far homes ✅ | each home's local time + each parent's latest moment | tap → Care for that home |
| Safe & sound 🆕 | statuses of people who chose you | "Call", "I've seen it" |
| My tickets 🆕 | care tickets assigned to me | quick done |
| For elders ✅ | share my day (C/undo D) ✅, weekly question (answer C / skip D) ✅, ask for help (C) ✅ | |
| Hero voice ✅ | latest voice from someone else | play, react (C/D) ✅, reply (C) |
| Your family ✅ | albums per person | → person page |
| Coming up ✅ | next occasion | record a wish (C) |

### 5.3 Person page ✅🔧
R: portrait, local time, birthday, voice notes, moments, connections ✅. U: edit name/generation/place/birthday ✅ (no-account people; self via Settings). C/D: link to someone already here / remove a link ✅. D: remove from family ✅ (account holders: admin only). 🆕: their safety status (if they chose you), their pets.

### 5.4 Family (map + tree) 🔧 — see §10 for the visual design
| Op | Who |
|---|---|
| C add person by relation (incl. uncle/aunty/cousin/pet 🆕) | member+ |
| C link existing people ✅ | member+ |
| U person details ✅ · D remove link ✅ · D remove person ✅ | member+ / admin for accounts |
| R search a person 🆕 (families of 40+ need it) | everyone |

### 5.5 Memory Lane ✅🔧
R by person/season ✅ · C voice/photo/video ✅ · U fix caption/words ✅ (author) · D delete ✅ (author/admin) · R search by words 🆕 · C tag people/pets 🆕 · *Export my memories* 🆕 (privacy law).

### 5.6 Kitchen ✅
C teach by voice ✅ · C ask an elder ✅ · R recipe in my language ✅ · U edit recipe ✅ (cook) · D delete recipe ✅ (cook/admin) · C "I made this" ✅ · D my attempt ✅ · C/D bless ✅ · C cook together → Sit together ✅ · 🆕 order missing ingredients (§9).

### 5.7 Sit together ✅
C sitting with a reason ✅ · R everyone-awake windows ✅ · U reschedule (host, resets RSVPs) ✅ · C/U RSVP ✅ · D cancel (host) ✅ · C/D open/close my door ✅ · C .ics ✅ · 🆕 keep a moment afterwards (photo → Lane), recurring sittings ("every Sunday chai").

### 5.8 Care — rebuilt as a ticket tracker (§6) 🆕

### 5.9 Family news 🆕
Short text/voice posts ("Chachu got the job!"). C post · R chronological, no ranking · reactions (3) · D own. Weekly *"This week in the family"* digest written by Muse from posts and voices, delivered Sunday in each reader's language. No comments thread (reply = voice note to the person).

### 5.10 Vault 🆕 ⏸ (proposal)
Important family documents (property papers, insurance, school certificates) — **encrypted at rest, per-document access list**, audit log, no AI reading unless the owner asks. This is high-risk; recommend after launch with a security review.

### 5.11 Occasions ✅
R upcoming ✅ · C wish/blessing ✅ · R Reel ✅ · 🆕 send a gift (§9) · 🆕 add a custom occasion (anniversary, gotcha day).

### 5.12 Settings ✅🔧
Profile U ✅ · Hear the family in (29 languages) ✅ · Larger text ✅ · Time zone ✅ · Home photo ✅ · Invite C/D(revoke) ✅ · People & roles U ✅ · Privacy: delete my traces ✅, leave family ✅ (last-admin guard ✅), export 🆕 · Plan & billing 🆕 · Safety: who can see my check-ins 🆕.

### 5.13 What Muse did ✅
R every Muse step with model, time, cost ✅ · proposals approve/reject 🔧.

---

## 6. Care board — a ticketing & tracking system 🆕

Today's Care screen stacks every section on one page → cluttered. Rebuild as a **board for each home**, the way good ticketing tools work, but family-warm.

### 6.1 Ticket model
`Ticket { id, homeId, forMemberId?, petId?, title, category, status, priority?, due?, assignee (family member), helper (Village person)?, recurring?, createdBy, watchers[], history[], noteForParent, attachments[] ⏸ }`

| Field | Values |
|---|---|
| category | Groceries · Home & repairs · Rides · Gas & utilities · Bills (task only) · Health visits (task only) · Errands · Visit/company · Pets · Other |
| status | **Open → Assigned → In progress → Done** (or **Cancelled**). Re-open allowed. |
| priority | Normal · Soon · Urgent (urgent = shown first + dot on Courtyard) |
| recurring | none · weekly · monthly ("Gas cylinder every 6 weeks", "Groceries every Saturday") |
| history | every change: created, assigned (by/to), helper set, status changes, note edits — with who & when |

### 6.2 Views
- **Board** (default): three swimlanes *Open · In progress · Done (7 days)*, compact rows: category icon · title · due · assignee avatar · helper chip. Tap → ticket sheet.
- **Filters** (chips, one row): *All · Mine · Unassigned · Urgent* + category.
- **Ticket sheet**: title, for whom, category, due, assignee picker (siblings/family), helper picker (Village), status buttons, note to parent (Muse writes it in their language), **timeline** (history), delete/cancel.
- **People strip** at top: each sibling's open count — fair split at a glance.
- Village, duties ("who handles what") and the rota move to a **Setup** tab, out of the daily view.

### 6.3 Automation (Muse, proposes; never acts on money)
- Spoken request → ticket (category, due) ✅ (need-from-voice).
- Duty routing: category → the sibling who handles it ✅.
- Recurring tickets auto-create on schedule 🆕.
- Unclaimed > 24 h → nudge the person whose week it is 🆕.
- Done → parent sees reassurance in their language ✅.

### 6.4 Permissions
Parent: create for self, edit/cancel own. Member: everything for any home. Child: read-only. Admin: delete any.

### 6.5 Migration
`need` docs become `ticket` docs (status open→open, claimed→assigned, done→done; claimedBy→assignee; helperId→helper). One-way migration on read; old API actions stay as aliases for one release.

---

## 7. Safe & sound — safety without tracking 🆕

Your example: a daughter working in Bangalore a year after college; her father wants to know she's okay. Constant GPS tracking would break *Never watched* and push her to switch it off. Design it so **she** wants to use it.

### 7.1 Principles
1. **Owned by her.** She turns it on, chooses who sees it (e.g., Papa and Maa), and can pause anytime.
2. **Status, not surveillance.** Moments she sends, not a live dot.
3. **Alerts only on a missed promise.** "Heading home, ~40 min" → if she hasn't tapped *Home safe* 20 minutes after the ETA, the people she chose get one gentle alert. Nothing else ever alerts.
4. **One-time location, only when she sends it.** *I need help* can attach her current location once (browser permission), never continuously.

### 7.2 Check-ins
| Tap | Meaning | Who's told |
|---|---|---|
| **Home safe** | arrived | her chosen people see "Anya · Home safe · 10:42 PM in Bangalore" (no alert) |
| **Heading home · ETA** | starts a timer | alert only if overdue |
| **Journey** (flight/train) | "Landing 6:10 AM" | alert only if not "Landed" by +2 h |
| **Out late** | "With friends, will message" | no alert, sets expectations |
| **I need help** | urgent | immediate alert to her people + optional one-time location + local emergency number |

### 7.3 Data
`SafetyCheckin { id, memberId, kind, note, etaAt?, closedAt?, location? {lat,lng,accuracy,at} (help only), watchers[] }` · `SafetySettings { memberId, enabled, watchers[], paused }`. Location is deleted after 24 h.

### 7.4 Notifications
Alerts need push. Web push (PWA) works on Android/desktop and iOS 16.4+ when installed to the home screen. ⏸ SMS/WhatsApp fallback via a provider (cost per alert) for elders without the app.

### 7.5 Emergency card (per home)
Local emergency number for the country, nearest hospital (entered by family), Village contacts with call buttons, who to call first. No diagnosis, no medical advice — the app routes to people.

### 7.6 Risks
False alarms (phone died) → wording is calm: "Anya hasn't checked in yet. Her phone may be off." Abuse (controlling relatives) → she can pause or remove anyone, and they're not told why.

---

## 8. Plans & pricing 🆕

| Plan | India | Global | For |
|---|---|---|---|
| **Free** | ₹0 | $0 | Voices, photos, tree, Kitchen (5 recipes), Sit together, 3 languages, 100 Muse steps/month |
| **Family** | **₹399/month** | $4.99 / £3.99 | Everything, up to 12 people, all 29 languages, Care board, Safe & sound, weekly digest, 1,000 Muse steps |
| **Family Plus** | **₹999/month** | $12.99 / £9.99 | Up to 30 people, concierge orders (§9), recurring care automation, priority SMS/WhatsApp alerts, vault ⏸ |

- **Payments:** Razorpay (India: UPI AutoPay, cards) · Stripe (global). Annual = 2 months free.
- **Unit economics (to validate):** Muse cost per active family ~ ₹15–60/month at current usage (voice transcription dominates). Family plan margin must cover SMS alerts, which cost per message.
- **Honest risk:** families pay for *care*, not for photos. Lead with Care board + Safe & sound in the paywall, not storage.

---

## 9. Concierge — curated, never a marketplace 🆕

**Rule:** no listings by random sellers, no reviews wars, no local-unknown products. Aangan only offers a **small, curated set from licensed, named partners**, ordered on behalf of a family member, with the order tracked as a Care ticket.

### 9.1 What's real today (checked Oct 2026)
| Want | Reality | Path |
|---|---|---|
| Blinkit / Zepto / Swiggy Instamart one-click | **No public ordering APIs**; only unofficial "data APIs" (scraping) — not acceptable | Business partnership, or deep-link handoff ("Open in Blinkit with this list") |
| Groceries/food in India via an open API | **ONDC** — open network; non-retail apps act as *buyer apps* (e.g., Bajaj Markets added food & grocery via ONDC in 2025) | Become an ONDC buyer app (or use a buyer-app partner) — the cleanest legitimate route |
| Groceries in US | **Instacart Developer Platform** — public API: shopping lists → Instacart checkout | Integrate for US families |
| Cakes, flowers | Florists/bakery chains with B2B APIs (India: FNP / IGP-type partners; global: Interflora / 1-800-Flowers) | Curated 6–10 items, fixed partners |
| Medicines | India e-pharmacy rules (2018 draft) **still not notified**; online sale runs on older laws and court scrutiny | **Only via a licensed partner**, **only refills with a valid prescription uploaded**, no advice, no OTC upsell. Recommend ⏸ until a partner is signed |

### 9.2 Flow
Muse turns "Papa's milk and atta for the week" into a basket → **a person approves** (always) → partner order → ticket tracks it → parent sees "Groceries arriving 10–11 AM, Arjun ordered" in their language.

### 9.3 Revenue
Affiliate/partner commission on concierge orders + the Plus plan. Never sell family data. Never ads.

---

## 10. Family visual — beyond a tree 🆕

A family isn't only lineage; for families far apart it's **homes, distance and time**. Options considered:

| View | Shows well | Fails at | Verdict |
|---|---|---|---|
| Classic top-down tree | lineage | in-laws, uncles, pets, homes, distance | keep as a view |
| Living tree ✅ (trunk/branches/leaves) | generations, warm | wide families get wide | **Lineage view** |
| Radial kinship rings (you at the centre; rings = closeness) | extended family, scale to 50+ | homes, time | good for "how am I related" |
| Hexagon/geometric clusters | compact, pretty | relationships unclear | decorative only |
| World map with pins | distance | relationships, small countries, elders find maps hard | no |
| **The Aangan map** (recommended) 🆕 | **homes, who lives where, local time & day/night, pets, closeness — at a glance** | exact lineage (→ tap to Lineage view) | **Primary family view** |

**The Aangan map (recommended).** A top-down courtyard: an open square in the middle (the family itself), homes arranged around it like houses around a compound. Each **home** is a soft house tile with its people's portraits (and pets), labelled "Maa & Papa · Kanpur · 7:40 PM", tinted for **day or night** there. Homes sit around the square in **time-zone order** (going round the courtyard = going round the world), so time distance is visible. **Closeness** = distance from the centre: your parents' and children's homes on the inner ring, uncles/aunts/cousins on the outer ring, in-laws on the side of the person who married in. Thread lines connect homes that are parent-child. Tap a home → its people; tap a person → their page; toggle **Lineage** for the living tree.
Why: it's literally *aangan* (the compound), answers the questions families actually ask ("where is everyone, are they awake, who lives together"), scales by rings, and keeps the tree one tap away.

---

## 11. Brand

### 11.1 The courtyard image
The current landing photo is a **door**, not an *aangan*. An aangan is an **open-to-sky inner courtyard**: a central open square, a tulsi planter or tree in the middle, verandahs/pillars on all sides, sunlight falling into the centre. Sourcing rule: we **cannot** use images from Google search (copyright). Options: (a) generate with **Muse Image** (Meta tool, fits the hackathon, labelled AI-generated) ✅ recommended; (b) licensed stock (Unsplash licence); (c) your own photo. Several regional versions (North Indian haveli, Kerala nalukettu, Mediterranean patio) rotate for global families.

### 11.2 Logo concepts
1. **Open square** — four L-shaped walls forming a square with the centre open to the sky, a small marigold dot in the middle (presence / the family). Reads as "courtyard" in every culture, works at 16 px.
2. **Nalukettu mark** — a square with a smaller rotated square inside (the open centre), roof lines implied. More Indian, less universal.
3. **Monogram "a"** whose counter is a square courtyard. Wordmark-friendly.
Recommendation: **#1**, wordmark "Aangan" in Onest semibold, marigold dot as the only colour. App icon: white square plan on warm ink.

---

## 12. Muse — capabilities and guardrails

Muse is the backstage helper (powered by Meta Muse models), **never a family member**.
| Does | Never |
|---|---|
| Write down voices, recipes, needs; translate into 29 languages | Chat with lonely elders in place of family |
| Ask elders one gentle question a week | Post as a person |
| Draft care notes to parents in their language; route tickets | Give medical, legal or financial advice |
| Build a grocery basket for approval (Plus) | Place an order or spend money without a person approving |
| Write the weekly family digest | Read the Vault unless the owner asks |
All Muse steps: validated output, grounding checks, cached, spend-capped, logged in *What Muse did* ✅.

---

## 13. Data & engineering changes

| Change | Where | Risk |
|---|---|---|
| `ticket` doc kind (+ history, recurring), migrate `need` | family_docs | low; on-read migration |
| `pet` doc kind; pets in homes | family_docs | low |
| Extended relations (sibling of parent, cousin) | relationships + kinship resolver | medium: kinship words per language |
| `safety_checkin`, `safety_settings` | family_docs; location TTL 24 h | **high**: privacy, false alarms; needs push |
| Web push (VAPID) | new: service worker + `push_subscriptions` table | medium: iOS requires home-screen install |
| Family news posts + weekly digest | family_docs + cron | low |
| Plans & billing | Stripe/Razorpay webhooks, `subscriptions` table, entitlements check in API | medium; **not for the hackathon** |
| Concierge orders | partner adapters (ONDC buyer app / Instacart / florist) behind one `Order` interface | high; partnerships needed |
| Aangan map view | client component, pure layout | low |

---

## 14. Hackathon cut (deadline 4 Nov 2026, 9 PM ET)

Judges score: impact, Meta tooling, technical quality, design. Five build days left. Recommended order:

| Day | Build |
|---|---|
| 29–30 Oct | Care board (ticketing) · Safe & sound (without push: in-app statuses + overdue banner) · extended family + pets in the add flow |
| 31 Oct | Aangan map view · courtyard image (Muse Image) · logo |
| 1 Nov | Family news + Muse weekly digest · finish CRUD UIs (Sit RSVP/reschedule UI, card menus QA) |
| 2 Nov | Plans screen (pricing, "coming soon" checkout) · concierge **prototype** (cake/flowers from a fixed catalog, order as a ticket; no real payment) |
| 3 Nov | Hardening, live Muse + Supabase test, demo video, README |
| 4 Nov | Buffer + submit |
**Not in the hackathon:** real payments, real partner orders, medicines, Vault, SMS alerts.

---

## 15. Decisions (agreed 29 Oct 2026)

1. **Primary family view:** the Aangan map, with the living tree one tap away as *Lineage*.
2. **Safe & sound:** status check-ins and overdue alerts; location is sent **once, only on "I need help"**. No continuous location.
3. **Pricing:** ₹399 Family / ₹999 Family Plus (global equivalents), as in §8.
4. **Concierge in the demo:** a clearly-labelled prototype — fixed curated catalog, the order becomes a care ticket, no real payment or partner order.
5. **Medicines:** parked until a licensed partner is signed.
6. **Logo:** open square + marigold dot.

---

*Sources checked for §9 (Oct 2026):* quick-commerce "APIs" are unofficial data scrapers (slideshare.net/slideshow/quick-commerce-data-apis-...); ONDC buyer apps incl. Bajaj Markets food & grocery (inc42.com/buzz/bajaj-markets-ventures-into-grocery-food-delivery-via-ondc); Instacart Developer Platform (docs.instacart.com/developer_platform_api); India e-pharmacy draft rules not notified (vajiramandravi.com e-pharmacy explainer).
