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

### 5.4 Family (constellation) ✅ — see §10 for the visual design
| Op | Who |
|---|---|
| C add person by relation (incl. uncle/aunty/cousin/pet 🆕) | member+ |
| C link existing people ✅ | member+ |
| U person details ✅ · D remove link ✅ · D remove person ✅ | member+ / admin for accounts |
| R search a person 🆕 (families of 40+ need it) | everyone |
| R re-centre on anyone (tap) ✅ · full screen ✅ · zoom ✅ | everyone |
| C "Add to {person}" from the canvas ✅ | member+ |
| C share/download the family poster (PNG, 4:5) ✅ | everyone |

### 5.5 Memory Lane ✅🔧
R by person/season ✅ · C voice/photo/video ✅ · U fix caption/words ✅ (author) · D delete ✅ (author/admin) · R search by words 🆕 · C tag people/pets 🆕 · *Export my memories* 🆕 (privacy law).

### 5.6 Kitchen — a family recipe library ✅
Shelves, one per cook (elders first, then you, then everyone else), each a horizontal row of recipe tiles; search by name or ingredient; filter by course. A recipe has: course, prep/cook minutes, serves, *before you start* (prep work), ingredients (as the cook says them + ≈ guide), method with the cook's tips, *how you know it's right*, the voice note and/or video it was taught in.
C write one (yours, or written down for someone: they become the cook, you can still edit) ✅ · C teach by voice ✅ · C ask an elder ✅ · R recipe in my language ✅ · U edit recipe ✅ (cook) · D delete recipe ✅ (cook/admin) · C "I made this" ✅ · D my attempt ✅ · C/D bless ✅ · C cook together → Sit together ✅ · 🆕 order missing ingredients (§9).

### 5.7 Sit together ✅
C sitting with a reason ✅ · R everyone-awake windows ✅ · U reschedule (host, resets RSVPs) ✅ · C/U RSVP ✅ · D cancel (host) ✅ · C/D open/close my door ✅ · C .ics ✅ · 🆕 keep a moment afterwards (photo → Lane), recurring sittings ("every Sunday chai").

### 5.8 Care — rebuilt as a ticket tracker (§6) ✅
Neutral naming: the room is **Care**, the subheading says *Parents' home* (or *Your home* for a parent), never "Care for Dadi & Dada". **Both sides add tasks**: parents see the same shared board as their children (plus "Ask by voice"), and anyone can take a task, parents included. **Local helpers** (renamed from "Village"): a shared contact book per home — grouped (Daily needs, Home, Getting around, Health, Home services, Neighbours, Pets), one tap to call or WhatsApp, availability hours, "helped N×", pick from phone contacts on Android.

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

## 10. Family visual — beyond a tree ✅ (constellation shipped 29 Oct)

**Shipped: the family constellation** (replaces the living tree after feedback: "dots and connections, not a literal tree"). You at the centre; parents above, siblings to the sides, partner beside you, children below; each further ring is one more step of kinship. Every group keeps its own direction (empty directions stay empty); big branches get more angle (damped) so nobody is pushed out of place. **One line per person** (to whoever connects them) plus short gold lines for couples, so lines never cross — enforced by a test for every possible centre. Tap anyone to put them at the centre and see the family from where they stand (labels re-resolve: "Mother-in-law", "Cousin", "Niece"). Header: family name and the numbers families are proud of (people, generations, homes, time zones). Downloadable 4:5 poster. The Aangan map below remains a candidate *Homes* view.

Earlier analysis, kept for the record:

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

1. **Primary family view:** ~~the Aangan map, with the living tree as Lineage~~ → **the constellation** (29 Oct feedback). The Aangan map may return as a *Homes* view.
2. **Safe & sound:** status check-ins and overdue alerts; location is sent **once, only on "I need help"**. No continuous location.
3. **Pricing:** ₹399 Family / ₹999 Family Plus (global equivalents), as in §8.
4. **Concierge in the demo:** a clearly-labelled prototype — fixed curated catalog, the order becomes a care ticket, no real payment or partner order.
5. **Medicines:** parked until a licensed partner is signed.
6. **Logo:** open square + marigold dot.

7. **Care naming:** neutral ("Care", "Parents' home"); "Village" → **Local helpers**.
8. **Sharing:** only what a member explicitly shares leaves the family, as a revocable frozen copy (§16).

---

## 16. Sharing, export and growth ✅ (first pass)

