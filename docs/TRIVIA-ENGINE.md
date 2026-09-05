# Bivia trivia engine

## Editorial goal

Produce category-specific and mixed-category rounds whose facts are defensible and whose scripture clues offer fair, useful connections. A correct answer should make the clue feel satisfying, not require an explanation that retrofits a weak association. Completing an API request is not the quality benchmark.

The existing app's visual design remains the reference for the editorial interface. Generated content stays private until human review, and exporting a round creates a draft; publishing remains a separate editor action.

## Round design

- **Category:** one category, with varied subtopics and a chosen knowledge/clue difficulty band.
- **Progressive:** multiple categories in a deliberately rising difficulty sequence. Knowledge difficulty and scripture reasoning difficulty are separate estimates. Avoid abrupt spikes and repeated categories or biblical connections.
- **Timed:** concise prompts, clues, and choices with a reading/solving load appropriate to time pressure. Do not use obscure wording as a substitute for difficulty.

The first benchmark targets 30 final questions across easy, medium, and harder/progressive briefs, generating up to 36 candidates to allow rejection. These are review candidates, not an automatically accepted launch library. If too few candidates pass, the run must report its shortfall rather than lower the threshold.

## Editorial stages

1. **Plan:** allocate category/subtopic/difficulty slots from the round brief.
2. **Write:** propose questions with four distinct plausible choices, answer keys, original clues, references, and a concise explanation of the connection.
3. **Accuracy:** research the trivia claims using web search, retain provider-returned source URLs, and flag unsupported or ambiguous answers.
4. **Theology/context:** check the biblical connection and flag distorted context or disputed interpretation. A model's verdict is not a theological authority.
5. **Clue quality:** assess fairness, usefulness, giveaways, forced associations, and estimated reasoning difficulty.
6. **Blind playtest:** independently attempt the question without the answer key, connection explanation, or previous reviews.
7. **Assemble:** apply deterministic gates and select an ordered round. This step does not ask a model to override rejected questions.

Each model call is independent. Persisted concise findings explain the decisions; the system does not request or store hidden chain-of-thought. Repairs invalidate downstream reviews and prior human approvals for the changed revision, and are bounded to two cycles.

## Scripture handling

