# Tutor Profile & Verification — User Testing

Owner: Shyni  
Feature scope: tutor profiles, qualifications, ratings and reviews, and tutor verification

## Test setup

- Test with at least three participants who did not build the feature.
- Prepare one learner account, one unverified tutor account, and one admin account.
- Ensure the learner has one completed booking so the verified-review flow can be tested.
- Prepare a harmless PDF or image under 5 MB, plus an unsupported file or file over 5 MB for the error-state task.
- Ask participants to think aloud and avoid guiding them unless they are blocked.

## Tasks

1. As a learner, open a tutor profile and identify the tutor's subjects, rate, experience, and next available time.
2. Decide whether the tutor is verified and find their qualifications.
3. Interpret the overall rating and five-to-one-star rating breakdown.
4. Read a previous learner review and identify when it was posted.
5. Publish a rating and written review after a completed lesson.
6. As a tutor, update profile details and select a real PDF or image qualification document from the device.
7. Submit the tutor verification request and identify its current status.
8. As an admin, open the uploaded evidence preview, inspect the qualifications, then approve a request.
9. Reject a second request with a reason; as the tutor, find that reason and resubmit corrected evidence.
10. Try selecting an unsupported or over-5-MB file and describe the error message.
11. As a verified tutor, change a qualification and check whether the app requests verification again.

## Measurements

Record these for every task:

- Completed without help: Yes / No
- Completion time
- Wrong taps or navigation errors
- Where the participant hesitated
- Participant confidence from 1–5

| Participant | Task | Completed | Time | Errors | Confidence | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| P1 | 1 |  |  |  |  |  |
| P1 | 2 |  |  |  |  |  |
| P1 | 3 |  |  |  |  |  |
| P2 | 4 |  |  |  |  |  |
| P2 | 5 |  |  |  |  |  |
| P2 | 6 |  |  |  |  |  |
| P3 | 7 |  |  |  |  |  |
| P3 | 8 |  |  |  |  |  |
| P3 | 9 |  |  |  |  |  |
| P3 | 10 |  |  |  |  |  |
| P3 | 11 |  |  |  |  |  |

## Post-test questions

1. Which profile details helped you judge whether the tutor was suitable?
2. Was the difference between a submitted qualification and an admin-verified tutor clear?
3. Was the rating breakdown easy to understand?
4. Was it clear that only learners with completed lessons can review a tutor?
5. Was selecting and removing verification documents easy?
6. Could the tutor understand why a request was rejected and what to fix?
7. What would you change first?

## Report summary

Complete this section only after testing real participants. Do not invent results.

- Success rate:
- Average task-completion time:
- Most common usability issue:
- Highest-priority design change:
- Changes made after testing:

## Automated validation (not a substitute for participants)

The isolated `Backend` test script `npm run test:shyni -- --screenshots` passed on 22 September 2026. It verified real file upload and admin preview, rejection/resubmission, approval, learner review eligibility, review editing, and re-verification after changing a tutor's identity. It used a uniquely named temporary database and removed it after the run. Automated screenshots are linked from `shyni-design-artifacts.md`.

To reproduce screenshots, run that command with Chrome installed and a valid `Backend/.env` MongoDB connection. The script starts a separate Expo web instance; it does not use the main app database.
