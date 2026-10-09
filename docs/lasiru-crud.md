# Lasiru — Tutor Search & Discovery CRUD

Lasiru's Tutor Search & Discovery workload contains two separate learner-owned CRUD resources. Search, filters, tutor listing, comparison, and “Why this tutor?” continue to work alongside them.

## CRUD resource 1 — Tutor Shortlist

| Operation | In the app | API |
| --- | --- | --- |
| Create | On Discover, tap **Shortlist** on a tutor card | `POST /api/tutor-shortlist` |
| Read | Tap **Shortlist** in the search tools row | `GET /api/tutor-shortlist` |
| Update | Tap **Edit**, change the personal note or priority, then save | `PUT /api/tutor-shortlist/:id` |
| Delete | Tap **Remove** and confirm | `DELETE /api/tutor-shortlist/:id` |

## CRUD resource 2 — Saved Searches

| Operation | In the app | API |
| --- | --- | --- |
| Create | Set keywords, subject, filters, and sort order; tap **Save search** and enter a name | `POST /api/saved-searches` |
| Read | Tap **Saved** to view the learner's saved search presets | `GET /api/saved-searches` |
| Update | Tap **Edit** and update the preset with the current search configuration | `PUT /api/saved-searches/:id` |
| Delete | Tap **Remove**, then confirm deletion | `DELETE /api/saved-searches/:id` |

Selecting **Apply** restores the saved keywords, subject, price range, rating, availability, experience, and sort order on Discover.

Both resources belong to the signed-in student. A student cannot read or modify another student's entries. Only active, verified tutors can be shortlisted, duplicate shortlist entries are rejected, and each learner can keep up to 20 saved searches.

## Demonstration

1. Sign in as a student and open Discover.
2. Add a verified tutor to the shortlist, edit its note/priority, then remove it.
3. Choose tutor-search filters and tap **Save search**.
4. Open **Saved**, apply the preset, update it with the current filters, then delete it.
5. From `Backend`, run `npm run test:lasiru`. The script tests both CRUD resources in an isolated temporary database and removes that database afterward.
