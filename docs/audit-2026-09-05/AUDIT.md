# Bivia UI and gameplay audit — September 5, 2026

**Verdict: the exercised gameplay paths work, but the app is not ready to call finished.** This audit used a separate Chrome session against localhost:8093, not the user's current round. Desktop and 390×844 mobile web views were inspected. An isolated local account and private group were created through the UI and deleted through the UI at the end. No deployment or external invitations were sent.

## Screen-by-screen findings

| Step | Screen / transition | Result and evidence |
|---|---|---|
| 1 | Guest homepage | Practice entry works; account navigation is hidden. Several topics are unavailable, so catalog completeness remains a blocker. 01, 46. |
| 2 | Practice overview | Explicit Start works. Copy does not fully explain paid hints; practice content is KJV, not the requested NIV. 02. |
| 3 | Verse preview | Three-second full-screen preview transitions into the question. Early practice screenshot 03 caught the fade and is not accepted as final visual evidence; stable ranked preview 13 and corrected mobile preview 28 establish full-screen behavior. |
| 4 | Practice question and hint | Answer controls, wrong-answer lockout, paid hint, and available points work. A complete five-question round was played, including hint use and a wrong answer. 04–07. |
| 5 | Practice results | Score saved; guest has Create account / Login / Replay actions, no share action. 08. |
| 6 | Signup and login | Separate first/last names saved; signup, sign-out, and password login exercised. First-name persistence verified after reload. 09, 37, 40. |
| 7 | Member homepage and favorites | Fixed account favorites being ignored by the homepage. Saved Food & Drink selection survives reload and filters the homepage to that topic. 36, 41, 42. |
| 8 | Ranked overview | Fresh round waits for Start. Fixed completed-round links routing through an incorrect Continue overview. 12, 19 (before), 26 (after). |
| 9 | Ranked question and optional hint | Fresh category round exercised through all five questions. Paid hint persists and affects server score. Seed clues were incorrectly presented as Bible quotations; fixed labels for the 15 known seed paraphrases and copied attempt questions. Verified NIV content is still missing. 13–15, 28. |
| 10 | Ranked feedback and Next | Fixed mostly blank feedback screen by retaining the resolved question and highlighting its correct answer. Next starts the next preview; no next-question deadline runs underneath feedback. Removed developer-oriented score-verification footer. 16 (before), 30 (after). |
| 11 | Timed mode | Real first-question expiry observed; it stops at feedback. Next opens the next clue and then a 25-second second question. 27–31. Later timing steps also covered by server tests. |
| 12 | Challenger | Five wrong answers across two questions terminate the challenge with zero score. Removed resolved-answer feedback from the final result view to avoid a second stacked question panel. 32–33 (capture before that final cleanup). |
| 13 | Ranked results and history | Complete category score persisted. View results now opens results directly. History now has a loading state, useful failure message, and bounded retry for the observed local JWT clock-skew error. Reloaded history works. 10, 25, 26. |
| 14 | Groups list and creation | Create private group works. Fixed mobile heading wrapping into a narrow column beside the action. Fixed radio checked-state semantics. 20–23, 43. |
| 15 | Group detail / invite | Detail and empty leaderboard render; invite generation produces a revoke control. No invite was sent. Joining from a second account and owner approval were not browser-tested. 23–24. |
| 16 | Invalid invitation | Missing-token message shown, acceptance disabled, escape action available. 34. |
| 17 | Profile editing | First/last/display name and saved favorites work. Topic editor now uses the same catalog as Home. Explicit web aria-checked fixes missing checkbox state. 25, 36, 40–41. |
| 18 | Forgot password / reset | Empty-email validation works. Fixed raw empty-string rendering warning on reset screen and ensured failed password updates release busy state. Actual reset-email delivery and recovery-link flow not exercised. 35 (before), 38–39, 44 (after). |
| 19 | Avatar / account deletion | Started missing local Edge service. Upload validation, ownership, limits, cleanup and deletion pass HTTP integration tests. Account deletion confirmation and completion also exercised in browser using only the test account. Native image picker not exercised. 45–46. |
| 20 | Signed-out route protection | Direct /profile redirects to /auth after deletion. 47. |

## Remaining release blockers

1. **P1 — Scripture/content is not the promised experience.** Practice fixtures are KJV. Ranked fixtures are original paraphrases, now explicitly labeled rather than misquoted. A vetted NIV source and approved daily content must replace them. Label correction is not a substitute for actual NIV verses.
2. **P1 — Daily inventory and difficulty are incomplete.** Seven of ten visible categories have no edition in the local fixture catalog. Timed/Challenger are test sets; Challenger's increasing difficulty has not been calibrated. Future-day publishing and midnight rollover were not browser-tested.
3. **P2 — Practice and ranked presentation still differ.** Practice uses a compact top row, timer bar, and hint modal; ranked uses a card and inline paid hint. Both exercised paths work, but they still need one shared presentation to feel consistent. This audit did not introduce another redesign.
4. **P2 — Active-round exit/resume needs clearer communication.** Ranked exit is immediate; timed attempts continue to use their original server deadline. Practice has an exit confirmation. No clock resets were added to old attempts and no user scores were erased.
5. **P2 — Multi-person group and recovery flows need a separate end-to-end pass.** Invite approval with a second account, populated group leaderboards, reset-email delivery and recovery callbacks were not verified in browser.
6. **P2 — Native coverage remains outstanding.** Responsive mobile web is not an iOS/Android runtime test. Safe areas, hardware back, native share/photo permissions and accessibility must be checked there.
7. **P3 — Remaining copy and density.** Repeated curiosity copy, the signup requirement beneath the login password field, and development-fixture titles need cleanup after the game presentation is consolidated.

