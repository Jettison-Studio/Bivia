# Read the land — unapproved editorial review

Draft: `geo-read-the-land-20260906-v1` · Geography · category mode · September 6, 2026.

**Outcome: five researched candidates, three recommended for human review, two held.** This is not yet an excellent five-question round, and it is not claimed to match the user-approved Science benchmark. No engine gates, blind playtest, human approval, import, or publication occurred. Do not publish this batch as-is.

The companion `geography-read-the-land.draft.json` is accepted by the current question-import shape. It contains the question copy, four answers, zero-based key, original paid hint, reference, explanation, source URLs, difficulty estimates, provenance, and checks. `editorial-ledger.json` records these five candidates plus 69 historical prompt/reference pairs and 20 additional known prompts from the supplied evidence. Historical evidence contains both archived and active material; it is not a live inventory of the database.

## Review order

| Question | Answer | Reading | Recommendation |
| --- | --- | --- | --- |
| 1. Reading a hillside | Closely spaced contours | 1 Samuel 14:13 | Human review; easy opener |
| 2. Navigation without GPS | Latitude | Acts 27:20 | Human review; check vocabulary and hint value |
| 3. Water without rain | Fog droplets caught by the canopy | Exodus 24:15–18 | Hold: weak distractors |
| 4. Holes ground into rock | Swirling sand and pebbles | Job 14:18–20 | Human review; check paid hint strength |
| 5. Competing wells | Pumping lowers the water table | Genesis 26:19–22 | Hold: Scripture connection too general |

All timers are provisional 30-second estimates **after** the complete reading and countdown. These are category questions, not a progressively harder Challenger sequence. No time limits are proposed for Scripture reading. All paid hints are original prose, cost one point under existing gameplay, and must not be labeled NIV quotations.

## 1. Reading a hillside

**Question:** On one topographic map, which feature best identifies the hillside where a hiker gains height most rapidly over a short horizontal distance?

A. Contour lines printed more thickly  
B. Contour lines packed closely together **(correct, index 1)**  
C. Contour lines labeled with higher elevations  
D. Contour lines forming wider closed loops

**Original paid hint:** Jonathan's climb suggests comparing upward gain with ground covered. Each step between adjacent contours represents the same change in height.

