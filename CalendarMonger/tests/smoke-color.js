const assert = require("assert");
const fs = require("fs");
const path = require("path");
const colorPicker = require("../color-picker");

const rangesPath = path.join(__dirname, "..", "february.json");
const ranges = JSON.parse(fs.readFileSync(rangesPath, "utf8"));
const selectedYear = 2026;
const selectedMonth = 1; // February (0-based)

const withMockedRandom = (value, fn) => {
  const originalRandom = Math.random;
  Math.random = () => value;
  try {
    return fn();
  } finally {
    Math.random = originalRandom;
  }
};

const monthStart = new Date(selectedYear, selectedMonth, 1);
monthStart.setHours(0, 0, 0, 0);
const monthEnd = new Date(selectedYear, selectedMonth + 1, 0);
monthEnd.setHours(23, 59, 59, 999);

const overlappingRanges = ranges.filter((range) => {
  const rangeStart = new Date(range.startDate);
  const rangeEnd = new Date(range.endDate);
  return rangeStart <= monthEnd && rangeEnd >= monthStart;
});

const usedHueIndices = new Set(
  overlappingRanges.map((range) => {
    const hue = colorPicker.getHueFromColor(range.color);
    return colorPicker.getNearestBaseHueIndex(hue);
  })
);

const newColor = colorPicker.pickDistinctHueForMonth(ranges, selectedYear, selectedMonth);
const newHue = colorPicker.getHueFromColor(newColor);
const newHueIndex = colorPicker.getNearestBaseHueIndex(newHue);

if (usedHueIndices.size < colorPicker.baseHues.length) {
  assert(
    !usedHueIndices.has(newHueIndex),
    "Expected new hue to avoid hues already used in the selected month"
  );
}

// Case: no overlapping ranges in the month should still return a valid color.
const emptyRangesColor = withMockedRandom(0, () =>
  colorPicker.pickDistinctHueForMonth([], selectedYear, selectedMonth)
);
const expectedEmptyColor = colorPicker.hslToHex(colorPicker.baseHues[0], 70, 90);
assert.strictEqual(
  emptyRangesColor,
  expectedEmptyColor,
  "Expected deterministic color when no overlaps and random is stubbed"
);

// Case: if all base hues are already used, reuse is allowed but should still be valid.
const allHueRanges = colorPicker.baseHues.map((hue, index) => ({
  id: `test-${index}`,
  label: `Range ${index}`,
  color: colorPicker.hslToHex(hue, 70, 90),
  startDate: new Date(selectedYear, selectedMonth, index + 1).toISOString(),
  endDate: new Date(selectedYear, selectedMonth, index + 1).toISOString()
}));
const allHueColor = withMockedRandom(0.5, () =>
  colorPicker.pickDistinctHueForMonth(allHueRanges, selectedYear, selectedMonth)
);
assert(
  /^#[0-9a-f]{6}$/i.test(allHueColor),
  "Expected a valid hex color even when all hues are used"
);

console.log("smoke-color ok", {
  overlappingCount: overlappingRanges.length,
  usedHueCount: usedHueIndices.size,
  newColor,
  emptyRangesColor,
  allHueColor
});