NIV is the chosen translation. Exact NIV text requires a suitable source and an explicit license permitting AI use. Biblica currently distinguishes AI licensing from ordinary quotation permissions; editor-supplied text by itself is not sufficient permission. See [Biblica's current permissions](https://www.biblica.com/permissions/).

Until a qualifying license and reviewed passages are supplied, development uses original scripture-inspired clues with references. These are not NIV quotations, not verified NIV wording, and not a substitute translation. No NIV corpus is scraped or generated from model memory. The player and editor label these hints as original clues and omit quotation marks.

The licensed passage route stores editorial verification and rights attestations alongside the passage. Exact quotations must match the approved text; a paraphrase remains labeled as an original clue even when a licensed passage informed it. Interpretation guidelines favor the passage's plain contextual meaning and require human review for disputed or denominational readings.

## Human benchmark rubric

Judge every candidate independently before judging the assembled round:

- **Fact:** is the question actually true, specific, and supported by a reliable source?
- **Choices:** is there only one defensible answer, with plausible distractors of the same kind?
- **Context:** does the reference support the connection without presenting an analogy as a biblical scientific claim?
- **Hint:** does it narrow the choices before the answer is known? Is it more than a repeated answer word or a vague inspirational phrase?
- **Difficulty:** is the intended challenge knowledge, inference, or reading time? Does it fit its place in the round?
- **Tone:** curious and respectful; avoid sermons, forced puns, gimmicks, and congratulatory filler inside questions.

Review labels include good, too obvious, cheesy, forced, unfair, factual issue, and theological/context issue. Initial model difficulty estimates require later calibration from actual players; a powerful model solving a question is not evidence that humans will find it easy.

## Evidence and cost

The server uses resumable OpenAI Responses background jobs with strict structured outputs and hosted web search for evidence-review stages. It saves model identifiers, prompt versions, token usage, tool-call counts, and source links. Model-proposed URLs alone cannot satisfy an evidence gate. Retrieved sources and generated candidates are untrusted data, never workflow instructions.

Cost estimates are estimates, not an invoice. Server-side call/token/spend limits bound execution, and uncertain requests reserve allowance rather than automatically spending again. Closing the browser pauses polling and automatic progression. A dispatched provider job continues, and reopening retrieves the saved job ID. Polling does not create another generation request. Responses use explicit provider storage so they remain retrievable after the short background polling window; completed output and usage are saved locally before a best-effort provider deletion. A lost dispatch before its job ID was saved remains uncertain and requires explicit acknowledgement before a paid retry.

Official references: [Responses structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [web search](https://developers.openai.com/api/docs/guides/tools-web-search), [API pricing](https://developers.openai.com/api/docs/pricing), [background execution](https://developers.openai.com/api/docs/guides/background).

## Verification and operation

The API key is server-only in ignored `supabase/functions/.env.local`; it must never be included in Vite or Expo public variables. Start the local backend and admin using the README, then serve functions with:

```sh
npx --yes supabase@2.116.0 functions serve --env-file supabase/functions/.env.local
```

Open the admin's **Trivia engine** workspace, create a brief, and run either one stage or the remaining stages. Review each candidate's findings and evidence before approving its current revision. A complete passing selection with current human approvals can be exported into the ordinary quiz editor as a draft.

```sh
npm run test:engine
npm run test:backend
node scripts/engine-benchmark.mjs
BIVIA_BENCHMARK_CREDENTIALS_FILE=/private/path/admin.json node scripts/engine-benchmark.mjs --run
node scripts/engine-report.mjs
```

The benchmark's default invocation is a dry run. `--run` performs billed calls through the local admin-only endpoint; the private credential file contains a local test administrator's email/password, never the OpenAI key. `--resume` reads saved run IDs. It does not approve, repair or publish candidates automatically. An uncertain run requires inspection and explicit recovery; do not repeat a command blindly after a connection loss. Saved evidence is in `docs/engine-evidence/benchmark.json`, with a readable `BENCHMARK.md` generated by the report script.

During local paid execution, freeze changes under `supabase/functions`: the development server's hot reload can interrupt an in-flight provider call. The initial foreground trial caught both a hot-reload interruption and a 90-second writer timeout; their reservations are retained and explicit recovery is audited. Background job persistence addresses both once a provider job ID has been saved. Early writer output used prompt version `.1`; later stages use `.2`, refined after independent inspection identified forced analogies, and `.3`, which accommodates provider-added citation URLs in bounded review findings. The exact request text is retained in each call.

See [API, persistence and recovery contract](ENGINE-API.md) and [prompt design](TRIVIA-ENGINE-PROMPTS.md). 
## Live trial findings — September 5, 2026

| Brief | Candidates | Selected after review | Final round shortfall |
| --- | ---: | ---: | ---: |
| Easy fitness | 12 | 2 | 8 of 10 |
| Medium science | 12, plus 3 revised versions | 2 | 8 of 10 |
| Rising mixed categories | 12 | 0 | 10 of 10 |

All three runs completed and remain private review runs. No human approvals, draft exports, schedules or publications were issued. The baseline before the bounded science repair selected three candidates; after repair it selected four. The trial demonstrates workflow and rejection behavior, **not reliable production of a complete daily round**.

Recorded estimated model/search cost is **$7.114582**, with **$1.881775** retained allowance for two interrupted foreground requests whose final provider usage was unavailable. These are not invoice totals. The separate API connection smoke used 49 tokens. [Readable candidate findings](engine-evidence/BENCHMARK.md), [final structured evidence](engine-evidence/benchmark.json), and [pre-repair baseline](engine-evidence/initial-benchmark.json) are saved locally without credentials.

The clue critic rejected the arbitrary Noah-forty-days/marathon association and generic dove-out-and-back/jumping-jacks connection. Pair-first drafting produced more natural science connections. A bounded revision removed the dispersion/refraction ambiguity and passed fresh independent reviews. Many otherwise plausible candidates were withheld because exact cited pages were absent from actual retrieval metadata, or the assessed difficulty did not fit the brief.

Future defaults now permit 16 evidence tool calls instead of four while preserving the $10/run and $30/workspace-day estimated spending guards. Prompt `.4` separates factual research from the theology review so missing Bible research cannot independently fail the factual stage. These final refinements passed automated checks but have **not** been run through another complete paid benchmark; historical run settings and prompts remain preserved.

Verification: 41 application/engine/dependency tests, 77 database assertions, TypeScript checks, Edge Deno checking, SQL lint, and player/admin web production builds pass. Background persistence and same-job replay were exercised through real local HTTP, and the live trial completed using background polling. The final interactive browser check was blocked by the Mac screen lock; no screenshot-based claim is made for the final polling UI.

Next editorial work is to review the four selected candidates with the owner, label acceptable clue styles, calibrate difficulty against human players, and rerun a smaller benchmark with the increased research allowance. NIV source licensing and passage verification remain required before licensed NIV mode is used.