**Privacy model.** Nothing leaves a family by default. A member (never a child account) chooses one thing; it becomes an **unguessable link** (144-bit token) to a **frozen copy** of only that thing: for a recipe, the recipe and the cook's call-name ("from Dadi's kitchen"), never surnames, voices, photos of people or family data. One live link per thing, a view counter, **Stop sharing** from the recipe or Settings (the link then says "no longer shared"). Public pages are `noindex`. Table `public_shares`.

**Export.** Settings → *Download our family's data*: one JSON file (members without emails, relationships, memories, recipes, care, pets, sittings…). Muse logs, knocks and safety check-ins (locations) are excluded. Children can't export.

**Where sharing has the most pull** (ranked by reach × how natural it is):
| Surface | Format | Status |
|---|---|---|
| Recipe | WhatsApp link · public page · image card · text | ✅ |
| Family poster | 4:5 PNG (share sheet / download) | ✅ |
| Invite an elder | WhatsApp message with join code, in their language | next |
| Birthday / occasion | a card (photo + wishes) or the voices compiled | next |
| A memory | image card with caption, author's consent | next |
| *This week in the family* | digest card | with family news |
| Printed things | frame, poster, recipe book (§17.5) | prototype |
Every public surface ends with one quiet invitation ("Whose cooking do you miss? Start your family's kitchen") — that's the loop; no referral spam, no contact uploading.

---

## 17. Review of 29 Oct requests — recommendations before building

### 17.1 Where each person lives (Settings)
**Do:** a *Home* field per person: city + country picked from a list (or "use my location" **once**, reverse-geocoded to the city and then discarded). Stored at **city level only** (city centroid, not the address). It drives the time zone, emergency number, weather and local news. Anyone can set it for a person without an account; a person with an account owns theirs. **No tracking**, ever; Safe & sound stays separate.
**Risk:** city lists for 29 languages — use English names + transliteration; fallback to free text + time zone.

### 17.2 Weather and the sky behind their page
**Do:** on a person's page and their home card: "25 °C · sunny in Kanpur · 7:40 PM", over an **ambient sky** drawn in SVG/CSS (sun, drifting clouds, rain, stars and moon at night), from the weather code + local sunrise/sunset. Honours reduced motion.
**Source:** Open-Meteo for the hackathon (no key; commercial use needs their paid plan) or MET Norway (free incl. commercial, attribution + User-Agent). Server-side cache per city for 30 min (≈ 48 calls/city/day regardless of family size).

### 17.3 Positive local news ("what's happening near Papa")
**Do, carefully.** "Around Kanpur today": up to **10** items (not 30: elders skim; 30 becomes a feed), refreshed daily, each a headline + one-line Muse summary in the reader's language + **link to the source** (no copied articles).
**Pipeline:** GDELT DOC API (free; has location and a *tone* score) → hard keyword blocklist (crime, death, accident, suicide, politics, communal, scams, disease scares) → **Muse classifier with an allowlist** (community events, festivals, civic services like water/power schedules, weather, health camps, schools, sports wins, openings, culture) → only "confident positive or useful" shown; anything uncertain is dropped.
**Risks:** a single distressing headline in an elder's feed does real harm → show nothing rather than something doubtful; publisher licensing → headline + link only; cost → classify once per city per day, cached.

### 17.4 No blank screens without photos
**Do:** one illustration system, people-free (the way Google's product art shows connection without faces): flat geometric shapes, warm palette (marigold, terracotta, sky). Already started: recipe covers by course, monogram rings, the constellation. Next: a per-person **home tile** (a little house in their city's sky), empty states for Memory Lane / Occasions / Care, and an onboarding courtyard that fills in as people join ("the app grows as you use it"). Never generate fake photos of people.

### 17.5 Legacy — the portrait hall
Royal families keep a **gallery of forebears**: large framed portraits, names, years, one line about each, in order. **Do:** a *Legacy* room: ancestors (including those who have passed) as big framed portraits with dates, place, a story, their recipes and any recorded voice; *the line* from them to the youngest child; **In memory** treatment (no birthday nudges; an optional remembrance day the family chooses). Needs `born`, `died`, `inMemory` on a person.
**Do not:** add gotra/caste/lineage-purity fields (caste is a data category we never store); no "family honour" ranking.

