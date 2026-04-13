# Mining ROI Calculator — Circuito AI Optimization

Open-source calculation engine behind the [Circuito AI ROI Calculator](https://circuito.ai/en/calculator/). Estimates the incremental revenue and profit a mining operation can capture by deploying **Circuito AI** optimization on grinding and flotation circuits.

## Quick Start

```bash
# Zero dependencies — runs on Node.js 18+
node --test calculator.test.mjs   # run tests

# Use in your code
import { calculate, getOreType, oreTypes } from "./calculator.mjs";

const result = calculate({
  oreTypeId: "copper",
  annualThroughput: 10_000_000,  // tons/year
  millType: "ball",
  grade: 0.5,                    // % Cu
  recoveryRate: 88,              // %
  metalPrice: 8800,              // USD/ton of copper metal
  contributionMargin: 40,        // %
});

console.log(result.combined.totalAdditionalProfit);
// → ~5,786,880 USD/year
```

No dependencies. No build step. Single ES module file.

## What This Calculates

The calculator models two independent value streams from AI optimization:

1. **Grinding optimization** — AI increases mill throughput, processing more ore with the same equipment
2. **Flotation optimization** — AI improves mineral recovery rate, capturing more metal from each ton

These are combined into a total annual benefit, then compared against Circuito AI's cost structure to produce payback estimates.

---

## Calculation Methodology

### Grinding Circuit — Throughput Improvement

Circuito AI optimizes grinding parameters (mill speed, feed rate, water addition, classifier settings) to increase throughput while maintaining target grind size.

**Benchmark improvements (from field deployments):**

| Mill Type | Throughput Improvement |
|-----------|----------------------|
| Ball mill | +2.6%                |
| SAG mill  | +1.4%                |

**Formulas:**

```
Additional tons = Annual throughput × Improvement fraction
```

Revenue calculation depends on the ore's pricing unit:

| Price Unit              | Revenue Formula                                                    |
|-------------------------|--------------------------------------------------------------------|
| USD/ton of metal        | Additional tons × (Grade% / 100) × (Recovery% / 100) × Price      |
| USD/troy oz             | Additional tons × (Grade g/t / 31.1035) × (Recovery% / 100) × Price |
| USD/lb                  | Additional tons × (Grade% / 100) × (Recovery% / 100) × 2204.62 × Price |
| USD/ton of concentrate  | Additional tons × (Recovery% / 100) × Price                        |

```
Grinding profit = Grinding revenue × Contribution margin
```

### Flotation Circuit — Recovery Improvement

Circuito AI optimizes flotation parameters (reagent dosage, air flow, froth depth, cell levels) to increase mineral recovery.

**Benchmark improvement:** +1.0 percentage point recovery uplift (default)

**Formula:**

```
Flotation revenue = Annual throughput × (Improvement pp / 100) × Metal revenue per ton
Flotation profit  = Flotation revenue × Contribution margin
```

> **Note:** Flotation optimization applies to all ore types except iron (which uses magnetic separation, not flotation).

### Unit Conversions

The calculator handles four pricing conventions used across the mining industry:

| Ore Types                    | Grade Unit | Price Unit              | Metal Output Unit |
|------------------------------|-----------|-------------------------|-------------------|
| Copper, Nickel, Zinc, Lead   | %         | USD/ton of metal        | metric tons       |
| Gold, Silver, Platinum       | g/t       | USD/troy oz             | troy ounces       |
| Molybdenum                   | %         | USD/lb                  | pounds            |
| Iron                         | % Fe      | USD/ton of concentrate  | tons concentrate  |

**Constants:**
- 1 troy ounce = 31.1035 grams
- 1 metric ton = 2,204.62 pounds

### Payback Analysis

The calculator estimates three cost phases of a Circuito AI deployment:

| Phase             | Cost (USD)   | Payback Metric        |
|-------------------|--------------|-----------------------|
| Site Assessment   | $75,000      | Days to recover       |
| Deployment        | $800,000     | Months to recover     |
| Annual License    | See formula  | Net annual value      |

**License scaling formula:**

```
License = max($250,000, $2,500,000 × (Annual throughput / 10,000,000))
```

- Floor: $250,000/year (for small operations)
- Reference point: $2,500,000/year at 10M tons/year
- Scales linearly with throughput

**Net annual value:**

```
Net annual value = Total additional profit − Annual license
```

---

## Supported Ore Types

| Ore        | Default Grade | Default Recovery | Default Price      | Flotation |
|------------|--------------|------------------|--------------------|-----------|
| Copper     | 0.5%         | 88%              | $8,800/t           | Yes       |
| Gold       | 1.5 g/t      | 85%              | $2,300/oz          | Yes       |
| Silver     | 50 g/t       | 85%              | $28/oz             | Yes       |
| Nickel     | 1.0%         | 85%              | $16,000/t          | Yes       |
| Zinc       | 4.0%         | 90%              | $2,700/t           | Yes       |
| Lead       | 3.0%         | 88%              | $2,100/t           | Yes       |
| Molybdenum | 0.03%        | 80%              | $20/lb             | Yes       |
| Platinum   | 3.0 g/t      | 85%              | $950/oz            | Yes       |
| Iron       | 50% Fe       | 70%              | $110/t concentrate | No        |

Defaults are starting points. Override with your site's actual data for accurate estimates.

## API

### `calculate(inputs, oreType?)`

Main entry point. Returns grinding, flotation, combined, and payback results.

**Parameters:**

| Field                    | Type              | Required | Description                                     |
|--------------------------|-------------------|----------|-------------------------------------------------|
| `oreTypeId`              | string            | Yes      | One of the ore type ids (e.g. `"copper"`)       |
| `annualThroughput`       | number            | Yes      | Tons of ore processed per year                   |
| `millType`               | `"ball"` \| `"sag"` | Yes   | Grinding mill type                               |
| `grade`                  | number            | Yes      | Ore grade (% or g/t, depending on ore type)      |
| `recoveryRate`           | number            | Yes      | Current recovery rate (%)                        |
| `metalPrice`             | number            | Yes      | Metal price in the ore's native unit             |
| `contributionMargin`     | number            | Yes      | Contribution margin (%)                          |
| `grindingImprovementPct` | number            | No       | Override grinding improvement (fraction)         |
| `flotationImprovementPp` | number            | No       | Override flotation improvement (percentage pts)  |

If `oreType` is not passed, it's auto-resolved from `oreTypeId`.

**Returns:**

```js
{
  grinding: {
    improvementPct,      // fraction (e.g. 0.026)
    additionalTons,      // extra tons processed
    additionalMetal,     // extra metal produced (in native unit)
    additionalMetalUnit, // "t", "oz", "lb", or "t concentrate"
    additionalRevenue,   // USD
    additionalProfit,    // USD
  },
  flotation: {           // null for iron
    improvementPp,       // percentage points
    newRecoveryRate,     // %
    additionalMetal,
    additionalMetalUnit,
    additionalRevenue,
    additionalProfit,
  },
  combined: {
    totalAdditionalRevenue,
    totalAdditionalProfit,
  },
  payback: {
    assessmentDays,      // days to recover assessment cost
    deploymentMonths,    // months to recover deployment cost
    estimatedLicense,    // annual license fee (USD)
    netAnnualValue,      // profit minus license (USD)
  },
}
```

### `getOreType(id)`

Look up an ore type definition by id. Throws if not found.

### `oreTypes`

Array of all 9 supported ore type definitions with defaults and metadata.

## Running Tests

```bash
node --test calculator.test.mjs
```

Uses Node.js built-in test runner (Node 18+). Zero dependencies.

Tests cover:
- Copper/ball mill scenario (full grinding + flotation)
- Gold/SAG mill scenario (troy oz conversions)
- Iron/ball mill scenario (no flotation, concentrate pricing)
- Molybdenum unit conversion (% grade → lbs output)
- Payback calculations (license scaling, floor, assessment days)
- Edge cases (zero throughput, zero margin, custom overrides)

## Try the Live Calculator

**[circuito.ai/en/calculator](https://circuito.ai/en/calculator/)** — interactive version with visualization, available in English, Spanish, and Portuguese.

## About

Built by [Circuito AI](https://circuito.ai) — industrial AI for mining optimization in Latin America.

## License

MIT
