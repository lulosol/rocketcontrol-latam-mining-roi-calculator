import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { calculate, getOreType } from "./calculator.mjs";

function run(overrides = {}) {
  const defaults = {
    oreTypeId: "copper",
    annualThroughput: 10_000_000,
    millType: "ball",
    grade: 0.5,
    recoveryRate: 88,
    metalPrice: 8800,
    contributionMargin: 40,
  };
  const inputs = { ...defaults, ...overrides };
  return calculate(inputs, getOreType(inputs.oreTypeId));
}

function closeTo(actual, expected, tolerance = 1) {
  const diff = Math.abs(actual - expected);
  assert.ok(
    diff <= tolerance,
    `Expected ${actual} to be close to ${expected} (±${tolerance}), diff was ${diff}`,
  );
}

// ---------------------------------------------------------------------------
// Example 1 — Copper, Ball Mill
// ---------------------------------------------------------------------------
describe("Example 1 — Copper, Ball Mill", () => {
  const r = run();

  it("grinding: additional tons", () => {
    closeTo(r.grinding.additionalTons, 260_000);
  });

  it("grinding: additional metal (Cu tons)", () => {
    // 260,000 × 0.005 × 0.88 = 1,144
    closeTo(r.grinding.additionalMetal, 1144);
  });

  it("grinding: additional revenue", () => {
    // 1,144 × 8,800 ≈ 10,067,200
    closeTo(r.grinding.additionalRevenue, 10_067_200, 100);
  });

  it("grinding: additional profit", () => {
    // 10,067,200 × 0.40 ≈ 4,026,880
    closeTo(r.grinding.additionalProfit, 4_026_880, 100);
  });

  it("flotation: additional metal", () => {
    // 10,000,000 × 0.005 × 0.01 = 500
    closeTo(r.flotation.additionalMetal, 500);
  });

  it("flotation: additional revenue", () => {
    // 500 × 8,800 = 4,400,000
    closeTo(r.flotation.additionalRevenue, 4_400_000, 100);
  });

  it("flotation: additional profit", () => {
    // 4,400,000 × 0.40 = 1,760,000
    closeTo(r.flotation.additionalProfit, 1_760_000, 100);
  });

  it("combined profit", () => {
    // 4,026,880 + 1,760,000 ≈ 5,786,880
    closeTo(r.combined.totalAdditionalProfit, 5_786_880, 100);
  });
});

// ---------------------------------------------------------------------------
// Example 2 — Gold, SAG Mill
// ---------------------------------------------------------------------------
describe("Example 2 — Gold, SAG Mill", () => {
  const r = run({
    oreTypeId: "gold",
    annualThroughput: 5_000_000,
    millType: "sag",
    grade: 1.5,
    recoveryRate: 85,
    metalPrice: 2300,
    contributionMargin: 45,
  });

  it("grinding: additional tons", () => {
    closeTo(r.grinding.additionalTons, 70_000);
  });

  it("grinding: additional metal (troy oz)", () => {
    // 70,000 × 1.5 × 0.85 / 31.1035 ≈ 2,869
    closeTo(r.grinding.additionalMetal, 2869, 5);
  });

  it("grinding: additional revenue", () => {
    closeTo(r.grinding.additionalRevenue, 6_599_390, 1000);
  });

  it("grinding: additional profit", () => {
    closeTo(r.grinding.additionalProfit, 2_969_726, 1000);
  });

  it("flotation: additional metal (troy oz)", () => {
    closeTo(r.flotation.additionalMetal, 2411.5, 5);
  });

  it("flotation: additional revenue", () => {
    closeTo(r.flotation.additionalRevenue, 5_546_450, 1000);
  });

  it("flotation: additional profit", () => {
    closeTo(r.flotation.additionalProfit, 2_495_903, 1000);
  });

  it("combined profit", () => {
    closeTo(r.combined.totalAdditionalProfit, 5_465_629, 1000);
  });
});

// ---------------------------------------------------------------------------
// Example 3 — Iron, Ball Mill (no flotation)
// ---------------------------------------------------------------------------
describe("Example 3 — Iron, Ball Mill (no flotation)", () => {
  const r = run({
    oreTypeId: "iron",
    annualThroughput: 920_000,
    millType: "ball",
    grade: 50,
    recoveryRate: 70,
    metalPrice: 110,
    contributionMargin: 35,
  });

  it("grinding: additional tons", () => {
    closeTo(r.grinding.additionalTons, 23_920);
  });

  it("grinding: additional concentrate tons", () => {
    closeTo(r.grinding.additionalMetal, 16_744);
  });

  it("grinding: additional revenue", () => {
    closeTo(r.grinding.additionalRevenue, 1_841_840, 100);
  });

  it("grinding: additional profit", () => {
    closeTo(r.grinding.additionalProfit, 644_644, 100);
  });

  it("no flotation for iron", () => {
    assert.equal(r.flotation, null);
  });

  it("combined profit equals grinding profit", () => {
    closeTo(r.combined.totalAdditionalProfit, 644_644, 100);
  });
});

// ---------------------------------------------------------------------------
// Molybdenum unit conversion
// ---------------------------------------------------------------------------
describe("Molybdenum unit conversion (% → lbs)", () => {
  const r = run({
    oreTypeId: "molybdenum",
    annualThroughput: 10_000_000,
    millType: "ball",
    grade: 0.03,
    recoveryRate: 80,
    metalPrice: 20,
    contributionMargin: 40,
  });

  it("grinding metal in lbs", () => {
    closeTo(r.grinding.additionalMetal, 137_568, 50);
    assert.equal(r.grinding.additionalMetalUnit, "lb");
  });
});

// ---------------------------------------------------------------------------
// Payback calculations
// ---------------------------------------------------------------------------
describe("Payback calculations", () => {
  const r = run();

  it("license scales with throughput", () => {
    assert.equal(r.payback.estimatedLicense, 2_500_000);
  });

  it("license has floor of 250K", () => {
    const small = run({ annualThroughput: 500_000 });
    assert.equal(small.payback.estimatedLicense, 250_000);
  });

  it("assessment payback in days", () => {
    assert.ok(r.payback.assessmentDays < 10);
    assert.ok(r.payback.assessmentDays > 0);
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------
describe("Edge cases", () => {
  it("zero throughput returns zero results", () => {
    const r = run({ annualThroughput: 0 });
    assert.equal(r.combined.totalAdditionalProfit, 0);
  });

  it("zero margin returns zero profit", () => {
    const r = run({ contributionMargin: 0 });
    assert.equal(r.combined.totalAdditionalProfit, 0);
    assert.ok(r.combined.totalAdditionalRevenue > 0);
  });

  it("custom grinding override is respected", () => {
    const r = run({ grindingImprovementPct: 0.05 });
    closeTo(r.grinding.additionalTons, 500_000);
  });

  it("custom flotation override is respected", () => {
    const r = run({ flotationImprovementPp: 2.0 });
    closeTo(r.flotation.additionalMetal, 1000);
  });
});