**Evidence and options:** [USGS map symbols, page 1](https://pubs.usgs.gov/gip/TopographicMapSymbols/topomapsymbols.pdf) explains contour spacing, index-line thickness and equal-elevation lines. B indicates steepness; A identifies an index contour; C establishes height, not gradient; D gives loop extent without the spacing needed to determine gradient. Restricting the question to one map avoids comparing different scales or contour intervals. Assumes ordinary adjacent contours, with supplementary contours interpreted according to the legend.

**Context:** [1 Samuel 14, independent WEB primary text](https://ebible.org/eng-web/1SA14.htm), especially verses 4–13, places Jonathan's ascent in rocky terrain during an attack on a Philistine outpost. The exact reading also includes combat; it has not been edited to conceal that context. Nothing in the reading explains contour lines. The hint adds the equal-height interval needed to translate the ascent into a map feature. It is strong, perhaps enough to make this an easy one-point rescue.

**Repetition:** Intentional rewrite of Geography run `4582e7cb-2225-4cf4-b3f9-074b22813088`, q3. Retires the claim that a map alone predicts scrambling: surface conditions also matter. This is not a fresh concept for future inventory.

## 2. Navigation without GPS

**Question:** At sea in the Northern Hemisphere, Polaris's angle above the horizon gives a sailor a direct estimate of which navigational quantity?

A. Longitude  
B. Magnetic declination  
C. Course over ground  
D. Latitude **(correct, index 3)**

**Original paid hint:** Imagine sailing toward the North Pole: Polaris would appear progressively higher in your sky.

**Evidence and options:** [NOAA's navigation history](https://vos.noaa.gov/MWL/aug_08/navigation_tools.shtml) directly connects Polaris altitude to latitude and distinguishes the historical longitude problem. Its wording is approximate; the draft does not promise an exact measurement. Longitude cannot be obtained directly from this one angle. [NOAA defines magnetic declination](https://www.ncei.noaa.gov/products/magnetic-declination) as a magnetic/true-north difference, requiring magnetic information. Course over ground concerns travel direction; a single stellar elevation says nothing about which way the ship is moving. [NOAA's navigation explanation](https://www.ncei.noaa.gov/products/world-magnetic-model) distinguishes location from direction of travel. All four options are angular navigation quantities.

**Context:** [Acts 27:18–26, independent KJV primary text](https://www.biblegateway.com/passage/?search=Acts+27:18-26&version=KJV) describes a prolonged storm, loss of visible sky, despair and Paul's subsequent encouragement. Celestial navigation is the historical connection, not an explicit explanation of every cause of the crew's despair. The account does not identify Polaris, a sextant, or a latitude technique. The full reading names no answer option. The paid clue introduces the northward change in the star's altitude without defining latitude.

**Repetition and quality:** New answer concept and exact verse in the supplied inventory, although Acts 27 appears elsewhere for shelter and swimming. Medium estimate; the unfamiliar phrase “magnetic declination” may make the choices feel more technical than everyday. Human playtest should check this before approval.

## 3. Water without rain — HOLD

**Question:** In a mountain cloud forest, leaves can drip even during a period with fog but no rain. Where can that extra water come from?

A. Airborne droplets caught by the canopy **(correct, index 0)**  
B. Water vapor released by the leaves  
C. Groundwater forced upward through the soil  
D. Rainwater created as leaves break down

**Original paid hint:** Moses entered a cloud rather than merely standing beneath one. Now picture a tree canopy in that position, with damp air moving through its branches.

**Evidence and options:** [The Forest Service's field-research report](https://research.fs.usda.gov/treesearch/64402) documents interception of cloud droplets by vegetation and subsequent dripping. [Puerto Rican measurements](https://research.fs.usda.gov/treesearch/38433) specifically include fog-only conditions. A is supported. [USGS describes transpiration](https://www.usgs.gov/water-science-school/science/evapotranspiration-and-water-cycle?page=0) as release of vapor; B is not direct capture of liquid cloud water. C concerns a different route, while D is not a defensible description of rainfall formation. **That makes D especially implausible.** Moreover, wet leaves alone cannot exclude guttation, dew or residual water from earlier rain. The intended mechanism is established, but this scenario and distractor set do not meet the desired standard.

**Context:** [Exodus 24, independent WEB primary text](https://ebible.org/eng-web/EXO24.htm) concerns God's presence and Moses receiving instruction. The association uses immersion in cloud; it does not naturalize the event or claim Sinai supported a cloud forest. The full NIV range includes the divine-presence context, not just an isolated weather image. Neither interception nor forest ecology is stated. The paid hint extends the spatial relationship to branches, but could make A too easy.

**Repetition and next revision:** Intentional rewrite of the earlier Geography q4, not new inventory. Replace the distractor set and tighten the observed conditions, or replace this slot entirely. Do not simply remove the hold because the previous engine selected its predecessor.

## 4. Holes ground into rock

**Question:** At Minnesota's Interstate State Park, deep, rounded potholes remain in rock above today's river. What helped grind these holes during ancient floods?

A. Salt crystals expanding in cracks  
B. Tree roots splitting the rock  
C. Sand and pebbles swirling in the water **(correct, index 2)**  
D. Ice repeatedly freezing inside cracks

**Original paid hint:** The water in Job's image wears down stone. A flood can also carry hard material that works against the rock again and again.

**Evidence and options:** [Minnesota DNR, final PDF page / printed page 55](https://www.dnr.state.mn.us/sites/default/files/assets/mcv/2024/may-jun/yn/YN-7Wonders.pdf) describes this park's potholes, swirling sand and pebbles, and their position after river levels fell. The location restriction avoids claiming all depressions called potholes form this way. A, B and D are real rock-weathering processes, as documented by [NPS weathering and erosion](https://home.nps.gov/articles/000/weathering-erosion.htm) and [NPS physical weathering](https://home.nps.gov/subjects/erosion/weathering.htm); they are not the site's documented flood-grinding mechanism. All options are physical ways rock can be worn or broken.

**Context:** [Job 14:14–22, independent KJV primary text](https://www.biblegateway.com/passage/?search=Job+14:14-22&version=KJV) establishes Job's lament about mortality and hope. The selected reading retains the comparison with destroyed hope. It is not encouragement to persevere, a statement of divine reassurance, or a scientific explanation. Water erosion is in the reading; abrasive sediment is the additional inference. The clue is useful but strong, so playtest whether it leaves enough inference for a paid hint.

**Repetition:** Intentional development of earlier Geography q2 and its Job reference. A concrete landform replaces a generalized comparison of sediment loads, removing the troublesome balance between sediment acting as tools and shielding bedrock.

## 5. Competing wells — HOLD

**Question:** A shallow farm well runs dry whenever a nearby irrigation well pumps heavily, then recovers after pumping stops. What best explains this repeated pattern?

A. Silt blocking the shallow well's intake  
B. Pumping lowering the surrounding water table **(correct, index 1)**  
C. Drought reducing the area's rainfall  
D. Mineral deposits clogging the shallow well

**Original paid hint:** Separate wellheads need not mean separate supplies. The water people compete for can extend beneath both properties.

**Evidence and options:** [USGS groundwater wells](https://www.usgs.gov/water-science-school/science/groundwater-wells) explains pumping drawdown, effects on neighboring wells, dry pump intakes and drought. [USGS's rural homeowner guide](https://pubs.usgs.gov/gip/gw_ruralhomeowner/gw_ruralhomeowner_new.html) discusses increased nearby pumping. B best fits repeated recovery tied to pumping. C can lower water levels but does not explain that switching pattern. A and D are plausible well-performance failures rather than good explanations for it; [USGS well protocols](https://pubs.usgs.gov/of/1995/ofr-95-398/of95-398.html) document sedimentation and screen clogging. Specific mineral-deposit evidence remains insufficiently established in the retained sources; verify or replace D during revision. This is a hypothetical best-explanation question, not a diagnosis of a real well.

**Context:** [Genesis 26, independent WEB primary text](https://ebible.org/eng-web/GEN26.htm) describes disputes over Isaac's wells followed by an uncontested well after moving. It does not say the wells shared groundwater or that extraction caused a shortage. The full reading does not state drawdown. The paid hint supplies a useful hydrogeological concept, **but that concept is only loosely supported by the scene of competing access**. This is weaker than the distinctive material detail in Jeremiah's rescue or the voice-recognition detail in Genesis 27. Hold for a better pairing; do not represent it as benchmark quality.

## Verification and import handoff

Read-only references included the benchmark, workflow, YouVersion documentation, all eight JSON evidence files, next-round review, and the current main-checkout editor/backend shape. No accepted Science question was copied. Three unapproved Geography concepts were intentionally revised; two concepts were newly researched. No claims are made about unseen database content.

The existing YouVersion key's presence was checked without displaying it. Read-only API calls to configured version 111 retrieved the **exact five proposed reading ranges**, plus surrounding ranges 1 Samuel 14:4–13, Acts 27:18–26, Exodus 24:12–18, Job 14:14–22 and Genesis 26:17–25. Bible metadata confirmed NIV and returned its attribution. The complete returned readings were inspected for context and leakage; their hashes are in the JSON. **No licensed passage text or credentials are in these artifacts.** Independent context sources above are clearly identified as research sources, not proposed player translations. Local authenticated Edge-function and player rendering remain untested; no session was created or changed.

The editor's `parseQuestions` accepts the JSON object's `questions` array and its `answers`, `correctIndex`, `hint`, and `reference` fields. It creates new IDs and discards explanations, evidence, difficulty and review metadata. It also does not import the round title/category/mode. The coordinating task must retain this evidence separately and populate the round metadata and explanations deliberately. The backend then maps those fields to `options`, `correct_index`, `hint_reference`, and `description`. Do not paste original hints into a licensed Scripture-text field or invent engine passing reviews.

Validation executed against the current main-checkout `parseQuestions` and `validate` functions: five questions parsed, zero structural validation errors. Evidence URL arrays and five passage hashes were also checked. `git diff --check` passed. These checks establish import structure, not editorial approval.

**Next action:** Review q1, q2 and q4, then revise or replace q3 and q5 before assembling a complete round. Preview all exact NIV readings in the authenticated admin, run a human full-reading-first playtest, and explicitly approve each current revision. Any import should remain a local draft with both held questions still visibly excluded from approval. Publication requires the coordinating task's later user-authorized workflow.
