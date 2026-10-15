---
name: release-notes-format
description: Write customer-facing release notes in Acme's house format from a list of merged PRs.
version: 1.0.0
metadata:
  hermes:
    tags: [writing, release, acme]
    category: docs
---

# Acme release notes format

## When to Use
Whenever you are asked to write release notes, a changelog entry or a
"what's new" summary for an Acme release.

## Procedure
1. Start with a level-1 heading: `# Release vX.Y.Z`.
2. Use exactly these level-2 sections, in this order, omitting a section only
   if it would be empty:
   - `## ⚠️ Breaking changes` — PRs whose type ends with `!` (e.g. `feat!:`, `refactor!:`)
   - `## ✨ Highlights` — `feat:` PRs
   - `## 🐛 Fixes` — `fix:` PRs
3. Each entry is one bullet written for customers in plain language (no
   conventional-commit prefixes), ending with the PR number in parentheses,
   e.g. `- Contacts can now be exported to CSV in bulk (#412)`.
4. Breaking-change bullets must say what the customer has to do.
5. Leave out internal-only PRs: `chore:`, `docs:`, `test:`, `ci:` and
   non-breaking `refactor:`.

## Pitfalls
- A `!` PR goes ONLY under Breaking changes, never also under Highlights.
- Do not invent features that are not in the PR list.

## Verification
Every customer-facing PR appears exactly once; no internal PR appears.
