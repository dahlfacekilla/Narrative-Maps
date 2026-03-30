# Narrative Structures — Investigative Research System

Inspired by Mark Lombardi's investigative diagram work. This folder is the persistent memory for all investigations conducted with Claude in Cowork.

---

## How This Works

**Stack:**
1. **Research**: Claude (Cowork) — conversational research, entity extraction, relationship mapping
2. **Storage**: This folder — all structured data lives here
3. **Visualization**: [Kumu.io](https://kumu.io) — import JSON/CSV, explore the graph interactively

**Session workflow:**
1. Open Cowork, select this folder
2. Tell Claude which investigation to continue (or start a new one)
3. Claude reads existing files, picks up context, continues research
4. Claude outputs updated JSON files
5. Import updated JSON into Kumu

---

## Folder Structure

```
/Narrative-Structures
  /investigations
    /[topic-slug]
      entities.json         ← nodes: people, orgs, events, etc.
      relationships.json    ← edges: connections between entities
      sources.md            ← full citation log
      research-notes.md     ← running notes and session summaries
  /schema
    entity-schema.json      ← node field definitions and example
    relationship-schema.json ← edge field definitions and example
  README.md                 ← this file
```

---

## Confidence Levels

Every entity and relationship carries one of four confidence ratings:

| Level | Meaning |
|-------|---------|
| `verified` | Confirmed by primary source documents (court records, official filings, on-record statements) |
| `reported` | Reported by credible news organizations but not independently confirmed via primary source |
| `alleged` | Claimed by one party, disputed or unverified |
| `inferred` | Logical inference from surrounding verified facts — not directly sourced |

**Inferred relationships must always be tagged as such and never presented as fact.**

---

## Kumu Import Instructions

1. Go to your Kumu project
2. Click **Import** → **JSON**
3. Use the following structure:

```json
{
  "elements": [ ...entities array... ],
  "connections": [ ...relationships array... ]
}
```

Kumu maps `label` to the display name, and all other fields become element/connection attributes visible on click.

---

## Investigations

| Folder | Topic | Status | Started |
|--------|-------|--------|---------|
| san-diego-pension-crisis | San Diego city pension scandal, ~2002-2006 | In progress | 2026-02-20 |
