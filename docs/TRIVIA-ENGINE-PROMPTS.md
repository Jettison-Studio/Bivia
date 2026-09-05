# Trivia editorial engine

The engine creates a reviewed draft bank. It does not publish questions or replace an editor's judgment. References, source links, review scores, difficulty and solve-time estimates can still be wrong; a human must review the final question, all choices, Bible connection and evidence before approving it.

The canonical implementation is `supabase/functions/_shared/trivia-engine.ts`, with contracts in `trivia-types.ts`. `runStage(state, callModel)` advances one durable stage. Initial generation makes six independent model requests; assembly is deterministic code. Each request stores the exact instructions, input, schema, prompt version, output, model, response ID, usage and provider source metadata. The Edge adapter owns authentication, leases, persistence, provider budgets and credentials.

| Stage | Input and responsibility |
| --- | --- |
| Plan | Brief, fixed category/difficulty/timing slots, bounded editorial history; select distinct everyday trivia subtopics. |
| Write | Plan and source restrictions; create four plausible choices of the same type and a natural original Bible-story association. Explain the connection for the editor. |
| Accuracy | Independently check the key and uniqueness using primary factual sources retrieved by web search; estimate fact difficulty. |
| Theology | Independently verify the reference, story context and interpretation using permitted primary text or original contextual scholarship retrieved by web search. |
| Clues | Check fairness, usefulness, answer leakage and independently estimate clue difficulty. |
| Playtest | Fresh blind request containing only opaque ID, question, choices, hint and reference. No key, explanations, other reviews, categories, difficulty, editorial history, tools or prior conversation linkage. |
| Assemble | Apply canonical gates, category balance, repetition controls, timing and rising-difficulty constraints. Return the full count or a visible shortfall. |

Prompt version `2026-09-05.2` incorporates findings from the initial fitness draft: planner proposes the fact and story relationship together; writer can replace a weak planned pair within its category/difficulty; clue critic explicitly rejects arbitrary number coincidences, generic out-and-back analogies, semantic answer replacement, distractor-elimination lists and player-facing editorial caveats. Existing run records preserve their actual prompt version, so a run resumed across this update can contain both `.1` and `.2` stages. Initial `.1` draft quality must not be attributed to `.2`. Schemas and numerical gates are unchanged.

Prompts ask for concise editorial findings, not hidden reasoning. They treat notes, history, drafts and retrieved pages as untrusted data. A Bible connection must be a concrete association or clearly framed analogy; the engine should reject sermons, label swaps, context distortion and claims that Scripture teaches modern scientific facts.

## Source restrictions

In `references` mode, the `translation: NIV` preference is metadata for possible future licensed integration. The model must not retrieve, reconstruct, quote, summarize or paraphrase NIV wording from memory or a web page. Hints are original associations based on public-domain Scripture such as KJV, WEB or ASV, or original contextual scholarship. They are not called NIV text or NIV paraphrases. Passage IDs must be null, and obvious NIV source URLs cannot pass the context gate.

`licensed_niv` requires server-supplied passages with verified text, rights approval and explicit approval for AI use. The model may use only those passages as NIV context and must not reproduce their text in generated content. The engine does not establish legal rights itself; the server's approval is a prerequisite.

Fact and context evidence URLs must match actual provider citation/tool-source metadata, and the response must report at least one web-search call. A plausible URL in model JSON is insufficient. This establishes retrieval provenance, not whether a source is authoritative or actually supports the claim; reviewers and the editor must inspect that. OpenAI documents source extraction and citations in its [web-search guide](https://developers.openai.com/api/docs/guides/tools-web-search). The adapter must request and retain tool sources as well as citations.

All schemas disallow extra fields and require every property; nullable fields express permitted absence. JSON is validated again locally. Structured output constrains format, not truth. See OpenAI's [strict-mode requirements](https://developers.openai.com/api/docs/guides/function-calling#strict-mode).

## Canonical gates and scales

Fact and clue difficulty are separate 1–5 estimates. Accuracy and clue reviewers independently calibrate them. Scores and blind-player confidence use 0–100; durations use seconds. None of these estimates have been calibrated against real player results yet.

- Accuracy: verdict pass, score at least 90, exact correct index, unambiguous, primary source and retrieved supporting evidence.
- Context: verdict pass, score at least 90, context faithful, safe original clue, low doctrine risk, primary source and permitted retrieved evidence.
- Clue: verdict pass, score at least 80, fair, supported and no answer giveaway.
- Blind player: correct choice, confidence at least 55 and no ambiguity.
- Deterministic text checks: four distinct choices, in-scope category, no quoted/labeled NIV hint, no whole-token correct-answer phrase inside the clue, and correct licensed-passage linkage when applicable.
- Difficulty: easy requires both independent estimates 1–2; medium 2–4; hard 4–5. Rising uses the mean of the two estimates, begins at most 2, ends at least 4, never decreases and never increases by more than 1 between questions.
- Timing: each selected question must fit its slot using the greater of writer and blind-player duration estimates. Timed limits are 30, 25, 20, 15, 10, 5, then 2.5 seconds. Estimates do not prove a human can solve the question that fast.

Assembly rotates requested categories instead of globally sorting them, forbids repeated passages, answer concepts and subtopics, and checks near-duplicate wording. It uses a bounded search and reports when that bound limits assembly. A shortfall is an intentional filter result, never permission to fill with failed questions.

## Editorial learning and repair

`createState(brief, approvedPassages, editorialContext)` accepts server-selected history: up to 30 recent question prompts and 10 accepted/rejected examples with prompt, hint, reference, decision and reason. The planner and writer receive it as untrusted calibration data. They are asked to learn style from decisions and reasons and avoid repeating recent facts. This is contextual prompting, not model training or a guarantee of novelty; cross-run factual duplication still needs editorial review.

Explicit `retryCandidates` is available only after a complete cycle and permits at most two repair cycles. Revised candidate IDs remain stable, revision increments, and all downstream reviews for those candidates are cleared and rerun. Other candidates retain their current revision's reviews. The editor's acceptance is separate from machine review and must remain tied to the reviewed revision.

## Local validation

Run `node --test supabase/functions/_shared/trivia-engine.test.ts` with Node 24. Tests cover fabricated-source false approvals, blind redaction, independent difficulty, rising jumps, timing, repetition, shortfall, whole-token answer leakage, licensing constraints, bounded editorial history, malformed results and repair limits. These are deterministic engine tests using synthetic model responses; live content quality is a separate benchmark.

Prompt version `2026-09-05.3` allows each review reason up to 1,200 characters while still requesting concise prose and URLs only in `evidenceUrls`. This accommodates hosted-search citations inserted into otherwise short reasons; it does not remove source-provenance or quality gates. The 1,200-character bound remains enforced locally and in the strict response schema.

Prompt version `2026-09-05.4` clarifies that accuracy reviews only the everyday factual question and four choices. Scripture retrieval and context belong to theology; unavailable Bible citations alone must not reduce the factual score. All factual evidence and quality gates remain unchanged. The full live benchmark was not rerun after this clarification or the increase to 16 tool-call capacity. Recorded benchmark stages preserve their actual `.1`–`.3` versions; results do not validate `.4` or the increased capacity.