## Verification

- Browser: completed guest practice and signed-in category rounds; paid hint; wrong guess; feedback/Next; timed expiry and next timer; Challenger five-wrong termination; direct saved results; signup/login/signout; profile persistence; favorites; private group creation; invite-link generation; missing invite; reset validation; test-account deletion; signed-out profile guard.
- Player TypeScript: passed.
- Local database assertions: 109 passed across six suites.
- HTTP concurrency: duplicate answer requests persist exactly one award.
- Storage/account integration: passed upload/read, ownership denial, MIME/size enforcement, cleanup, deletion, stale-token denial and concurrent upload/delete serialization.
- Browser errors: observed reset raw-text warning, corrected and recaptured without the warning. The initial history 401 response was `JWT issued at future`; it resolved after local clock alignment and now has bounded client retry. This is not a claim of complete accessibility compliance.
- Test account and its owned group were deleted via UI. Audit credentials were removed from /tmp. Existing user accounts/rounds were not reset.
- Everything remains local. Nothing pushed or deployed.

## Screenshots

Screenshots are viewport captures, not a claim that content below the fold is absent. The captions identify pre-fix versus post-fix evidence. 03 is retained only as a rejected fade-transition capture. The filenames are the capture order; 22 shows the group list after creation (despite its filename).

![Verified mobile screens](verified-screens.jpg)

### 01-guest-home

![01-guest-home](01-guest-home.png)

### 02-practice-overview

![02-practice-overview](02-practice-overview.png)

### 04-practice-question

![04-practice-question](04-practice-question.png)

### 05-practice-paid-hint

![05-practice-paid-hint](05-practice-paid-hint.png)

### 06-practice-feedback

![06-practice-feedback](06-practice-feedback.png)

### 07-practice-correct

![07-practice-correct](07-practice-correct.png)

### 08-guest-results

![08-guest-results](08-guest-results.png)

### 09-signup

![09-signup](09-signup.png)

### 10-profile

![10-profile](10-profile.png)

### 11-member-home

![11-member-home](11-member-home.png)

### 12-ranked-overview

![12-ranked-overview](12-ranked-overview.png)

### 13-ranked-verse

![13-ranked-verse](13-ranked-verse.png)

### 14-ranked-question

![14-ranked-question](14-ranked-question.png)

### 15-ranked-paid-hint

![15-ranked-paid-hint](15-ranked-paid-hint.png)

### 16-ranked-feedback

![16-ranked-feedback](16-ranked-feedback.png)

### 17-ranked-results

![17-ranked-results](17-ranked-results.png)

### 18-mobile-home

![18-mobile-home](18-mobile-home.png)

### 19-completed-reopen-bug

![19-completed-reopen-bug](19-completed-reopen-bug.png)

### 20-groups

![20-groups](20-groups.png)

### 21-create-group

![21-create-group](21-create-group.png)

### 22-group-detail

![22-group-detail](22-group-detail.png)

### 23-group-detail

![23-group-detail](23-group-detail.png)

### 24-invite-link

![24-invite-link](24-invite-link.png)

### 25-profile-mobile

![25-profile-mobile](25-profile-mobile.png)

### 26-direct-results-fixed

![26-direct-results-fixed](26-direct-results-fixed.png)

### 27-timed-overview

![27-timed-overview](27-timed-overview.png)

### 28-timed-clue-corrected

![28-timed-clue-corrected](28-timed-clue-corrected.png)

### 29-timed-question

![29-timed-question](29-timed-question.png)

### 30-timed-expiry

![30-timed-expiry](30-timed-expiry.png)

### 31-timed-next

![31-timed-next](31-timed-next.png)

### 32-challenger-overview

![32-challenger-overview](32-challenger-overview.png)

### 33-challenger-five-wrong

![33-challenger-five-wrong](33-challenger-five-wrong.png)

### 34-invalid-invite

![34-invalid-invite](34-invalid-invite.png)

### 35-reset-screen

![35-reset-screen](35-reset-screen.png)

### 36-profile-save

![36-profile-save](36-profile-save.png)

### 37-login

![37-login](37-login.png)

### 38-forgot-password

![38-forgot-password](38-forgot-password.png)

### 39-reset-validation

![39-reset-validation](39-reset-validation.png)

### 40-profile-reloaded

![40-profile-reloaded](40-profile-reloaded.png)

### 41-profile-favorites-fixed

![41-profile-favorites-fixed](41-profile-favorites-fixed.png)

### 42-home-favorites-fixed

![42-home-favorites-fixed](42-home-favorites-fixed.png)

### 43-groups-heading-fixed

![43-groups-heading-fixed](43-groups-heading-fixed.png)

### 44-reset-warning-fixed

![44-reset-warning-fixed](44-reset-warning-fixed.png)

### 45-delete-account-confirmation

![45-delete-account-confirmation](45-delete-account-confirmation.png)

### 46-deleted-account

![46-deleted-account](46-deleted-account.png)

### 47-guest-profile-guard

![47-guest-profile-guard](47-guest-profile-guard.png)
