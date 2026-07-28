# CoffeeStop — Where We Are, and What It Would Take to Win

*Written for a non-developer. Terms are explained as they come up.*
*Date: July 2026*

---

## Part 1 — Honest evaluation of what exists today

### What we have

One web page, `coffeestop.html`, that looks and behaves like a phone app. It has four
tabs at the bottom. Two of them are real:

| Tab | State | What it does |
|---|---|---|
| **Nearby** | Built | A map with six coffee shops. Tap one and the map zooms in, the pin turns into an espresso cup, and a panel slides up with the details. There's a filter panel (open now / brew method / score / price). |
| **Search** | Empty | Placeholder text only. |
| **Saved** | Built | Your saved shops as cards. Tap one to jump back to it on the map. Tap the heart to remove it. Survives closing the browser. |
| **You** | Empty | Placeholder text only. |

### What's genuinely good

**The information design is the real asset.** Most coffee apps tell you *where* a
café is. This one tells you *what's in the cup* — the bean's country and region, how
it was processed, the trade relationship, which brewing methods they actually offer.
That "Currently pouring" card is the most valuable idea in the whole prototype, and
Part 3 explains why.

**The craft is high.** The animations, the colour palette, the way the pin morphs into
an espresso cup — this looks like a product someone cared about, not a wireframe.
That matters more than it sounds: it's what makes people take a prototype seriously.

**The atmosphere tags are quietly smart.** "Quiet", "No laptops", "Dog-friendly",
"Outdoor seating". Research (Part 3) says this is one of the top things people
actually search on, and most specialty coffee apps ignore it.

### What it is *not* — and this is the important part

It's easy to look at this and think it's nearly an app. It isn't. Here's the honest picture:

- **The map is a drawing.** It's a hand-drawn illustration of streets that don't exist.
  It is not connected to any mapping system. It cannot show your real location, real
  streets, or real distances.
- **The six shops are made up.** Names, scores, beans, distances — all typed in by
  hand. There is no source of real coffee shops behind it.
- **There is no "backend".** A backend is the part that lives on a server and holds
  everyone's data. This has none. Your saved list is stored only in your own browser,
  on that one device. Clear your browser and it's gone. There are no accounts, no way
  for two people to see the same thing.
- **It isn't installable.** It's a web page dressed as a phone. There's nothing to
  download from an app store yet.
- **Half the tabs are empty.**

**A fair way to describe it:** this is a *very* good-looking answer to "what should
the app feel like?" and a complete non-answer to "where does the information come
from?" In product terms it's maybe the first 10% of the work — the most visible 10%,
and the part that makes the other 90% worth doing, but 10% all the same.

### One thing I'd change on credibility grounds

