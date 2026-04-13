/**
 * Circuito AI — Mining ROI Calculator Engine
 *
 * Estimates the incremental revenue and profit a mining operation can capture
 * by deploying Circuito AI optimization on grinding and flotation circuits.
 *
 * Live calculator: https://circuito.ai/en/calculator/
 *
 * @license MIT
 * @see https://github.com/lulosol/circuito-ai-mining-roi-calculator
 */

// ---------------------------------------------------------------------------
// Unit conversion constants
// ---------------------------------------------------------------------------
const TROY_OZ_IN_GRAMS = 31.1035;
const LBS_IN_METRIC_TON = 2204.62;

// ---------------------------------------------------------------------------
// Benchmark assumptions (Circuito AI field data)
// ---------------------------------------------------------------------------

/** Throughput improvement from AI-optimized grinding (fraction, not %). */
export const GRINDING_IMPROVEMENT = { ball: 0.026, sag: 0.014 };

/** Default flotation recovery uplift in percentage points. */
export const DEFAULT_FLOTATION_IMPROVEMENT_PP = 1.0;

// ---------------------------------------------------------------------------
// Cost assumptions (USD)
// ---------------------------------------------------------------------------
export const SITE_ASSESSMENT_COST = 75_000;
export const DEPLOYMENT_COST_MID = 800_000;
export const LICENSE_BASE = 2_500_000;
export const LICENSE_BASE_THROUGHPUT = 10_000_000;
export const LICENSE_FLOOR = 250_000;

// ---------------------------------------------------------------------------
// Ore types
// ---------------------------------------------------------------------------
export const oreTypes = [
  {
    id: "copper",
    label: "Copper",
    hasFlotation: true,
    gradeUnit: "percent",
    priceUnit: "usd_per_ton",
    defaults: { grade: 0.5, recoveryRate: 88, metalPrice: 8800 },
    typicalGradeRange: [0.3, 1.5],
    typicalRecoveryRange: [85, 92],
  },
  {
    id: "gold",
    label: "Gold",
    hasFlotation: true,
    gradeUnit: "g_per_t",
    priceUnit: "usd_per_troy_oz",
    defaults: { grade: 1.5, recoveryRate: 85, metalPrice: 2300 },
    typicalGradeRange: [0.5, 10],
    typicalRecoveryRange: [80, 95],
  },
  {
    id: "silver",
    label: "Silver",
    hasFlotation: true,
    gradeUnit: "g_per_t",
    priceUnit: "usd_per_troy_oz",
    defaults: { grade: 50, recoveryRate: 85, metalPrice: 28 },
    typicalGradeRange: [20, 300],
    typicalRecoveryRange: [80, 92],
  },
  {
    id: "nickel",
    label: "Nickel",
    hasFlotation: true,
    gradeUnit: "percent",
    priceUnit: "usd_per_ton",
    defaults: { grade: 1.0, recoveryRate: 85, metalPrice: 16000 },
    typicalGradeRange: [0.5, 2.5],
    typicalRecoveryRange: [75, 90],
  },
  {
    id: "zinc",
    label: "Zinc",
    hasFlotation: true,
    gradeUnit: "percent",
    priceUnit: "usd_per_ton",
    defaults: { grade: 4.0, recoveryRate: 90, metalPrice: 2700 },
    typicalGradeRange: [2, 10],
    typicalRecoveryRange: [85, 93],
  },
  {
    id: "lead",
    label: "Lead",
    hasFlotation: true,
    gradeUnit: "percent",
    priceUnit: "usd_per_ton",
    defaults: { grade: 3.0, recoveryRate: 88, metalPrice: 2100 },
    typicalGradeRange: [1, 8],
    typicalRecoveryRange: [85, 93],
  },
  {
    id: "molybdenum",
    label: "Molybdenum",
    hasFlotation: true,
    gradeUnit: "percent",
    priceUnit: "usd_per_lb",
    defaults: { grade: 0.03, recoveryRate: 80, metalPrice: 20 },
    typicalGradeRange: [0.01, 0.1],
    typicalRecoveryRange: [70, 90],
  },
  {
    id: "platinum",
    label: "Platinum (PGMs)",
    hasFlotation: true,
    gradeUnit: "g_per_t",
    priceUnit: "usd_per_troy_oz",
    defaults: { grade: 3.0, recoveryRate: 85, metalPrice: 950 },
    typicalGradeRange: [1, 8],
    typicalRecoveryRange: [80, 90],
  },
  {
    id: "iron",
    label: "Iron",
    hasFlotation: false,
    gradeUnit: "percent",
    priceUnit: "usd_per_ton_concentrate",
    defaults: { grade: 50, recoveryRate: 70, metalPrice: 110 },
    typicalGradeRange: [30, 65],
    typicalRecoveryRange: [60, 85],
  },
];

/**
 * Look up an ore type by id.
 * @param {string} id
 * @returns {object}
 */
