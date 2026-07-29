// src/lib/query-understanding/local-provider.ts

import type {
  QueryUnderstandingProvider,
  QueryUnderstandingResult,
} from "./types";

const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://localhost:11434";
const MODEL = process.env.LOCAL_QUERY_MODEL ?? "qwen2.5:1.5b-instruct-q4_K_M";

// JSON Schema passed to Ollama's `format` param — this is what guarantees
// the output shape is always valid, per the "non-negotiable" requirement
// in AGENT-LOCAL.md. Ollama will constrain generation to match this.
const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    hard_filters: {
      type: "object",
      properties: {
        gender: { type: "string" },
        age_min: { type: "number" },
        age_max: { type: "number" },
        languages: {
          type: "array",
          items: { type: "string" },
        },
      },
    },
    soft_preferences: {
      type: "object",
      properties: {
        traits: {
          type: "array",
          items: { type: "string" },
        },
      },
    },
    semantic_query: { type: "string" },
  },
  required: ["hard_filters", "soft_preferences", "semantic_query"],
};

const SYSTEM_PROMPT = `You are a query-understanding component for a casting/actor search system.

Your task is to convert a natural-language casting query into a JSON object.

Return ONLY valid JSON matching the provided schema.

----------------------------------------
HARD FILTERS
----------------------------------------

Only include a field in hard_filters if it is EXPLICITLY stated in the user's words.

Never invent, infer, or assume hard filters.

If a value is not explicitly stated, omit the field completely.

Fields:

• gender
• age_min
• age_max
• languages

----------------------------------------
AGE EXTRACTION
----------------------------------------

Extract age ONLY when the query explicitly mentions age.

Valid age expressions:

- "34-year-old"
- "34 years old"
- "aged 34"
- "exactly 34"
- "in his 50s"
- "in her 40s"
- "in their twenties"
- "early thirties"
- "mid forties"
- "late twenties"
- "middle-aged"
- "elderly"
- "teenager"

Convert them into an age range.

Examples:

34-year-old
→ age_min: 32
→ age_max: 36

exactly 34
→ age_min: 34
→ age_max: 34

in his 50s
→ age_min: 50
→ age_max: 59

early thirties
→ age_min: 30
→ age_max: 33

mid thirties
→ age_min: 34
→ age_max: 36

late thirties
→ age_min: 37
→ age_max: 39

Do NOT infer age from:

- father
- mother
- grandfather
- grandmother
- prince
- princess
- king
- queen
- doctor
- teacher
- CEO
- mafia boss
- police officer
- lawyer

----------------------------------------
GENDER EXTRACTION
----------------------------------------

Extract gender ONLY if explicitly stated.

Examples:

Accept:

- man
- woman
- male
- female
- boy
- girl

Reject:

- father
- mother
- prince
- princess
- king
- queen
- hero
- villain

Do NOT infer gender from occupations or character roles.

----------------------------------------
LANGUAGE EXTRACTION
----------------------------------------

Extract languages ONLY when explicitly stated.

Accept:

- speaks English
- English-speaking
- fluent in Hindi
- Malayalam speaker

Reject:

- French chef
- Italian mafia
- Japanese anime style

Nationality or ethnicity does NOT imply language.

----------------------------------------
SOFT PREFERENCES
----------------------------------------

Extract descriptive words that help ranking but should not exclude candidates.

Examples:

- warm
- authoritative
- intimidating
- charismatic
- regal
- noble
- commanding
- vulnerable
- confident
- elegant

Never place age, gender, or language inside traits.

----------------------------------------
SEMANTIC QUERY
----------------------------------------

Always produce a semantic_query.

This should be a short description of the role, archetype, or vibe for embedding search.

Good examples:

"mafia boss"

"warm father figure"

"royal presence"

"confident lawyer"

If the query contains only hard filters, use:

"actor matching the specified attributes"

----------------------------------------
EXAMPLES
----------------------------------------

Query:
I want a 34-year-old man who speaks English

Output:
{
  "hard_filters": {
    "gender": "male",
    "age_min": 32,
    "age_max": 36,
    "languages": ["English"]
  },
  "soft_preferences": {
    "traits": []
  },
  "semantic_query": "actor matching the specified attributes"
}

----------------------------------------

Query:
A warm but authoritative father figure in his 50s

Output:
{
  "hard_filters": {
    "age_min": 50,
    "age_max": 59
  },
  "soft_preferences": {
    "traits": [
      "warm",
      "authoritative"
    ]
  },
  "semantic_query": "warm authoritative father figure"
}

Reason:
"in his 50s" explicitly states age.
"father figure" does NOT determine age.

----------------------------------------

Query:
Someone with a strong royal presence who can play a prince

Output:
{
  "hard_filters": {},
  "soft_preferences": {
    "traits": [
      "regal",
      "commanding",
      "noble"
    ]
  },
  "semantic_query": "royal prince-like presence"
}

Reason:
"prince" is a character role.
No age, gender, or language was explicitly stated.

----------------------------------------

Query:
A prince in his twenties

Output:
{
  "hard_filters": {
    "age_min": 20,
    "age_max": 29
  },
  "soft_preferences": {
    "traits": [
      "regal"
    ]
  },
  "semantic_query": "young prince"
}

Reason:
The role does NOT imply age.
The phrase "in his twenties" explicitly provides age.

----------------------------------------

Query:
Can play a mafia boss

Output:
{
  "hard_filters": {},
  "soft_preferences": {
    "traits": [
      "intimidating",
      "powerful",
      "commanding"
    ]
  },
  "semantic_query": "mafia boss"
}

Reason:
No demographic information is explicitly stated.

----------------------------------------

Respond ONLY with the JSON object.

Do not explain your reasoning.

Do not include markdown.

Do not include any text before or after the JSON.
`;

