# Launch Strategy — Agents Inc

## Context

This is a niche power-user tool for Claude Code specifically — not a general AI coding assistant.
The total addressable audience on launch day is in the hundreds, not tens of thousands.
The goal is not a big splash — it's reaching every Claude Code power user who exists.
That community is small enough to actually do that.

---

## Positioning

**One-line hook:**

> The fastest way to set up specialized Claude Code subagents for your stack.

**Alternate (technical angle):**

> Compose Claude Code subagents from 154 modular skills — stack-aware, fully ejectable.

**Show HN title:**

> Show HN: Agents Inc – manage Claude Code skills and subagents from the CLI

**Every post must include:**

- The problem: Claude Code ships with generic agents; writing specialized ones from scratch is tedious
- The solution: skill library + interactive wizard + stack presets
- The wizard demo GIF
- `npx @agents-inc/cli init` as the single CTA
- Ask for a star

**Pitch to Claude Code users specifically:**

> If you already use Claude Code, this gives you specialized agents matched to your tech stack in one command. Pick Next.js + Drizzle + Hono, and you get agents that already know those tools deeply.

---

## Platform List

### Tier 1 — These are the right audience, do them on launch day

| Platform                           | Format                               | Notes                                                             |
| ---------------------------------- | ------------------------------------ | ----------------------------------------------------------------- |
| **Anthropic Discord**              | Post in #claude-code or equivalent   | Highest signal — these are your exact users                       |
| **r/ClaudeAI**                     | Post with demo GIF                   | Most directly relevant subreddit                                  |
| **Claude Code GitHub Discussions** | Post or comment in a relevant thread | The power-user community lives here                               |
| **X / Twitter**                    | Thread with wizard GIF               | Tag @AnthropicAI, use #ClaudeCode — Anthropic team is active here |
| **Hacker News**                    | "Show HN:" text post                 | Post 8–10am US Eastern; engage every comment                      |

### Tier 2 — Worth doing, lower signal-to-noise for this tool

| Platform                        | Notes                                                             |
| ------------------------------- | ----------------------------------------------------------------- |
| **Dev.to**                      | Article: "How I built a skill composition system for Claude Code" |
| **Hashnode**                    | Cross-post the Dev.to article                                     |
| **Lobste.rs**                   | Curated, technical audience — good fit for the architecture story |
| **LinkedIn**                    | Only useful if targeting teams/orgs standardizing on Claude Code  |
| **r/programming**, **r/webdev** | Broad; lower conversion for a Claude Code-specific tool           |

### Tier 3 — Low priority for this tool specifically

These were originally tier 1 but don't fit the niche:

- **Product Hunt** — open to free/open source tools, many successful launches there are free dev tools; expect modest numbers from a niche tool but it's a permanent indexed record and costs little since the assets (GIF, screenshots, tagline) will already be ready; worth doing, just don't lead with it or measure success by it
- **r/LocalLLaMA** — that community runs local models; Claude Code is not their workflow
- **AI tool directories** (Futurepedia, TopAI.tools, etc.) — their audiences don't use Claude Code; skip for now
- **AI Engineer Discord, LangChain Discord** — tangential; these users aren't Claude Code-specific

### Tier 4 — High leverage if it lands

| Platform                          | Notes                                                                                           |
| --------------------------------- | ----------------------------------------------------------------------------------------------- |
| **Anthropic blog / docs mention** | A link from Anthropic's own docs or newsletter would dwarf everything else — worth reaching out |
| **Indie Hackers**                 | "Building in public" post; good for the builder community                                       |
| **YouTube walkthrough**           | `npx @agents-inc/cli init` on a real project — shows the value immediately                      |

---

## Launch Day Cadence

```
Day 0 (night before):
  - Seed 2–3 people to upvote on HN in the first hour
  - Draft the Twitter thread

Day 1 (launch day):
  - Anthropic Discord post (first — this is your highest-density audience)
  - r/ClaudeAI post with demo GIF
  - Show HN post (8–10am US Eastern)
  - Twitter/X thread with GIF, tag @AnthropicAI
  - Claude Code GitHub Discussions if there's a relevant thread

Day 2–3:
  - Dev.to article
  - Respond to all HN comments — this determines ranking more than votes
  - LinkedIn if you want professional reach

Week 2:
  - Hashnode cross-post
  - Lobste.rs post (technical angle)
  - Product Hunt (treat as bonus, not lead)

Month 2:
  - "What I learned building X" blog post — good for SEO and a second HN submission
  - Case study: real project using the tool
  - Reach out to Anthropic about a docs mention
```

---

## Blog Articles to Write

1. **"Why I built a skill composition system for Claude Code"**
   Origin story, the problem, the architecture. Personal angle — HN and Lobste.rs bait.

2. **"How to get specialized Claude Code agents for your tech stack"**
   Tutorial-style walkthrough. SEO-friendly. Drives organic search from Claude Code users.

3. **"Modular agent design: what I learned from 154 skills"**
   Technical deep-dive. Good for a second HN submission after the launch dust settles.

---

## What Good Looks Like for This Launch

Success here is not 1,000 Product Hunt upvotes. It's:

- Getting linked from Anthropic's ecosystem (Discord pinned, docs mention, a tweet)
- Becoming the known answer when Claude Code users ask "how do I set up good agents?"
- 50–100 genuine GitHub stars from people who actually use Claude Code
- A handful of community contributors or people building their own skill marketplaces

The community is small and tight-knit. Depth beats breadth.

---

## Pre-Launch Checklist

- [ ] GitHub repo is public with issues enabled
- [ ] npm badge links correctly
- [ ] Demo GIF is up to date and shows the full wizard flow
- [ ] README has a clear one-liner and `npx @agents-inc/cli init` above the fold
- [ ] 2–3 people briefed to upvote on HN in the first hour
- [ ] Twitter thread drafted
- [ ] Dev.to article drafted
- [ ] Anthropic Discord channel identified
