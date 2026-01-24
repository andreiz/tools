/* global module */
(function(root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.ColorPicker = factory();
  }
})(typeof self !== "undefined" ? self : this, function() {
  const baseHues = [
    0,    // Red
    120,  // Green
    240,  // Blue
    60,   // Yellow
    180,  // Cyan
    300,  // Magenta
    30,   // Orange
    90,   // Yellow-green
    150,  // Blue-green
    210,  // Blue-purple
    270,  // Purple
    330   // Pink
  ];

  const hslToHex = (h, s, l) => {
    let r, g, b;
    h /= 360;
    s /= 100;
    l /= 100;

    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };

      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }

    const toHex = (x) => {
      const hex = Math.round(x * 255).toString(16);
      return hex.length === 1 ? "0" + hex : hex;
    };

    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  };

  const getHueFromColor = (color) => {
    if (color.startsWith("#")) {
      const r = parseInt(color.slice(1, 3), 16) / 255;
      const g = parseInt(color.slice(3, 5), 16) / 255;
      const b = parseInt(color.slice(5, 7), 16) / 255;

      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      let h;

      if (max === min) {
        return 0;
      }

      const d = max - min;
      switch (max) {
        case r:
          h = (g - b) / d + (g < b ? 6 : 0);
          break;
        case g:
          h = (b - r) / d + 2;
          break;
        case b:
          h = (r - g) / d + 4;
          break;
      }

      return Math.round(h * 60);
    }

    if (color.startsWith("hsl")) {
      return parseInt(color.match(/hsl\((\d+)/)[1], 10);
    }

    return 0;
  };

  const getNearestBaseHueIndex = (hue) => baseHues.reduce((bestIndex, baseHue, index) => {
    const bestHue = baseHues[bestIndex];
    const bestDistance = Math.min(
      Math.abs(bestHue - hue),
      360 - Math.abs(bestHue - hue)
    );
    const distance = Math.min(
      Math.abs(baseHue - hue),
      360 - Math.abs(baseHue - hue)
    );
    return distance < bestDistance ? index : bestIndex;
  }, 0);

  const pickDistinctHueForMonth = (ranges, year, month) => {
    const monthStart = new Date(year, month, 1);
    monthStart.setHours(0, 0, 0, 0);
    const monthEnd = new Date(year, month + 1, 0);
    monthEnd.setHours(23, 59, 59, 999);

    const overlappingHues = ranges
      .filter((range) => {
        const rangeStart = new Date(range.startDate);
        const rangeEnd = new Date(range.endDate);
        return rangeStart <= monthEnd && rangeEnd >= monthStart;
      })
      .map((range) => getHueFromColor(range.color))
      .filter((hue) => Number.isFinite(hue));

    if (overlappingHues.length === 0) {
      const hue = baseHues[Math.floor(Math.random() * baseHues.length)];
      return hslToHex(hue, 70, 90);
    }

    const usedHueIndices = new Set(
      overlappingHues.map((hue) => getNearestBaseHueIndex(hue))
    );
    const candidateHues = baseHues.filter((_, index) => !usedHueIndices.has(index));
    const huesToScore = candidateHues.length > 0 ? candidateHues : baseHues;

    let bestHue = huesToScore[0];
    let maxMinDistance = -1;

    for (const baseHue of huesToScore) {
      let minDistance = 360;

      for (const existingHue of overlappingHues) {
        let distance = Math.abs(baseHue - existingHue);
        if (distance > 180) {
          distance = 360 - distance;
        }
        minDistance = Math.min(minDistance, distance);
      }

      if (minDistance > maxMinDistance) {
        maxMinDistance = minDistance;
        bestHue = baseHue;
      }
    }

    return hslToHex(bestHue, 70, 90);
  };

  return {
    baseHues,
    hslToHex,
    getHueFromColor,
    getNearestBaseHueIndex,
    pickDistinctHueForMonth
  };
});