### 17.6 Our own store — and the frame
Recommendation: **don't run inventory.** Home decor, daily needs and generic gifts are low-margin, logistics-heavy, and the "marketplace" we promised to avoid. What only Aangan can sell is **things made from the family itself**, via print-on-demand partners (global APIs: Printful/Printify/Gelato; India: Printrove/Qikink):
- **Framed family photo**, e.g. 10×10 in (needs ≥ 3000×3000 px for 300 dpi; we warn below that)
- **The family poster**, framed
- **The family cookbook**: every recipe on the shelves, printed (strongest gift + virality)
- Birthday calendar, a mug/cushion with Dadi's handwriting or recipe
Daily needs stay as concierge deep-links/partners (§9). Payments via Razorpay (India) / Stripe (global); GST invoices; returns are the partner's.
**Hackathon:** a labelled **store prototype**: frame + poster + cookbook previews rendered from real family content, "coming soon" checkout.

### 17.7 Proposed order (6 days to deadline)
| Stage | Build | Why first |
|---|---|---|
| 9 | Home city in Settings · weather + ambient sky on person pages/home cards · illustration system for empty states | visible on every screen; demo wow |
| 10 | Store prototype (frame 10×10, poster, cookbook) + Plans screen | monetisation story for judges |
| 11 | Legacy hall | emotional core, unique |
| 12 | Positive local news (GDELT + Muse filter) | Meta/Muse showcase; needs care |
| 13 | Share-everything: invite via WhatsApp, occasion card, memory card | growth loop |

---

## 18. Did we cover the research? (audit, 29 Oct)