Each shop shows a "cup score" — 93, 89, 91 — and labels like "Outstanding" that come
from the SCA scale (the Specialty Coffee Association's official 100-point system).

The problem: **that scale scores a specific coffee, not a café.** A trained taster
cups one particular batch of beans and gives *that coffee* an 89. There is no such
thing as an SCA score for a shop. Serious coffee people will spot this immediately,
and it's exactly the kind of detail that decides whether they trust the app or
dismiss it.

It's fixable and the fix is an improvement: either score the *coffee currently being
poured* (which is legitimate, and reinforces the app's best idea), or drop the number
and rank shops another way. I'd not carry the shop-level number forward.

---

## Part 2 — Does this app already exist?

**Yes. Several of them.** This is a real, occupied market — which is useful to know
now rather than in six months.

| App | What it is |
|---|---|
| **Roasters** | The biggest. 23,000+ cafés and roasters, 126 countries. Community-added and reviewed. Free, with a paid "Pro" tier. |
| **Beanhunter** | Was the original — 100,000+ cafés, 160+ countries. Now widely reported as abandoned: crashes, outdated listings, ~2-star ratings, "doesn't look like it's active anymore." |
| **Best Coffee** | Curated guide to the global specialty scene. |
| **Beany** | Curated third-wave shops across 1,500+ cities. |
| **Cappuccin** | 1,463 shops, 62 countries. Leans social — track where you've been, see where friends go. |
| **Tampd** | Explicitly filters for cafés sourcing traceable beans, ~80+ SCA. |
| **Artisan** | Independent, non-chain shops only. |
| **Siip** | "Vivino for coffee" — 30,000+ *coffees* from 3,000+ roasters. Scan a bag, build a taste profile. About beans, not cafés. |
| **SpotACafe / WorkFrom / Work From Café / Work Hard Anywhere** | A separate cluster, all about working from cafés: wifi speed, power outlets, noise, seating. |
| **Google Maps** | The actual competitor. Everyone already has it. |

**Two important patterns in that list.**

*First, these apps keep dying.* Beanhunter had 100,000 cafés and still decayed into
irrelevance. That tells you the hard part isn't building the app — Beanhunter built
it and won — the hard part is **keeping the information true** year after year. Cafés
close, change beans, change hours. A listing that's wrong twice loses the user forever.

*Second, the market is split down the middle* between "I want excellent coffee" and
"I want to work here for three hours." They're different people with different
questions, and most apps quietly serve one while pretending to serve both. CoffeeStop
currently has a foot in each camp (bean origins *and* laptop-friendliness). That's a
choice worth making deliberately.

---

## Part 3 — What coffee lovers actually want

From app reviews, coffee forums, and how enthusiasts describe finding coffee in a new city.

### 1. "Just tell me it's good" — trust, not volume

The single loudest complaint about existing apps, from a coffee forum:

> *"I'm not sure how apps determine whether to include a cafe or not. The definition of
> specialty coffee seems blurry. Too many listings where coffee is secondary to food.
> Too many times visiting a listing hoping for pour over coffee and finding only batch
> brew, or worse only milk coffees."*

That is a **trust** problem, not a coverage problem. More listings made it worse. The
user wants to know *why* a shop is in the app and *who says so*.

**This is a real opening.** Almost nobody shows their standards. An app that says
plainly "this shop is here because it roasts its own beans and offers pour-over,
verified in March" would stand apart immediately.

### 2. People follow roasters, not cafés

The most common expert technique for finding good coffee in a new city:

> *"A city with a strong coffee scene almost always has a few roasters that quietly
> supply many of the best cafés. Once you find one good roaster, it often leads you to
> several other strong spots."*

Enthusiasts navigate **by bean supplier**. Find one roaster you like, and you've found
five cafés. No mainstream app is built around this — they're all built around location.

CoffeeStop's "Currently pouring" card is *already* the right shape for this and
nobody seems to have noticed the opportunity.

### 3. Nobody knows what's actually being poured today

I went looking specifically for an app that shows what beans a café is serving right
now — rotating single origins, guest roasters, this week's espresso.

**I couldn't find one.** Cafés announce it on Instagram and a chalkboard, and that's it.

This is the sharpest finding in the whole research. The thing the prototype already
puts front and centre is the thing no competitor does. It's genuinely differentiated.

It is also, not coincidentally, the **hardest thing to keep accurate** — see Part 5.

### 4. The practical stuff decides where people actually go

For the work-from-café crowd, the deciding factors are consistently: wifi speed, power
outlets, noise level, seating availability, how long you can reasonably stay, and
whether laptops are welcome at all. An entire category of apps exists just for this.

The prototype's atmosphere tags are a start, but "Quiet" is an opinion. "Measured 58dB
on weekday mornings, most people stay 2 hours" is information.

### 5. Don't paywall the basics

A review of the leading app:

> *"searching for local cafes when traveling now requires a subscription, which will
> turn many users away."*

Charging for the core action — finding coffee near you — reads as a bait-and-switch.
Worth remembering when the money question comes up.

---

## Part 4 — How CoffeeStop could become someone's number one app

Blunt version first: **it will not out-cover Google Maps, and shouldn't try.** Google
has every café on earth. Competing on "more shops" is a fight that's already lost, and
Beanhunter proves that winning it doesn't even help.

Winning looks like being **the trusted, opinionated guide for people who care** —
where the pitch isn't "we have more" but "we only show you good ones, and we tell you
why." Small and right beats big and stale.

Four suggestions, in order of how much I believe in them.

### Suggestion 1 — Own "what's pouring right now"

Lead with the thing nobody else does. Not "here are cafés near you" but *"Kettle &
Stone is pouring a washed Kenyan from Nyeri this week."*

That's a reason to open the app on a Tuesday, which is the whole game — discovery apps
die because people open them twice a year while travelling.

**Where the data comes from is the real question,** and I think the answer is
**roasters, not cafés.** A café is a busy small business that will never update your
app. But a roaster knows exactly which cafés bought which beans this week, and has a
direct commercial interest in people knowing their beans are being poured at that
café. Sign up ten roasters in one city and you've covered fifty cafés, updated at the
source, for free.

To my knowledge nobody is doing this. It's the strongest idea here.

### Suggestion 2 — One city, done properly

Every competitor is a mile wide and an inch deep — thousands of cities, thin and
ageing data in each.

Do the opposite. Pick one city, be genuinely complete and genuinely current there, and
let it be *known* as the thing you use in that city. A hundred people who use it
weekly in one city is a real product. Ten thousand who used it once in fifty cities is
a database that's already rotting.

It also makes the work possible for a small team: you can physically visit every shop
in one neighbourhood. You cannot visit 23,000.

### Suggestion 3 — Show your work

Directly answering the loudest complaint. On every shop, state:

- **Why it's listed** — "Roasts in-house. Offers pour-over. Single-origin espresso."
- **When it was last checked** — "Verified 12 June 2026." Ageing entries visibly age.
- **Who checked** — the team, a named local, the roaster.

Nobody does this. It costs nothing to display and it's the entire difference between
"another list" and "a guide I trust."

And publish the standard: *this is what gets a shop into CoffeeStop.* Being openly
exclusive is a feature to this audience, not a limitation.

### Suggestion 4 — Answer the question people actually have

The real question is rarely "show me all coffee near me." It's **"I have 20 minutes,
where should I go right now?"**

An app that answers with *one* recommendation — right for the time of day, how far
you'll walk, whether you're sitting down or grabbing and going, what you liked before
— is a fundamentally different product from a map full of pins. The map becomes the
backup, not the main event.

This is where the "You" tab earns its place: not a settings page, but the taste profile
that makes the single recommendation good.

### And a decision to make

**Are you serving the taste person or the laptop person?** Bean origins and processing
methods speak to one. Wifi and power outlets speak to the other. Both are legitimate,
both have proven demand, and trying to be both at once is how products end up
forgettable.

My read: the prototype's soul is clearly the taste person — nobody builds a
"Currently pouring" card for someone hunting a power outlet. I'd commit to that, keep
the atmosphere tags as useful secondary detail, and leave the work-café market to the
apps already serving it.

---

## Part 5 — The uncomfortable part

Two things worth saying plainly, because they're the things that actually decide this.

**The hard problem is data, not design.** Everything appealing about this app depends
on information that is expensive to get and expensive to keep true. "Currently pouring"
is the best idea *and* the hardest to maintain — it's wrong within a week if nobody
updates it. Beanhunter died of exactly this. Before building more screens, the
question worth answering is: *where does the information come from, and what makes it
still true in six months?* The roaster idea in Suggestion 1 is my best answer, and
it's worth testing by talking to two or three roasters before writing more code.

**This kind of product is genuinely hard to grow.** It needs cafés and users at the
same time, and each is only worth having if the other is there — the classic
chicken-and-egg problem. The reported failure rate for this shape of business is
brutal. The one-city strategy in Suggestion 2 is the standard countermeasure: make the
chicken-and-egg problem small enough to actually solve.

None of this argues against building it. It argues for building it in a specific
order: **prove you can keep one neighbourhood's data true for two months before
building the other two tabs.** That's a cheap experiment and it answers the only
question that matters.

---

## Part 6 — Suggested next steps

**Non-technical, in the order I'd do them:**

1. **Talk to three roasters.** Ask if they'd tell you weekly where their beans are
   being poured. Their answer decides whether Suggestion 1 is real. This costs three
   coffees.
2. **Pick the city.** Everything downstream depends on it.
3. **Hand-build the real list.** 20–30 shops in one neighbourhood, real data, written
   by hand. If it's dull to compile, it'll be dull to use.
4. **Write down the inclusion standard.** One paragraph: what gets a shop in.
5. **Decide: taste person or laptop person.**

**Technical, once the above is answered:**

6. Real map (Leaflet or MapLibre — free mapping tools that show actual streets).
7. Real location (the browser can ask "where am I?" with permission).
8. Real data behind it, replacing the six hardcoded shops.
9. Build the Search and You tabs — *last*, because what they should contain depends
   entirely on answers 1–5.

The existing handoff document (`coffeestop-handoff.md`) has the detailed technical
list. The point of the ordering above is that steps 1–5 cost almost nothing and change
what steps 6–9 should be.

---

## A note on the name

I've used **CoffeeStop** throughout. Your message said "CoffeStop" with one *e*, which
I read as a typo — say the word and I'll switch it, it's a quick change.

Worth checking before it sticks: the app stores, and whether the domain is free.
"Coffee Stop" is a common phrase, so there may well be something already using it.

---

## Sources

- [Best Coffee Apps in 2026 — Siip Coffee](https://www.siip.coffee/guides/best-coffee-apps-2026)
- [Best Coffee Apps in 2026 — Beans with Beanie](https://www.beanswithbeanie.com/guides/best-coffee-apps-2026)
- [Roasters — Find Specialty Coffee, Anywhere](https://www.roasters.app/)
- [Roasters on the App Store](https://apps.apple.com/us/app/roasters-great-coffee-inside/id1466079049)
- [Beanhunter alternatives / status](https://alternativeto.net/software/beanhunter)
- [Tampd — Specialty Coffee Finder](https://apps.apple.com/us/app/tampd-specialty-coffee-finder/id6755039525)
- [Cappuccin — Coffee Shop Finder](https://apps.apple.com/us/app/cappuccin-coffee-shop-finder/id6755759425)
- [Beany — Find Specialty Coffee](https://apps.apple.com/us/app/beany-find-specialty-coffee/id1604213257)
- [Artisan — Coffee Shop Finder](https://apps.apple.com/us/app/id1521699791)
- [What are good apps for discovering cafes? — Home-Barista forum](https://www.home-barista.com/knockbox/what-are-good-apps-for-discovering-cafes-t91331.html)
- [How to Find Great Coffee in a New City — Micro Espresso](https://www.microespresso.com/blogs/news/how-to-find-great-coffee-in-a-new-city)
- [SpotACafe — cafés to work from](https://www.spota.cafe/)
- [This App Will Help You Find The Best Laptop-Friendly Coffee Shop — Money](https://money.com/app-best-coffee-shop-wifi/)
- [Coffee Shops with Best Free WiFi for Remote Work — SmartMove](https://www.smartmove.us/learn/internet-tips/coffee-shops-with-the-best-free-wifi-for-remote-work)
- [Why Two-Sided Marketplaces Fail After Launch — RaftLabs](https://www.raftlabs.com/blog/two-sided-marketplace-failure-rate)
- [The Platform Trap: cold start problem — SoftwareSeni](https://www.softwareseni.com/the-platform-trap-why-most-platforms-fail-before-reaching-critical-mass-and-how-to-overcome-the-cold-start-problem/)