export class LocalQueryUnderstandingProvider
  implements QueryUnderstandingProvider
{
  async parse(query: string): Promise<QueryUnderstandingResult> {
    const response = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: query },
        ],
        format: RESPONSE_SCHEMA,
        stream: false,
        options: {
          temperature: 0.1, // low temp: we want consistent extraction, not creativity
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      throw new Error(
        `Ollama request failed: ${response.status} ${response.statusText} ${errText}`
      );
    }

    const data = await response.json();
    const content = data?.message?.content;

    if (!content) {
      throw new Error("Ollama response missing message content");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch (err) {
      throw new Error(
        `Failed to parse Ollama JSON output: ${err}\nRaw content: ${content}`
      );
    }

    return normalizeResult(parsed);
  }
}

// Defensive normalization: even with a JSON schema constraining shape,
// small local models will sometimes fill in an empty string ("") or empty
// array ([]) for a field instead of omitting it. Downstream SQL filtering
// must treat "not stated" and "stated as empty" identically — an empty
// string gender filter is NOT the same as no gender filter. So we strip
// blank/empty values here and treat them as truly absent.
function cleanString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function cleanStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const filtered = value.filter(
    (v): v is string => typeof v === "string" && v.trim().length > 0
  );
  return filtered.length > 0 ? filtered : undefined;
}

function cleanNumber(value: unknown): number | undefined {
  return typeof value === "number" && !Number.isNaN(value) ? value : undefined;
}

function normalizeResult(raw: unknown): QueryUnderstandingResult {
  const r = raw as Partial<QueryUnderstandingResult>;

  return {
    hard_filters: {
      gender: cleanString(r.hard_filters?.gender),
      age_min: cleanNumber(r.hard_filters?.age_min),
      age_max: cleanNumber(r.hard_filters?.age_max),
      languages: cleanStringArray(r.hard_filters?.languages),
    },
    soft_preferences: {
      traits: cleanStringArray(r.soft_preferences?.traits) ?? [],
    },
    semantic_query: cleanString(r.semantic_query) ?? "",
  };
}