Source: the 26 Oct evidence brief (ikigai/Okinawa, Holt-Lunstad, WHO 2025, Baldassar's copresence, Hilbrand "being needed", Harvard, Carstensen, Gottman, Fingerman, Bengtson) and the ikigai table that shaped the PRD.

| Lesson | What it asks of Aangan | Status |
|---|---|---|
| Ikigai: a reason to get up | One small daily role for elders ("Teach Aria one word") | ✅ daily roles (ritual agent) |
| Ikigai: never fully retire / give | Elders give: recipes, advice, tasks for children | ✅ Kitchen, weekly question, parents add care tasks |
| Ikigai: being needed by the next generation | **Bedtime stories for grandchildren** | ❌ → §19 Stories |
| Ikigai: small joys | "Aaj ki ek achhi baat" (one good thing a day) | 🔧 presence moments only → add "one good thing" to Share my day |
| Ikigai: flow | Deep stories, crafts, recipes | ✅ recipes · ❌ life-story chapters (P1) |
| Ikigai: moai | A small circle that does things together | ✅ family · ❌ **doing things together** → §20 Together |
| Baldassar: virtual copresence | voice, video, same time | ✅ voices, Sit together |
| Baldassar: proxy copresence | gifts, objects | 🔧 store/concierge prototype (§17.6) |
| Baldassar: imagined copresence | memories, their day | ✅ Memory Lane, presence, (§17.2 sky/weather) |
| Baldassar: physical copresence | **plan visits, count down to them** | ❌ → §20 "Plan a visit" template + countdown |
| Hilbrand: being needed (37% lower mortality for occasional carers) | grandparent story time, homework help, advice | ❌ story time → §19 · ❌ homework hour → §20 |
| Harvard: small and frequent | 30-second daily rituals | ✅ |
| Carstensen: few, deep, positive | small circle, positive-first | ✅ (and §17.3 positive-only news) |
| Gottman: turning toward bids | answer the parent's bid within 24 h; north-star metric | ✅ Heard loop, reply-first dock · ❌ metric in *What Muse did* |
| Fingerman: ambivalence | warm repair, no guilt loops | ✅ no guilt copy · ❌ repair nudges (post-hackathon) |
| Heritage & language | elder's word of the day | ❌ → §20 template "A word a day" |
| Family news ("gossip") | short posts + weekly Muse digest | ❌ (§5.9, still planned) |
| Milestones | first day of school, new job | ⏸ |

**Gaps worth closing before 4 Nov:** Stories (§19), Together templates incl. plan-a-visit, a-word-a-day, homework hour (§20), "one good thing", and the bids metric (one line in *What Muse did*: "Dadi's voices answered within 24 h this week: 5 of 6").

---

## 19. Stories — the kids' corner 🆕

**Why:** being needed by the next generation is the strongest ikigai lesson and the best-evidenced (Hilbrand). A grandparent telling a bedtime story across the world is the single most emotional moment the app can create.

**Who does what**
- **Elders tell** (one tap: *Tell a story*): record voice (or video). Muse writes the title, picks a theme (animals, gods & legends, our village, family history, funny, lesson, lullaby), a one-line summary and a cover, and suggests an age band. The teller can change any of it.
- **Muse helps them start** (never tells the story for them): prompts from the family's own memory ("the day you got lost at the mela", "how Dada learned to swim") and from what a child asked for.
- **Kids listen**: a bright *Kids corner* with shelves per storyteller; **Bedtime mode** (dark, warm, big play button, plays a chosen teller's stories in a row, **sleep timer 10/20/30 min**, then stops; never autoplays anything else).
- **Kids ask**: "Dadi, tell me a story about elephants" (by voice or a picture chip). It reaches the teller as a request on their courtyard.
- **Kids answer back**: "Tell me another!" and the three reactions; the teller sees "Leo listened at bedtime · 8:40 PM his time".
- **Words, not just sound**: the transcript plays along (karaoke style, in the child's language, original one tap away), so a story in Hindi still reaches a child abroad. Language heritage, with no lessons.

**Operations:** C tell (voice/video) · C turn an existing voice note into a story · U title/theme/age/summary (teller, admin) · D story (teller, admin; the voice note stays in Memory Lane unless also deleted) · C request a story (anyone, kids included) · D/withdraw a request (asker) · R shelves, themes, bedtime playlist · C/D "listened" (automatic, per play).

**Safety:** stories never leave the family (no public share of voices); child accounts can listen and ask, not delete; Muse's classifier only labels themes, it doesn't judge content.

**Data:** `story` doc: `{id, tellerId, cardId, title, theme, ages, summary, lang, requestId?, createdAt}`; `story_request`: `{id, askedBy, toMemberId, about, status, storyId?, createdAt}`. Listens reuse `plays`.

---

## 20. Together — ready-made things to do as a family 🆕

**Why:** "do activities together, not interviews" (Ames et al.) and moai; physical copresence (Baldassar). Families want to do things together but someone has to think of it and organise it. Templates remove both.

**A template** (data-driven, `together/*.json`, never hard-coded): title, kind (**Play · Make · Learn · Celebrate · Visit**), time, ages, who's needed, what you need, steps, roles (Host, Quizmaster…), and a **starter task list**. *Start* turns it into a **family project**: the task list with people assigned (anyone can add, edit, tick, reassign, delete), an optional date that books a *Sit together*, and "keep a moment" afterwards (photo/voice → Memory Lane).

**Starter set (12)**
| Kind | Template | Muse's part |
|---|---|---|
| Play | **Family quiz night**: questions about *your* family | Writes 8–10 questions from Memory Lane, recipes and the tree (grounded, cached, never invented facts) |
| Play | Antakshari across homes | Suggests first letters; keeps score |
| Play | Guess the baby photo | — |
| Play | Two truths and a lie, grandparents' edition | — |
| Make | **The family cookbook** (one recipe from every home by Sunday) | Tracks who's still to add one |
| Make | Plant something in every home | — |
| Make | Festival decorations, same theme, every home | — |
| Learn | **A word a day** (an elder teaches one word to a grandchild for 7 days) | Picks the words from the elder's language |
| Learn | Homework hour with Dadi/Dada | — |
| Learn | Teach me your skill (knitting, rangoli, cricket grip) | — |
| Celebrate | Surprise for someone's birthday (wishes, a song, a card) | Hands off to Occasions/Reel |
| Visit | **Plan a visit home** (dates, tickets, gifts, what to cook) | Countdown on the courtyard for both homes: "12 days till Arjun is home" |

**Operations:** R gallery by kind · C start a project from a template · C blank project · U title/date · C/U/D tasks, assign, tick · D project (creator/admin) · C book it as a Sit together · C keep a moment.

**Data:** `project` doc: `{id, templateId, title, kind, createdBy, dueAt, sittingId?, tasks:[{id,text,assignee,done}], status, createdAt}`. Quiz questions cached per family and template.

**Not:** points, leaderboards, streaks or guilt ("You missed 3 days"). Celebrate together, never rank people.

---

*Sources checked for §9 (Oct 2026):* quick-commerce "APIs" are unofficial data scrapers (slideshare.net/slideshow/quick-commerce-data-apis-...); ONDC buyer apps incl. Bajaj Markets food & grocery (inc42.com/buzz/bajaj-markets-ventures-into-grocery-food-delivery-via-ondc); Instacart Developer Platform (docs.instacart.com/developer_platform_api); India e-pharmacy draft rules not notified (vajiramandravi.com e-pharmacy explainer).
