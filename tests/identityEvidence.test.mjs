import assert from "node:assert/strict";
import test from "node:test";
import { assessIdentityEvidence } from "../lib/identityEvidence.js";

test("collector number alone cannot verify a card", () => {
  const r = assessIdentityEvidence({ identifiedCardNumber: "149/128" });
  assert.equal(r.verified, false);
  assert.equal(r.status, "unverified");
  assert.ok(r.missing.includes("subject"));
  assert.ok(r.missing.includes("set"));
});
test("even all AI fields are provisional without independent catalog", () => {
  const r = assessIdentityEvidence({ identifiedSubject: "Pikachu ex", identifiedCardNumber: "149/128", identifiedBrandSet: "Sample Set", identifiedYear: "2026", identifiedParallel: "SIR" });
  assert.equal(r.candidatesComplete, true);
  assert.equal(r.verified, false);
});
test("conflicting user-provided set is flagged", () => {
  const r = assessIdentityEvidence({ identifiedSubject: "Pikachu", identifiedCardNumber: "149/128", identifiedBrandSet: "Wrong Set" }, { cardSet: "Expected Set" });
  assert.equal(r.status, "conflicting");
  assert.equal(r.contradictions.length, 1);
});
test("missing photo result is not treated as verified", () => {
  const r = assessIdentityEvidence(null);
  assert.equal(r.verified, false);
  assert.equal(r.status, "unverified");
});
