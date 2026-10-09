
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  requestDateLabel,
  requestFullDateLabel,
  requestTimeLabel,
  requestReceivedLabel,
} from "./booking-request-types.ts";

test("Booking date label returns a readable date", () => {
  const result = requestDateLabel("2026-10-09T10:30:00");
  assert.equal(typeof result, "string");
  assert.ok(result.length > 0);
});

test("Booking full date label returns a readable date", () => {
  const result = requestFullDateLabel("2026-10-09T10:30:00");
  assert.equal(typeof result, "string");
  assert.ok(result.length > 0);
});

test("Booking time label returns a readable time", () => {
  const result = requestTimeLabel("2026-10-09T10:30:00");
  assert.equal(typeof result, "string");
  assert.ok(result.length > 0);
});

test("Recently received booking displays just now", () => {
  const result = requestReceivedLabel(new Date().toISOString());
  assert.equal(result, "just now");
});

test("Booking request without received date displays recently", () => {
  assert.equal(requestReceivedLabel(undefined), "recently");
});



test("Booking received 2 hours ago displays hours", () => {
  const twoHoursAgo = new Date(
    Date.now() - 2 * 60 * 60 * 1000
  ).toISOString();

  assert.equal(requestReceivedLabel(twoHoursAgo), "2h ago");
});

test("Booking received 3 days ago displays days", () => {
  const threeDaysAgo = new Date(
    Date.now() - 3 * 24 * 60 * 60 * 1000
  ).toISOString();

  assert.equal(requestReceivedLabel(threeDaysAgo), "3d ago");
});

test("Future booking request timestamp displays just now", () => {
  const futureDate = new Date(
    Date.now() + 10 * 60 * 1000
  ).toISOString();

  assert.equal(requestReceivedLabel(futureDate), "just now");
});

test("Booking received 30 minutes ago displays minutes", () => {
  const thirtyMinutesAgo = new Date(
    Date.now() - 30 * 60 * 1000
  ).toISOString();

  assert.equal(requestReceivedLabel(thirtyMinutesAgo), "30m ago");
});
