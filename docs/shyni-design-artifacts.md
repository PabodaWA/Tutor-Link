# Shyni — Tutor Profile & Verification design artifacts

Feature owner: Shyni  
Scope: tutor profile, qualifications, ratings/reviews, and verification.

These are report-ready design artifacts for the implemented prototype. They document the design progression; they are not records of user testing.

## 1. Initial sketches

The first idea separated the learner-facing trust decision from the tutor/admin verification workflow.

```text
LEARNER                          TUTOR                    ADMIN
┌─────────────────────┐          ┌──────────────────┐       ┌──────────────────────┐
│ Tutor photo/name  ✓ │          │ Edit profile     │       │ Pending tutors       │
│ Subjects • rate      │          │ Qualifications   │       │ Tutor + qualifications│
│ About / experience  │          │ Choose evidence  │       │ Open evidence        │
│ Qualifications      │          │ Submit           │       │ Approve / reject     │
│ Stars + reviews     │          │ Status / reason  │       │ Reason if rejected   │
│ Book lesson         │          └──────────────────┘       └──────────────────────┘
└─────────────────────┘
```

## 2. Wireframes

### Tutor profile — learner view

```text
┌─────────────────────────────────────┐
│ ←  Tutor profile                    │
├─────────────────────────────────────┤
│       [initials] ✓ Verified         │
│       Tutor name                    │
│       Subjects                      │
│    Rating | Lessons | Students      │
├─────────────────────────────────────┤
│ [Book lesson • hourly price]        │
├─────────────────────────────────────┤
│ About                               │
│ Bio / experience / next slot        │
├─────────────────────────────────────┤
│ Qualifications                      │
│ Submitted qualification list        │
│ Admin verification date             │
├─────────────────────────────────────┤
│ Student reviews                     │
│ Average ★★★★★ / 5–1 bar breakdown    │
│ Review cards / date                 │
├─────────────────────────────────────┤
│ Write verified review               │
│ Stars / comment / publish           │
└─────────────────────────────────────┘
```

### Verification — tutor and admin views

```text
TUTOR                                  ADMIN
┌──────────────────────────┐           ┌──────────────────────────┐
│ Profile details          │           │ Pending applications     │
│ Qualifications input     │           │ Name + qualifications    │
│ Save profile             │           │ Evidence [Preview]       │
│ Verification status      │           │ Reject + reason          │
│ [Choose PDF/image]       │           │ Approve                  │
│ Selected files [remove]  │           └──────────────────────────┘
│ [Submit for review]      │
│ Rejection reason, if any │
└──────────────────────────┘
```

## 3. Low-fidelity decisions

- Put profile identity and verification state at the top, because learners need trust information before booking.
- Keep qualifications and learner reviews in separate cards: qualifications are tutor-submitted, while reviews require completed lessons.
- Show an honest `New`/empty rating state instead of five filled stars for tutors without reviews.
- Require a written reason on rejection so tutors know what to correct.
- Show the selected evidence before submission, with a remove action to fix mistakes.
- Keep uploaded evidence private; only an admin can request a short-lived preview link.

## 4. High-fidelity prototype mapping

The implemented app is the high-fidelity prototype. Capture screenshots of these routes for the report:

| Screen | Route | What to capture |
| --- | --- | --- |
| Tutor profile | `/tutor/[id]` | Verified badge, profile facts, qualifications, rating breakdown, reviews |
| Edit/verify profile | `/edit-profile` as tutor | Evidence picker, selected files, status or rejection reason |
| Admin approval queue | `/admin?view=verify` as admin | Qualifications, document preview action, approve/reject controls |

Use one verified tutor with at least one completed lesson/review and one pending tutor application to show meaningful states. Do not submit sample screenshots as real user-test results.

### Automated prototype screenshots

These screenshots were captured from isolated demo accounts and a temporary test database on 22 September 2026. They show implemented UI states, **not** human participant observations.

| State | Screenshot |
| --- | --- |
| Tutor verification pending | [Pending application](screenshots/shyni-tutor-verification-details.png) |
| Admin approval queue and document preview action | [Admin queue](screenshots/shyni-admin-verification-queue.png) |
| Tutor rejection reason and resubmission | [Rejected application](screenshots/shyni-tutor-rejected.png) |
| Learner-facing verified tutor profile | [Tutor profile](screenshots/shyni-learner-tutor-profile.png) |
| Qualification and rating breakdown | [Reviews section](screenshots/shyni-learner-reviews.png) |
| Verified review editing | [Review editor](screenshots/shyni-learner-review-editor.png) |

## 5. Interaction states to demonstrate

1. Tutor selects 1–5 PDF/PNG/JPEG files, each at most 5 MB; unsupported files are rejected.
2. Tutor submits qualifications and files; status becomes `pending`.
3. Admin opens each uploaded document through a short-lived private preview.
4. Admin approves, or rejects with a reason; tutor sees the status/reason and can resubmit.
5. Learner views a verified profile and review distribution; only a learner with a completed booking can publish a review.
6. If a verified tutor changes their name or qualifications, verification is cleared and new evidence is required before the tutor is shown as verified again.

## 6. Prototype limitations

- Files are stored on the backend machine under `Backend/private_uploads/verification/`; back up this directory together with MongoDB. Ephemeral hosting will lose files. A production deployment should use private object storage and retention/deletion policy.
- Previously submitted **filename-only** applications cannot be previewed and must be resubmitted with actual files before approval.
- Screenshots, participant observations, success rates, and usability findings must come from real testing.
