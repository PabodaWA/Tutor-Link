# Medhani — credits, sessions, and lesson details

The prototype uses Tutor Link credits instead of charging money when a learner books.

## Credit rules

- `1 credit = Rs.100` of the calculated lesson price, rounded up.
- A learner must have the full credit cost available before creating a booking.
- Creating or rescheduling a booking does not deduct credits.
- After the tutor confirms an online booking, the learner unlocks its meeting using the full credit cost.
- Cancelling a pending booking or reschedule request is free because no session charge has been settled yet.
- Once a lesson is confirmed or scheduled, a learner cancellation keeps a 20% fee (minimum one credit). If the meeting was already unlocked, the remaining credits are refunded immediately.
- A tutor cancellation returns all charged credits to the learner.
- Cancellation is unavailable during the final two hours before a lesson.

## Implemented flow

1. From the student dashboard, open **Tutor Link credits**.
2. Buy a demo package or redeem `TUTORLINK25` / `STUDY50` once per account.
3. Create a booking. The API verifies the balance but leaves it unchanged.
4. Reschedule without a credit charge.
5. After tutor confirmation, open lesson details and select **Use credits** to unlock the meeting.
6. Review every purchase, redemption, meeting charge, cancellation fee, and refund in credit activity.
7. After lesson time, the tutor can mark the lesson complete and add a summary for the learner.

The room-code classroom remains a prototype and is not a real video SDK integration. Demo credit purchases do not charge real money.

From `Backend`, run `npm run test:medhani`. It uses an isolated temporary database and verifies buy/redeem, booking balance checks, no reschedule deduction, idempotent meeting unlock, cancellation fee/refund, completion, and tutor notes.