export function getOreType(id) {
  const ore = oreTypes.find((o) => o.id === id);
  if (!ore) throw new Error(`Unknown ore type: ${id}`);
  return ore;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function metalRevenuePerTon(grade, metalPrice, oreType) {
  switch (oreType.priceUnit) {
    case "usd_per_ton":
      return (grade / 100) * metalPrice;
    case "usd_per_troy_oz":
      return (grade / TROY_OZ_IN_GRAMS) * metalPrice;
    case "usd_per_lb":
      return (grade / 100) * LBS_IN_METRIC_TON * metalPrice;
    case "usd_per_ton_concentrate":
      return metalPrice;
    default:
      return 0;
  }
}

function metalUnit(oreType) {
  switch (oreType.priceUnit) {
    case "usd_per_ton":
      return "t";
    case "usd_per_troy_oz":
      return "oz";
    case "usd_per_lb":
      return "lb";
    case "usd_per_ton_concentrate":
      return "t concentrate";
    default:
      return "";
  }
}

function additionalMetalAmount(tons, grade, recovery, oreType) {
  switch (oreType.priceUnit) {
    case "usd_per_ton":
      return tons * (grade / 100) * (recovery / 100);
    case "usd_per_troy_oz":
      return (tons * grade * (recovery / 100)) / TROY_OZ_IN_GRAMS;
    case "usd_per_lb":
      return tons * (grade / 100) * (recovery / 100) * LBS_IN_METRIC_TON;
    case "usd_per_ton_concentrate":
      return tons * (recovery / 100);
    default:
      return 0;
  }
}

// ---------------------------------------------------------------------------
// Main calculation
// ---------------------------------------------------------------------------

/**
 * Run the full ROI calculation.
 *
 * @param {object} inputs
 * @param {string} inputs.oreTypeId        — one of the ore type ids (e.g. "copper")
 * @param {number} inputs.annualThroughput — tons of ore processed per year
 * @param {"ball"|"sag"} inputs.millType   — grinding mill type
 * @param {number} inputs.grade            — ore grade (% or g/t depending on ore)
 * @param {number} inputs.recoveryRate     — current recovery rate (%)
 * @param {number} inputs.metalPrice       — metal price in the ore's price unit
 * @param {number} inputs.contributionMargin — contribution margin (%)
 * @param {number} [inputs.grindingImprovementPct] — override grinding improvement fraction
 * @param {number} [inputs.flotationImprovementPp] — override flotation improvement in pp
 *
 * @param {object} [oreType] — ore type object (auto-resolved from oreTypeId if omitted)
 *
 * @returns {{ grinding, flotation, combined, payback }}
 */
export function calculate(inputs, oreType) {
  if (!oreType) {
    oreType = getOreType(inputs.oreTypeId);
  }

  const {
    annualThroughput,
    millType,
    grade,
    recoveryRate,
    metalPrice,
    contributionMargin,
  } = inputs;

  const grindingPct =
    inputs.grindingImprovementPct ?? GRINDING_IMPROVEMENT[millType];
  const flotationPp =
    inputs.flotationImprovementPp ?? DEFAULT_FLOTATION_IMPROVEMENT_PP;

  const marginFraction = contributionMargin / 100;
  const unit = metalUnit(oreType);
  const isIron = oreType.priceUnit === "usd_per_ton_concentrate";

  // --- Grinding ---
  const additionalTons = annualThroughput * grindingPct;

  let grindingRevenue;
  let grindingMetal;

  if (isIron) {
    grindingMetal = additionalTons * (recoveryRate / 100);
    grindingRevenue = grindingMetal * metalPrice;
  } else {
    grindingMetal = additionalMetalAmount(
      additionalTons,
      grade,
      recoveryRate,
      oreType,
    );
    grindingRevenue =
      additionalTons *
      (recoveryRate / 100) *
      metalRevenuePerTon(grade, metalPrice, oreType);
  }

  const grindingProfit = grindingRevenue * marginFraction;

  const grinding = {
    improvementPct: grindingPct,
    additionalTons,
    additionalMetal: grindingMetal,
    additionalMetalUnit: unit,
    additionalRevenue: grindingRevenue,
    additionalProfit: grindingProfit,
  };

  // --- Flotation ---
  let flotation = null;

  if (oreType.hasFlotation) {
    const newRecovery = recoveryRate + flotationPp;
    const flotationMetal = additionalMetalAmount(
      annualThroughput,
      grade,
      flotationPp,
      oreType,
    );
    const flotationRevenue =
      annualThroughput *
      (flotationPp / 100) *
      metalRevenuePerTon(grade, metalPrice, oreType);
    const flotationProfit = flotationRevenue * marginFraction;

    flotation = {
      improvementPp: flotationPp,
      newRecoveryRate: newRecovery,
      additionalMetal: flotationMetal,
      additionalMetalUnit: unit,
      additionalRevenue: flotationRevenue,
      additionalProfit: flotationProfit,
    };
  }

  // --- Combined ---
  const totalRevenue = grindingRevenue + (flotation?.additionalRevenue ?? 0);
  const totalProfit = grindingProfit + (flotation?.additionalProfit ?? 0);

  // --- Payback ---
  const dailyProfit = totalProfit / 365;
  const monthlyProfit = totalProfit / 12;
  const estimatedLicense = Math.max(
    LICENSE_FLOOR,
    LICENSE_BASE * (annualThroughput / LICENSE_BASE_THROUGHPUT),
  );

  const payback = {
    assessmentDays:
      dailyProfit > 0
        ? Math.ceil(SITE_ASSESSMENT_COST / dailyProfit)
        : Infinity,
    deploymentMonths:
      monthlyProfit > 0
        ? Math.ceil(DEPLOYMENT_COST_MID / monthlyProfit)
        : Infinity,
    estimatedLicense,
    netAnnualValue: totalProfit - estimatedLicense,
  };

  return {
    grinding,
    flotation,
    combined: {
      totalAdditionalRevenue: totalRevenue,
      totalAdditionalProfit: totalProfit,
    },
    payback,
  };
}
