/* Aventrix Realty — Plot Area Calculator
 * Pure geometry (top) is exported for Node tests; DOM wiring (bottom) runs only on the calculator page.
 * All geometry is computed in feet. Drawing coordinates use screen convention (x right, y down). */
(function (root) {
  "use strict";

  const FT_PER_M = 3.280839895;
  const SQFT_PER_CENT = 435.6;
  const SQFT_PER_ACRE = 43560;
  const SQFT_PER_SQYD = 9;
  const SQM_PER_SQFT = 0.09290304;
  const TOL = 0.01; // 1% closure tolerance for orthogonal shapes

  const ok = (n) => Number.isFinite(n) && n > 0;

  /* ---------- Shape definitions (inputs only — no angles or directions) ---------- */
  const SHAPES = {
    square: {
      title: "Square Plot",
      help: "Enter one side length. All four sides of a square are equal.",
      fields: [{ id: "side", label: "Side length", short: "Side" }],
      sample: { side: 40 }
    },
    rectangle: {
      title: "Rectangular Plot",
      help: "Enter the front length and the depth. Opposite sides of a rectangle are equal. If your opposite sides differ, use Irregular Plot.",
      fields: [{ id: "length", label: "Front / back length", short: "Length" }, { id: "width", label: "Depth (left / right side)", short: "Depth" }],
      sample: { length: 60, width: 40 }
    },
    triangle: {
      title: "Triangular Plot",
      help: "Enter all three boundary sides. The area is exact (three-side formula).",
      fields: [{ id: "a", label: "Side 1 — Front (base)", short: "Side 1" }, { id: "b", label: "Side 2 — Right side", short: "Side 2" }, { id: "c", label: "Side 3 — Left side", short: "Side 3" }],
      sample: { a: 60, b: 50, c: 45 }
    },
    trapezoid: {
      title: "Trapezoidal Plot",
      help: "Enter the two parallel sides (front and back) and the two side boundaries. Add the perpendicular depth if you know it; otherwise it is worked out from the four sides.",
      fields: [{ id: "front", label: "Front side (parallel)", short: "Front" }, { id: "back", label: "Back side (parallel)", short: "Back" }, { id: "left", label: "Left side", short: "Left" }, { id: "right", label: "Right side", short: "Right" }, { id: "height", label: "Perpendicular depth (optional)", short: "Depth", optional: true }],
      sample: { front: 60, back: 40, left: 30, right: 30 }
    },
    lshape: {
      title: "L-Shaped Plot",
      help: "Enter all six sides clockwise from the top-left corner, as numbered on the drawing. Side 1 must equal Side 3 + Side 5, and Side 6 must equal Side 2 + Side 4.",
      fields: [{ id: "l1", label: "Side 1 — Top", short: "1" }, { id: "l2", label: "Side 2 — Right (upper)", short: "2" }, { id: "l3", label: "Side 3 — Inner step", short: "3" }, { id: "l4", label: "Side 4 — Inner side", short: "4" }, { id: "l5", label: "Side 5 — Bottom", short: "5" }, { id: "l6", label: "Side 6 — Left", short: "6" }],
      sample: { l1: 60, l2: 25, l3: 30, l4: 30, l5: 30, l6: 55 }
    },
    tshape: {
      title: "T-Shaped Plot",
      help: "Enter all eight sides clockwise from the top-left corner, as numbered on the drawing. Side 1 must equal Sides 3 + 5 + 7, and Sides 2 + 4 must equal Sides 6 + 8.",
      fields: [{ id: "t1", label: "Side 1 — Top (full width)", short: "1" }, { id: "t2", label: "Side 2 — Right end", short: "2" }, { id: "t3", label: "Side 3 — Right inner step", short: "3" }, { id: "t4", label: "Side 4 — Stem right side", short: "4" }, { id: "t5", label: "Side 5 — Stem bottom", short: "5" }, { id: "t6", label: "Side 6 — Stem left side", short: "6" }, { id: "t7", label: "Side 7 — Left inner step", short: "7" }, { id: "t8", label: "Side 8 — Left end", short: "8" }],
      sample: { t1: 70, t2: 20, t3: 25, t4: 35, t5: 20, t6: 35, t7: 25, t8: 20 }
    },
    flag: {
      title: "Flag-Shaped Plot",
      help: "A flag (panhandle) plot is a main plot reached by a narrow access path. Enter the main plot size and the access path size.",
      fields: [{ id: "mainWidth", label: "Main plot width", short: "Width" }, { id: "mainDepth", label: "Main plot depth", short: "Depth" }, { id: "pathWidth", label: "Access path width", short: "Path width" }, { id: "pathLength", label: "Access path length", short: "Path length" }],
      sample: { mainWidth: 50, mainDepth: 40, pathWidth: 12, pathLength: 25 }
    },
    pentagon: {
      title: "Pentagonal Plot",
      help: "Enter the five boundary sides in order around the plot.",
      sides: 5, fixedCount: true
    },
    polygon: {
      title: "Polygonal Plot",
      help: "Enter each boundary side in order around the plot (3–20 sides).",
      sides: 6
    },
    irregular: {
      title: "Irregular Plot",
      help: "Enter each boundary side in order around the plot. For a four-sided plot, add one diagonal for an exact area.",
      sides: 4, diagonal: true
    },
    curved: {
      title: "Curved-Boundary Plot",
      help: "Enter the four boundary lengths. If you have the area from a survey record, enter it for an exact result; otherwise an approximate area is shown.",
      fields: [{ id: "front", label: "Front (road side)", short: "Front" }, { id: "right", label: "Right side", short: "Right" }, { id: "back", label: "Back boundary (curved, measured along the curve)", short: "Back" }, { id: "left", label: "Left side", short: "Left" }],
      survey: true,
      sample: { front: 50, right: 40, back: 50, left: 40 }
    },
    corner: {
      title: "Corner Plot",
      help: "A corner plot faces roads on two sides. Choose its shape, then enter the measurements.",
      fields: []
    }
  };

  /* ---------- Geometry helpers ---------- */
  function shoelace(pts) {
    let s = 0;
    for (let i = 0; i < pts.length; i++) { const j = (i + 1) % pts.length; s += pts[i][0] * pts[j][1] - pts[j][0] * pts[i][1]; }
    return Math.abs(s) / 2;
  }
  function heron(a, b, c) {
    const s = (a + b + c) / 2, q = s * (s - a) * (s - b) * (s - c);
    return q > 0 ? Math.sqrt(q) : NaN;
  }
  function triangleOk(a, b, c) { const m = Math.max(a, b, c); return a + b + c - m > m * (1 + 1e-9); }
  // Third point of triangle with base P→Q, |P→R| = dp, |Q→R| = dq, on the side given by sign (screen y-down: -1 = above).
  function thirdPoint(P, Q, dp, dq, sign) {
    const dx = Q[0] - P[0], dy = Q[1] - P[1], d = Math.hypot(dx, dy);
    const a = (dp * dp - dq * dq + d * d) / (2 * d), h = Math.sqrt(Math.max(0, dp * dp - a * a));
    const ux = dx / d, uy = dy / d;
    return [P[0] + a * ux - sign * h * uy, P[1] + a * uy + sign * h * ux];
  }
  // Orient polygon so edge 0 (P0→P1) is horizontal at the bottom with the plot above it.
  function orientEdge0Bottom(pts) {
    const [x0, y0] = pts[0], ang = Math.atan2(pts[1][1] - y0, pts[1][0] - x0), c = Math.cos(-ang), s = Math.sin(-ang);
    let out = pts.map(([x, y]) => [(x - x0) * c - (y - y0) * s, (x - x0) * s + (y - y0) * c]);
    const cy = out.reduce((t, p) => t + p[1], 0) / out.length;
    if (cy > 0) out = out.map(([x, y]) => [x, -y]);
    return out;
  }
  // Cyclic polygon with the given sides: the largest area any polygon with these sides can have.
  function cyclicPolygon(sides) {
    const n = sides.length, total = sides.reduce((a, b) => a + b, 0), smax = Math.max(...sides), M = sides.indexOf(smax);
    if (smax >= total - smax) return null;
    const as = (s, R) => 2 * Math.asin(Math.min(1, s / (2 * R)));
    const R0 = smax / 2, gAll = (R) => sides.reduce((t, s) => t + as(s, R), 0);
    const inside = gAll(R0) >= 2 * Math.PI;
    const f = inside ? (R) => gAll(R) - 2 * Math.PI : (R) => (gAll(R) - as(smax, R)) - as(smax, R);
    let lo = R0, hi = R0 * 2;
    while ((inside ? f(hi) > 0 : f(hi) < 0) && hi < R0 * 1e7) hi *= 2;
    for (let k = 0; k < 200; k++) { const mid = (lo + hi) / 2, v = f(mid); if (inside ? v > 0 : v < 0) lo = mid; else hi = mid; }
    const R = (lo + hi) / 2;
    const theta = sides.map((s, i) => (!inside && i === M ? -as(s, R) : as(s, R)));
    let phi = 0; const pts = [];
    for (let i = 0; i < n; i++) { pts.push([R * Math.cos(phi), R * Math.sin(phi)]); phi += theta[i]; }
    return pts;
  }
  function regularPolygon(n, side) {
    const R = side / (2 * Math.sin(Math.PI / n));
    return Array.from({ length: n }, (_, i) => { const a = Math.PI / 2 + Math.PI / n + i * 2 * Math.PI / n; return [R * Math.cos(a), R * Math.sin(a)]; });
  }
  const seqEdges = (n, ids) => Array.from({ length: n }, (_, i) => ({ field: ids ? ids[i] : "side" + (i + 1) }));
  const relClose = (x, y) => Math.abs(x - y) <= Math.max(x, y) * TOL;

  /* ---------- Main geometry: values in ft. Returns area (sq ft), outline and edge→field map ---------- */
  function computeGeometry(shape, v, opts) {
    opts = opts || {};
    const need = (ids) => ids.every((id) => ok(v[id]));
    const fail = (error) => ({ ok: false, error });
    switch (shape) {
      case "square": {
        if (!need(["side"])) return fail("Enter a side length greater than zero.");
        const s = v.side;
        return { ok: true, area: s * s, approx: false, method: "Exact — side × side", pts: [[0, s], [s, s], [s, 0], [0, 0]], edges: seqEdges(4, ["side", "side", "side", "side"]) };
      }
      case "rectangle": {
        if (!need(["length", "width"])) return fail("Enter the front length and the depth as positive numbers.");
        const L = v.length, W = v.width;
        return { ok: true, area: L * W, approx: false, method: "Exact — length × depth", pts: [[0, W], [L, W], [L, 0], [0, 0]], edges: seqEdges(4, ["length", "width", "length", "width"]) };
      }
      case "triangle": {
        if (!need(["a", "b", "c"])) return fail("Enter all three sides as positive numbers.");
        const { a, b, c } = v;
        if (!triangleOk(a, b, c)) return fail("These lengths cannot form a triangle: the longest side must be shorter than the other two added together.");
        const P0 = [0, 0], P1 = [a, 0], P2 = thirdPoint(P0, P1, c, b, -1);
        return { ok: true, area: heron(a, b, c), approx: false, method: "Exact — three-side (Heron's) formula", pts: [P0, P1, P2], edges: seqEdges(3, ["a", "b", "c"]) };
      }
      case "trapezoid": {
        if (!need(["front", "back", "left", "right"])) return fail("Enter the front, back, left and right sides.");
        const a = v.front, b = v.back, c = v.left, d = v.right, hIn = ok(v.height) ? v.height : NaN;
        let p, h;
        if (!relClose(a, b)) {
          p = (d * d - c * c - (b - a) * (b - a)) / (2 * (b - a));
          const h2 = c * c - p * p;
          if (!(h2 > 0)) {
            if (!ok(hIn)) return fail("These four sides cannot form a trapezoid with parallel front and back sides. Check the measurements or add the perpendicular depth.");
            h = hIn; p = (a - b) / 2;
          } else h = Math.sqrt(h2);
          if (ok(hIn)) {
            if (Math.abs(hIn - h) > h * 0.02) {
              // Depth was measured directly; trust it for area and redraw sides from it.
              h = hIn;
              const cand = [Math.sqrt(Math.max(0, c * c - h * h)), -Math.sqrt(Math.max(0, c * c - h * h))];
              p = cand.reduce((best, x) => (Math.abs(Math.hypot(x + b - a, h) - d) < Math.abs(Math.hypot(best + b - a, h) - d) ? x : best), cand[0]);
            }
          }
        } else {
          if (!ok(hIn)) return fail("Front and back are equal, so the four sides alone do not fix the area. Enter the perpendicular depth.");
          h = hIn; p = Math.sqrt(Math.max(0, c * c - h * h));
        }
        const area = (a + b) / 2 * h;
        const method = ok(hIn) ? "Exact — (front + back) ÷ 2 × depth" : "Exact — depth worked out from the four sides";
        return { ok: true, area, approx: false, method, pts: [[0, 0], [a, 0], [p + b, -h], [p, -h]], edges: seqEdges(4, ["front", "right", "back", "left"]) };
      }
      case "lshape": {
        const ids = ["l1", "l2", "l3", "l4", "l5", "l6"];
        if (!need(ids)) return fail("Enter all six sides of the L-shaped plot.");
        const [a, b, c, d, e, f] = ids.map((k) => v[k]);
        if (!(c < a) || !relClose(a, c + e) || !relClose(f, b + d)) return fail("The sides do not close into an L shape. Side 1 must equal Side 3 + Side 5, and Side 6 must equal Side 2 + Side 4.");
        const pts = [[0, 0], [a, 0], [a, b], [a - c, b], [a - c, b + d], [0, b + d]];
        return { ok: true, area: shoelace(pts), approx: false, method: "Exact — split into rectangles", pts, edges: seqEdges(6, ids) };
      }
      case "tshape": {
        const ids = ["t1", "t2", "t3", "t4", "t5", "t6", "t7", "t8"];
        if (!need(ids)) return fail("Enter all eight sides of the T-shaped plot.");
        const [a, b, c, d, e, f, g, h] = ids.map((k) => v[k]);
        if (!relClose(a, c + e + g) || !relClose(b + d, f + h) || !(b + d - f > 0)) return fail("The sides do not close into a T shape. Side 1 must equal Sides 3 + 5 + 7, and Sides 2 + 4 must equal Sides 6 + 8.");
        const x5 = a - c - e, pts = [[0, 0], [a, 0], [a, b], [a - c, b], [a - c, b + d], [x5, b + d], [x5, b + d - f], [0, b + d - f]];
        return { ok: true, area: shoelace(pts), approx: false, method: "Exact — split into rectangles", pts, edges: seqEdges(8, ids) };
      }
      case "flag": {
        const ids = ["mainWidth", "mainDepth", "pathWidth", "pathLength"];
        if (!need(ids)) return fail("Enter the main plot width and depth, and the access path width and length.");
        const W = v.mainWidth, D = v.mainDepth, w = v.pathWidth, L = v.pathLength;
        if (!(w < W)) return fail("The access path must be narrower than the main plot.");
        const pts = [[0, 0], [W, 0], [W, D], [w, D], [w, D + L], [0, D + L]];
        return { ok: true, area: W * D + w * L, approx: false, method: "Exact — main plot + access path",
          pts, edges: [{ field: "mainWidth" }, { field: "mainDepth" }, { computed: W - w }, { field: "pathLength" }, { field: "pathWidth" }, { computed: D + L }] };
      }
      case "pentagon": case "polygon": case "irregular": {
        const n = shape === "pentagon" ? 5 : opts.count;
        if (!Number.isInteger(n) || n < 3 || n > 20) return fail("Choose between 3 and 20 boundary sides.");
        const sides = [];
        for (let i = 1; i <= n; i++) { if (!ok(v["side" + i])) return fail(`Enter a positive length for side ${i}.`); sides.push(v["side" + i]); }
        const total = sides.reduce((x, y) => x + y, 0);
        if (Math.max(...sides) >= total - Math.max(...sides)) return fail("These sides cannot close: the longest side must be shorter than all the other sides added together.");
        if (n === 3) {
          const [a, b, c] = sides, P0 = [0, 0], P1 = [a, 0], P2 = thirdPoint(P0, P1, c, b, -1);
          return { ok: true, area: heron(a, b, c), approx: false, method: "Exact — three-side (Heron's) formula", pts: [P0, P1, P2], edges: seqEdges(3) };
        }
        if (n === 4 && ok(v.diag)) {
          const [s1, s2, s3, s4] = sides, d = v.diag;
          if (!triangleOk(s1, s2, d) || !triangleOk(s3, s4, d)) return fail("The diagonal does not fit these sides. Check the diagonal runs from corner 1 to corner 3.");
          const P0 = [0, 0], P1 = [s1, 0], P2 = thirdPoint(P0, P1, d, s2, -1), P3 = thirdPoint(P0, P2, s4, s3, -1);
          const pts = [P0, P1, P2, P3];
          return { ok: true, area: heron(s1, s2, d) + heron(s3, s4, d), approx: false, method: "Exact — two triangles using the diagonal", pts, edges: seqEdges(4), diagonal: [0, 2] };
        }
        const pts = orientEdge0Bottom(cyclicPolygon(sides));
        return { ok: true, area: shoelace(pts), approx: true, method: "Approximate — angles not given; shows the largest area these sides can enclose", pts, edges: seqEdges(n) };
      }
      case "curved": {
        const ids = ["front", "right", "back", "left"], have = need(ids);
        let pts = null;
        if (have) {
          const sides = ids.map((k) => v[k]);
          if (Math.max(...sides) >= sides.reduce((x, y) => x + y, 0) - Math.max(...sides)) return fail("These boundary lengths cannot close. Check the measurements.");
          pts = orientEdge0Bottom(cyclicPolygon(sides));
        }
        if (ok(opts.surveyAreaSqFt)) {
          return { ok: true, area: opts.surveyAreaSqFt, approx: false, method: "From the entered survey area", pts, edges: seqEdges(4, ids), curved: 2 };
        }
        if (!have) return fail("Enter all four boundary lengths, or the area from your survey record.");
        return { ok: true, area: shoelace(pts), approx: true, method: "Approximate — curved boundary treated as a straight line; enter the survey area for an exact figure", pts, edges: seqEdges(4, ids), curved: 2 };
      }
      default: return fail("Choose a plot shape.");
    }
  }

  // Outline for drawing before a valid result exists: uses entered values where they fit, else sample proportions.
  function previewGeometry(shape, v, opts) {
    const real = computeGeometry(shape, v, opts);
    if (real.ok && real.pts) return real;
    const cfg = SHAPES[shape];
    if (cfg.sides) {
      const n = shape === "pentagon" ? 5 : opts.count;
      const pts = orientEdge0Bottom(regularPolygon(n, 30));
      return { pts, edges: seqEdges(n), preview: true };
    }
    const g = computeGeometry(shape, cfg.sample, {});
    return Object.assign({}, g, { preview: true, ok: false, curved: shape === "curved" ? 2 : undefined });
  }

  const api = { SHAPES, computeGeometry, previewGeometry, cyclicPolygon, shoelace, heron, FT_PER_M, SQFT_PER_CENT, SQFT_PER_ACRE, SQFT_PER_SQYD, SQM_PER_SQFT };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.AvxPlotGeometry = api;

  /* ======================================================================
   * DOM wiring — calculator page only
   * ==================================================================== */
  if (typeof document === "undefined" || !document.getElementById("shape-grid")) return;

  const $ = (id) => document.getElementById(id);
  const INK = "#101512", GREEN = "#198754", GREEN_DARK = "#11663e", FILL = "#eaf5ed", MUTED = "#5b675f";
  const FIELD_KEYS = {
    "Side length": "plot.label.side",
    "Front / back length": "plot.label.frontBack",
    "Depth (left / right side)": "plot.label.depthSides",
    "Side 1 — Front (base)": "plot.label.side1FrontBase",
    "Side 2 — Right side": "plot.label.side2Right",
    "Side 3 — Left side": "plot.label.side3Left",
    "Front side (parallel)": "plot.label.frontParallel",
    "Back side (parallel)": "plot.label.backParallel",
    "Left side": "plot.label.left",
    "Right side": "plot.label.right",
    "Perpendicular depth (optional)": "plot.label.depthOptional",
    "Side 1 — Top": "plot.label.lTop",
    "Side 2 — Right (upper)": "plot.label.lRightUpper",
    "Side 3 — Inner step": "plot.label.lInnerStep",
    "Side 4 — Inner side": "plot.label.lInnerSide",
    "Side 5 — Bottom": "plot.label.lBottom",
    "Side 6 — Left": "plot.label.lLeft",
    "Side 1 — Top (full width)": "plot.label.tTop",
    "Side 2 — Right end": "plot.label.tRightEnd",
    "Side 3 — Right inner step": "plot.label.tRightStep",
    "Side 4 — Stem right side": "plot.label.tStemRight",
    "Side 5 — Stem bottom": "plot.label.tStemBottom",
    "Side 6 — Stem left side": "plot.label.tStemLeft",
    "Side 7 — Left inner step": "plot.label.tLeftStep",
    "Side 8 — Left end": "plot.label.tLeftEnd",
    "Main plot width": "plot.label.mainWidth",
    "Main plot depth": "plot.label.mainDepth",
    "Access path width": "plot.label.pathWidth",
    "Access path length": "plot.label.pathLength",
    "Front (road side)": "plot.label.frontRoad",
    "Back boundary (curved, measured along the curve)": "plot.label.backCurve"
  };
  const MESSAGE_KEYS = {
    "Enter valid positive measurements to calculate the area.": "plot.validation",
    "Measurements changed — press Calculate Plot Area to update the result.": "plot.label.measurementsChanged",
    "The area could not be calculated. Check the measurements.": "plot.message.areaCouldNotCalculate",
    "Area calculated. Open View Drawing to review, print, share or download it.": "plot.message.areaCalculated",
    "Approximate area calculated — see the note below the result. Open View Drawing to review it.": "plot.message.approximateCalculated",
    "Measurements cleared.": "plot.message.measurementsCleared",
    "Enter a side length greater than zero.": "plot.error.side",
    "Enter the front length and the depth as positive numbers.": "plot.error.rectangle",
    "Enter all three sides as positive numbers.": "plot.error.triangle",
    "These lengths cannot form a triangle: the longest side must be shorter than the other two added together.": "plot.error.triangleImpossible",
    "Enter the front, back, left and right sides.": "plot.error.trapezoid",
    "These four sides cannot form a trapezoid with parallel front and back sides. Check the measurements or add the perpendicular depth.": "plot.error.trapezoidImpossible",
    "Front and back are equal, so the four sides alone do not fix the area. Enter the perpendicular depth.": "plot.error.trapezoidDepth",
    "Enter all six sides of the L-shaped plot.": "plot.error.lshape",
    "The sides do not close into an L shape. Side 1 must equal Side 3 + Side 5, and Side 6 must equal Side 2 + Side 4.": "plot.error.lshapeClosure",
    "Enter all eight sides of the T-shaped plot.": "plot.error.tshape",
    "The sides do not close into a T shape. Side 1 must equal Sides 3 + 5 + 7, and Sides 2 + 4 must equal Sides 6 + 8.": "plot.error.tshapeClosure",
    "Enter the main plot width and depth, and the access path width and length.": "plot.error.flag",
    "The access path must be narrower than the main plot.": "plot.error.flagPath",
    "Choose between 3 and 20 boundary sides.": "plot.error.sideCount",
    "These sides cannot close: the longest side must be shorter than all the other sides added together.": "plot.error.polygonClosure",
    "The diagonal does not fit these sides. Check the diagonal runs from corner 1 to corner 3.": "plot.error.diagonal",
    "These boundary lengths cannot close. Check the measurements.": "plot.error.curvedClosure",
    "Enter all four boundary lengths, or the area from your survey record.": "plot.error.curvedInput"
  };
  const METHOD_KEYS = {
    "Exact — side × side": "plot.method.square",
    "Exact — length × depth": "plot.method.rectangle",
    "Exact — three-side (Heron's) formula": "plot.method.heron",
    "Exact — split into rectangles": "plot.method.split",
    "Exact — main plot + access path": "plot.method.flag",
    "Exact — two triangles using the diagonal": "plot.method.diagonal",
    "Approximate — angles not given; shows the largest area these sides can enclose": "plot.method.approximatePolygon",
    "From the entered survey area": "plot.method.survey",
    "Approximate — curved boundary treated as a straight line; enter the survey area for an exact figure": "plot.method.approximateCurved",
    "Exact — (front + back) ÷ 2 × depth": "plot.method.trapezoidDepth",
    "Exact — depth worked out from the four sides": "plot.method.trapezoidSides"
  };
  const SHAPE_KEYS = {
    square: "plot.shape.square", rectangle: "plot.shape.rectangle", triangle: "plot.shape.triangle",
    trapezoid: "plot.shape.trapezoid", lshape: "plot.shape.lshape", tshape: "plot.shape.tshape",
    flag: "plot.shape.flag", pentagon: "plot.shape.pentagon", polygon: "plot.shape.polygon",
    irregular: "plot.shape.irregular", curved: "plot.shape.curved", corner: "plot.shape.corner"
  };
  const uiText = (key, values) => {
    let value = window.avxI18n ? window.avxI18n.t(key) : key;
    Object.entries(values || {}).forEach(([name, item]) => { value = value.replace(new RegExp("\\{" + name + "\\}", "g"), String(item)); });
    return value;
  };
  let selectedShape = "square";
  let lastResult = null;
  let currentUnit = $("length-unit").value;

  const unitLabel = () => (currentUnit === "m" ? "m" : "ft");
  const toFt = (x) => (currentUnit === "m" ? x * FT_PER_M : x);
  const fromFt = (x) => (currentUnit === "m" ? x / FT_PER_M : x);
  const fmt = (n, d = 2) => (Number.isFinite(n) ? n.toLocaleString("en-IN", { maximumFractionDigits: d, minimumFractionDigits: 0 }) : "—");
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const effectiveShape = () => (selectedShape === "corner" ? $("corner-shape").value : selectedShape);
  const areaToSqFt = (x, u) => ({ sqft: x, sqm: x / SQM_PER_SQFT, cent: x * SQFT_PER_CENT, acre: x * SQFT_PER_ACRE, sqyd: x * SQFT_PER_SQYD })[u];

  function setMessage(text, type) {
    const el = $("validation-message");
    const numberedSide = /^Enter a positive length for side (\d+)\.$/.exec(text);
    el.textContent = MESSAGE_KEYS[text] ? uiText(MESSAGE_KEYS[text])
      : numberedSide ? uiText("plot.error.sideValue", { side: numberedSide[1] })
        : text;
    el.className = "avx-validation" + (type ? " is-" + type : "");
  }

  /* ---------- Form rendering ---------- */
  function inputMarkup(id, label, optional) {
    const key = FIELD_KEYS[label], numbered = /^Side (\d+)$/.exec(label);
    const labelText = key ? `<span data-i18n="${key}">${esc(label)}</span>` : numbered ? `<span data-i18n="plot.label.sideShort">Side</span> ${numbered[1]}` : `<span data-i18n="plot.label.sideShort">Side</span>`;
    return `<div class="avx-field"><label for="${id}">${labelText} <span class="avx-field-unit">(${unitLabel()})</span></label><input id="${id}" name="${id}" type="number" min="0" step="any" inputmode="decimal" placeholder="${optional ? "Optional" : "Enter measurement"}" data-i18n-placeholder="${optional ? "plot.optional" : "plot.enterMeasurement"}"></div>`;
  }
  function sidesMarkup(cfg, count) {
    let html = "";
    for (let i = 1; i <= count; i++) html += inputMarkup("side" + i, "Side " + i, false);
    if (!cfg.fixedCount) {
      html += `<div class="avx-field avx-full-span avx-count-row"><label for="point-count" data-i18n="plot.label.numberSides">Number of sides (3–20)</label><div class="avx-count-controls"><button type="button" class="avx-step-button" id="count-minus" aria-label="Remove a side" data-i18n-aria-label="plot.label.removeSide">−</button><input id="point-count" type="number" min="3" max="20" step="1" value="${count}"><button type="button" class="avx-step-button" id="count-plus" aria-label="Add a side" data-i18n-aria-label="plot.label.addSide">+</button></div></div>`;
    }
    if (cfg.diagonal) {
      html += `<div class="avx-field avx-full-span${count === 4 ? "" : " is-hidden"}" id="diag-field"><label for="diag"><span data-i18n="plot.label.diagonalOptional">Diagonal, corner 1 to corner 3 ({unit}) — optional, makes the area exact</span></label><input id="diag" name="diag" type="number" min="0" step="any" inputmode="decimal" placeholder="Optional" data-i18n-placeholder="plot.optional"></div>`;
    }
    html += `<p class="avx-approx-note avx-full-span" id="approx-note">Side lengths alone do not fix the shape of a plot with ${count === 3 ? "three" : "four or more"} sides${count === 3 ? " — a triangle is the exception, so this result is exact" : ""}.${count === 3 ? "" : " Without the corner angles, the area shown is an <strong>approximate</strong> estimate (the largest area these sides can enclose). The real plot may be smaller — confirm with a survey."}</p>`;
    return html;
  }
  function sideCount() {
    const cfg = SHAPES[effectiveShape()];
    if (!cfg.sides) return 0;
    if (cfg.fixedCount) return cfg.sides;
    const n = Math.round(Number($("point-count")?.value));
    return Number.isInteger(n) && n >= 3 && n <= 20 ? n : cfg.sides;
  }

  function renderFields(keep) {
    const shape = effectiveShape(), cfg = SHAPES[shape];
    $("measure-heading").textContent = selectedShape === "corner" ? uiText("plot.measurements.corner") : uiText("plot.measurements") + " — " + uiText(SHAPE_KEYS[shape]);
    $("shape-help").textContent = selectedShape === "corner"
      ? uiText("plot.help.corner") + " " + uiText("plot.help." + shape)
      : uiText("plot.help." + shape);
    $("corner-underlying").classList.toggle("is-hidden", selectedShape !== "corner");
    let html;
    if (cfg.sides) html = sidesMarkup(cfg, keep && keep.count ? keep.count : cfg.sides);
    else html = cfg.fields.map((f) => inputMarkup(f.id, f.label, f.optional)).join("");
    if (cfg.survey) {
      html += `<div class="avx-field avx-full-span avx-survey-field"><label for="surveyArea">Area from survey record (optional)</label><div class="avx-inline-unit"><input id="surveyArea" name="surveyArea" type="number" min="0" step="any" inputmode="decimal" placeholder="Optional"><select id="area-unit" aria-label="Survey area unit"><option value="sqft">sq ft</option><option value="sqm">sq m</option><option value="cent">cents</option><option value="acre">acres</option><option value="sqyd">sq yd</option></select></div></div>`;
    }
    $("dimension-fields").innerHTML = html;
    $("road-width-label").setAttribute("data-i18n", selectedShape === "corner" ? "plot.roadWidthCorner" : "plot.roadWidth");
    $("road-width-label").textContent = uiText(selectedShape === "corner" ? "plot.roadWidthCorner" : "plot.roadWidth");
    if (cfg.survey) {
      const surveyLabel = $("dimension-fields").querySelector('label[for="surveyArea"]');
      const surveyUnit = $("dimension-fields").querySelector("#area-unit");
      if (surveyLabel) surveyLabel.setAttribute("data-i18n", "plot.label.surveyArea");
      if (surveyUnit) surveyUnit.setAttribute("aria-label", uiText("plot.label.surveyAreaUnit"));
    }
    if (window.avxI18n) {
      window.avxI18n.translate($("dimension-fields"));
      const diagonalLabel = $("dimension-fields").querySelector('[data-i18n="plot.label.diagonalOptional"]');
      if (diagonalLabel) diagonalLabel.textContent = uiText("plot.label.diagonalOptional").replace("{unit}", unitLabel());
    }
    $("road-width-unit").textContent = unitLabel();
    if (keep && keep.values) Object.entries(keep.values).forEach(([id, val]) => { const el = $(id); if (el) el.value = val; });
    clearResult();
    setMessage("Enter valid positive measurements to calculate the area.");
    drawLive();
  }

  function collectValues() {
    const v = {};
    $("dimension-fields").querySelectorAll("input[type=number]").forEach((el) => {
      if (el.id === "point-count" || el.id === "surveyArea") return;
      v[el.id] = el.value.trim() === "" ? NaN : toFt(Number(el.value));
    });
    return v;
  }
  function geometryOpts() {
    const o = { count: sideCount() };
    const sa = $("surveyArea");
    if (sa && sa.value.trim() !== "") o.surveyAreaSqFt = areaToSqFt(Number(sa.value), $("area-unit").value);
    return o;
  }

  /* ---------- Drawing ---------- */
  function pointInPolygon(x, y, pts) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  function segDist(px, py, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / L));
    return Math.hypot(px - a[0] - t * dx, py - a[1] - t * dy);
  }
  // Distance from (x,y) to the boundary along a ray (dx,dy).
  function rayClear(x, y, dx, dy, pts) {
    let best = Infinity;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length], ex = b[0] - a[0], ey = b[1] - a[1];
      const den = dx * ey - dy * ex; if (Math.abs(den) < 1e-12) continue;
      const t = ((a[0] - x) * ey - (a[1] - y) * ex) / den, u = ((a[0] - x) * dy - (a[1] - y) * dx) / den;
      if (t > 1e-9 && u >= 0 && u <= 1) best = Math.min(best, t);
    }
    return best;
  }
  // Interior point with the most room for a text block of size tw × th.
  function innerLabelPoint(pts, tw, th) {
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    let best = [(minX + maxX) / 2, (minY + maxY) / 2], bestS = -Infinity;
    for (let i = 1; i < 30; i++) for (let j = 1; j < 30; j++) {
      const x = minX + ((maxX - minX) * i) / 30, y = minY + ((maxY - minY) * j) / 30;
      if (!pointInPolygon(x, y, pts)) continue;
      const fits = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]].every(([a, b]) => pointInPolygon(x + a * tw / 2, y + b * th / 2, pts));
      if (fits) {
        let d = Infinity;
        for (let k = 0; k < pts.length; k++) d = Math.min(d, segDist(x, y, pts[k], pts[(k + 1) % pts.length]));
        const sc = 1000 + d - Math.hypot(x - (minX + maxX) / 2, y - (minY + maxY) / 2) * 0.05;
        if (sc > bestS) { bestS = sc; best = [x, y]; }
        continue;
      }
      const h = Math.min(rayClear(x, y, 1, 0, pts), rayClear(x, y, -1, 0, pts));
      const v = Math.min(rayClear(x, y, 0, 1, pts), rayClear(x, y, 0, -1, pts));
      const sc = Math.min(h / (tw / 2), v / (th / 2)) - Math.hypot(x - (minX + maxX) / 2, y - (minY + maxY) / 2) / (maxX - minX + maxY - minY) * 0.2;
      if (sc > bestS) { bestS = sc; best = [x, y]; }
    }
    return best;
  }
  function edgeLabelText(edge, i, interactive) {
    if (edge.computed !== undefined) return { text: `${fmt(fromFt(edge.computed))} ${unitLabel()}`, focus: null };
    const el = $(edge.field);
    const cfg = SHAPES[effectiveShape()];
    const fdef = cfg.fields && cfg.fields.find((f) => f.id === edge.field);
    const name = fdef ? (/^\d+$/.test(fdef.short) ? "Side " + fdef.short : fdef.short) : "Side " + (i + 1);
    const filled = el && el.value.trim() !== "" && Number(el.value) > 0;
    const numbered = cfg.sides || /^\d+$/.test(fdef?.short || "");
    const prefix = numbered ? (cfg.sides ? `${i + 1}: ` : `${fdef.short}: `) : "";
    return { text: filled ? `${prefix}${fmt(Number(el.value), 3)} ${unitLabel()}` : name, focus: interactive ? edge.field : null, placeholder: !filled };
  }

  /* Builds plot SVG content sized W×H. Returns inner markup (no outer <svg>). */
  function plotMarkup(g, W, H, opts) {
    const font = opts.font, roadW = opts.roadWidth, corner = opts.corner;
    const pts = g.pts, n = pts.length;
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const showRoad = ok(roadW);
    const band = showRoad ? font * 2.3 : 0;
    const margin = font * 5.2;
    const gapB = font * 1.9, gapR = font * 5;
    const availW = W - 2 * margin - (corner && showRoad ? band + gapR - margin * 0.6 : 0);
    const availH = H - 2 * margin - (showRoad ? band + gapB - margin * 0.5 : 0);
    const k = Math.min(availW / Math.max(1e-9, maxX - minX), availH / Math.max(1e-9, maxY - minY));
    const offX = margin + (availW - (maxX - minX) * k) / 2, offY = margin + (availH - (maxY - minY) * k) / 2;
    const P = pts.map(([x, y]) => [offX + (x - minX) * k, offY + (y - minY) * k]);
    const r = (x) => Math.round(x * 10) / 10;
    let out = "";

    if (showRoad) {
      const left = P.reduce((m, p) => Math.min(m, p[0]), Infinity), right = P.reduce((m, p) => Math.max(m, p[0]), -Infinity);
      const bottom = P.reduce((m, p) => Math.max(m, p[1]), -Infinity), top = P.reduce((m, p) => Math.min(m, p[1]), Infinity);
      const gap = gapB, roadTxt = `ROAD · ${fmt(fromFt(roadW))} ${unitLabel()} wide`;
      const ext = corner ? band + gapR : 0;
      out += `<rect x="${r(left - font)}" y="${r(bottom + gap)}" width="${r(right - left + 2 * font + ext)}" height="${r(band)}" fill="#e9ece9" stroke="#9aa59d" stroke-width="1" stroke-dasharray="6 4"/>`;
      out += `<text x="${r((left + right) / 2)}" y="${r(bottom + gap + band * 0.64)}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${r(font * 0.85)}" font-weight="700" letter-spacing="1" fill="${MUTED}">${esc(roadTxt)}</text>`;
      if (corner) {
        out += `<rect x="${r(right + gapR)}" y="${r(top - font)}" width="${r(band)}" height="${r(bottom - top + font + gap + band)}" fill="#e9ece9" stroke="#9aa59d" stroke-width="1" stroke-dasharray="6 4"/>`;
        const cx = right + gapR + band * 0.64, cy = (top + bottom) / 2;
        out += `<text x="${r(cx)}" y="${r(cy)}" transform="rotate(-90 ${r(cx)} ${r(cy)})" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${r(font * 0.85)}" font-weight="700" letter-spacing="1" fill="${MUTED}">ROAD</text>`;
      }
    }

    // Outline (with optional curved edge)
    const fill = g.preview ? "#f3f7f4" : FILL, dash = g.preview ? ` stroke-dasharray="8 6"` : "";
    let d = `M${r(P[0][0])} ${r(P[0][1])}`;
    for (let i = 0; i < n; i++) {
      const a = P[i], b = P[(i + 1) % n];
      if (g.curved === i) {
        const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        let nx = (b[1] - a[1]) / len, ny = -(b[0] - a[0]) / len;
        if (pointInPolygon(mx + nx * 2, my + ny * 2, P)) { nx = -nx; ny = -ny; }
        d += ` Q${r(mx + nx * len * 0.36)} ${r(my + ny * len * 0.36)} ${r(b[0])} ${r(b[1])}`;
      } else d += ` L${r(b[0])} ${r(b[1])}`;
    }
    out += `<path d="${d} Z" fill="${fill}" stroke="${GREEN}" stroke-width="${r(font * 0.2)}" stroke-linejoin="round"${dash}/>`;
    if (g.diagonal) {
      const [i, j] = g.diagonal;
      out += `<line x1="${r(P[i][0])}" y1="${r(P[i][1])}" x2="${r(P[j][0])}" y2="${r(P[j][1])}" stroke="${GREEN}" stroke-width="1.4" stroke-dasharray="5 4"/>`;
    }
    P.forEach((p, i) => {
      out += `<circle cx="${r(p[0])}" cy="${r(p[1])}" r="${r(font * 0.22)}" fill="${INK}"/>`;
      if (opts.cornerNumbers) {
        const c = [P.reduce((t, q) => t + q[0], 0) / n, P.reduce((t, q) => t + q[1], 0) / n];
        const dx = p[0] - c[0], dy = p[1] - c[1], L = Math.hypot(dx, dy) || 1;
        out += `<text x="${r(p[0] + (dx / L) * font * 0.9)}" y="${r(p[1] + (dy / L) * font * 0.9 + font * 0.32)}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${r(font * 0.66)}" fill="${MUTED}">C${i + 1}</text>`;
      }
    });

    // Edge labels — placed outside the boundary, horizontal text for readability
    g.edges.forEach((edge, i) => {
      const a = P[i], b = P[(i + 1) % n];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      let nx = (b[1] - a[1]) / len, ny = -(b[0] - a[0]) / len;
      const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
      if (pointInPolygon(mx + nx * 3, my + ny * 3, P)) { nx = -nx; ny = -ny; }
      let off = font * 0.9;
      if (g.curved === i) off += len * 0.18;
      const lab = edgeLabelText(edge, i, opts.interactive);
      const anchor = Math.abs(nx) > 0.75 ? (nx > 0 ? "start" : "end") : "middle";
      const lx = mx + nx * off, ly = my + ny * off + font * 0.35 + (Math.abs(nx) <= 0.75 && ny < 0 ? -font * 0.1 : 0);
      const fillC = lab.placeholder ? MUTED : edge.computed !== undefined ? MUTED : GREEN_DARK;
      const attrs = lab.focus ? ` class="avx-dim-label" tabindex="0" role="button" data-focus="${lab.focus}" aria-label="Edit ${esc(lab.text)}"` : "";
      out += `<text${attrs} x="${r(lx)}" y="${r(ly)}" text-anchor="${anchor}" font-family="Arial, Helvetica, sans-serif" font-size="${r(font)}" font-weight="700" fill="${fillC}" stroke="#ffffff" stroke-width="${r(font * 0.3)}" stroke-linejoin="round" paint-order="stroke">${esc(lab.text)}</text>`;
    });

    if (opts.areaText) {
      const tw = opts.areaText.length * font * 0.62, th = font * (opts.areaSub ? 2.6 : 1.5);
      const c = innerLabelPoint(P, tw, th);
      out += `<text x="${r(c[0])}" y="${r(c[1] + font * 0.4)}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${r(font * 1.08)}" font-weight="800" fill="${INK}" stroke="${FILL}" stroke-width="${r(font * 0.3)}" paint-order="stroke">${esc(opts.areaText)}</text>`;
      if (opts.areaSub) out += `<text x="${r(c[0])}" y="${r(c[1] + font * 1.55)}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${r(font * 0.72)}" fill="${MUTED}" stroke="${FILL}" stroke-width="${r(font * 0.25)}" paint-order="stroke">${esc(opts.areaSub)}</text>`;
    }
    return out;
  }

  function currentGeometry() {
    const shape = effectiveShape();
    return previewGeometry(shape, collectValues(), geometryOpts());
  }
  function roadWidthFt() { const el = $("road-width"); return el && el.value.trim() !== "" ? toFt(Number(el.value)) : NaN; }

  function drawLive() {
    const g = currentGeometry();
    const narrow = ($("plot-drawing").clientWidth || 640) < 520;
    const W = narrow ? 420 : 640, H = narrow ? 380 : 420;
    const areaText = lastResult ? `${lastResult.approx ? "≈ " : ""}${fmt(lastResult.area)} sq ft` : "";
    const inner = plotMarkup(g, W, H, { font: narrow ? 15 : 16, interactive: true, roadWidth: roadWidthFt(), corner: selectedShape === "corner", areaText, areaSub: lastResult && lastResult.approx ? "approximate" : "", cornerNumbers: !!(SHAPES[effectiveShape()].sides && SHAPES[effectiveShape()].diagonal) });
    const title = uiText(SHAPE_KEYS[effectiveShape()]);
    $("plot-drawing").innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)} drawing"><rect width="${W}" height="${H}" fill="#ffffff"/>${inner}</svg>`;
    $("drawing-note").textContent = g.preview ? uiText("plot.drawing.previewHint") : uiText("plot.drawing.liveHint");
  }

  /* ---------- Calculate / result ---------- */
  function clearResult() {
    lastResult = null;
    $("view-drawing").disabled = true;
    $("area-main").innerHTML = `— <small>${esc(uiText("plot.unit.squareFeet"))}</small>`;
    $("area-method").textContent = "";
    $("area-method").classList.remove("is-approx");
    ["sqft", "cent", "acre", "sqm", "sqyd"].forEach((u) => ($("out-" + u).textContent = "—"));
  }
  function calculate() {
    const shape = effectiveShape();
    const g = computeGeometry(shape, collectValues(), geometryOpts());
    if (!g.ok || !(g.area > 0)) { clearResult(); drawLive(); setMessage(g.error || "The area could not be calculated. Check the measurements.", "error"); return; }
    lastResult = { area: g.area, approx: g.approx, method: g.method, shape };
    const a = g.area, pre = g.approx ? "≈ " : "";
    $("area-main").innerHTML = `${pre}${fmt(a)} <small>${esc(uiText("plot.unit.squareFeet"))}</small>`;
    $("area-method").textContent = METHOD_KEYS[g.method] ? uiText(METHOD_KEYS[g.method]) : g.method;
    $("area-method").classList.toggle("is-approx", !!g.approx);
    $("out-sqft").textContent = pre + fmt(a) + " " + uiText("plot.unit.squareFeet");
    $("out-cent").textContent = pre + fmt(a / SQFT_PER_CENT, 4) + " " + uiText("plot.unit.cents");
    $("out-acre").textContent = pre + fmt(a / SQFT_PER_ACRE, 6) + " " + uiText("plot.unit.acres");
    $("out-sqm").textContent = pre + fmt(a * SQM_PER_SQFT) + " m²";
    $("out-sqyd").textContent = pre + fmt(a / SQFT_PER_SQYD) + " yd²";
    $("view-drawing").disabled = false;
    drawLive();
    setMessage(g.approx ? "Approximate area calculated — see the note below the result. Open View Drawing to review it." : "Area calculated. Open View Drawing to review, print, share or download it.", g.approx ? "warning" : "success");
  }

  /* ---------- A4 survey-style sheet ---------- */
  function measurementRows() {
    const rows = [];
    $("dimension-fields").querySelectorAll("input[type=number]").forEach((el) => {
      if (el.id === "point-count" || el.value.trim() === "") return;
      const label = ($("dimension-fields").querySelector(`label[for="${el.id}"]`)?.textContent || el.id).replace(/\s*\((ft|m)\)\s*$/, "").replace(/\s+/g, " ").replace(/ — optional.*$/, "").trim();
      if (el.id === "surveyArea") rows.push(["Survey area", `${fmt(Number(el.value), 4)} ${$("area-unit").selectedOptions[0].textContent}`]);
      else rows.push([label.replace(/^Diagonal, corner 1 to corner 3.*/, "Diagonal (C1–C3)"), `${fmt(Number(el.value), 3)} ${unitLabel()}`]);
    });
    if (ok(roadWidthFt())) rows.push(["Road width", `${fmt(Number($("road-width").value), 3)} ${unitLabel()}`]);
    return rows;
  }
  function buildA4Sheet() {
    if (!lastResult) return "";
    const g = currentGeometry();
    const title = uiText(SHAPE_KEYS[effectiveShape()]) + (selectedShape === "corner" ? " (" + uiText(SHAPE_KEYS.corner) + ")" : "");
    const a = lastResult.area, pre = lastResult.approx ? "≈ " : "";
    const now = new Date();
    const date = now.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    const ref = `AVX-PLT-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getTime()).slice(-4)}`;
    const areaRows = [["Square feet", `${pre}${fmt(a)} sq ft`], ["Cents", `${pre}${fmt(a / SQFT_PER_CENT, 4)} cents`], ["Acres", `${pre}${fmt(a / SQFT_PER_ACRE, 6)} acres`], ["Square metres", `${pre}${fmt(a * SQM_PER_SQFT)} sq m`], ["Square yards", `${pre}${fmt(a / SQFT_PER_SQYD)} sq yd`]];
    const dims = measurementRows();
    const F = "Arial, Helvetica, sans-serif";
    const rowsSvg = (arr, x, y, w, h, fs, bold) => arr.map((rw, i) => `<rect x="${x}" y="${y + i * h}" width="${w}" height="${h}" fill="${i % 2 ? "#ffffff" : "#f6faf7"}" stroke="#cbd5ce" stroke-width="0.6"/><text x="${x + 7}" y="${y + i * h + h * 0.66}" font-family="${F}" font-size="${fs}" fill="#17231b">${esc(rw[0])}</text><text x="${x + w - 7}" y="${y + i * h + h * 0.66}" text-anchor="end" font-family="${F}" font-size="${fs}" font-weight="${bold ? 700 : 400}" fill="#17231b">${esc(rw[1])}</text>`).join("");
    const DW = 720, DH = 430;
    const diag = plotMarkup(g, DW, DH, { font: 17, interactive: false, roadWidth: roadWidthFt(), corner: selectedShape === "corner", areaText: `${pre}${fmt(a)} sq ft`, areaSub: `${pre}${fmt(a / SQFT_PER_CENT, 3)} cents`, cornerNumbers: !!g.diagonal || !!(SHAPES[effectiveShape()].diagonal) });
    const scaleNote = ok(roadWidthFt()) ? "Plot fitted proportionally. Road width is indicative, not to scale." : "Plot fitted proportionally to the drawing area."; 
    const split = Math.ceil(dims.length / 2), leftDims = dims.slice(0, split), rightDims = dims.slice(split);
    const leftX = 28, leftW = 360, rightX = 406, rightW = 360, rowH = dims.length > 12 ? 17 : 21, rowFs = dims.length > 12 ? 8.5 : 10;
    let y = 690;
    let panel = `<rect x="${leftX}" y="${y}" width="${leftW}" height="25" fill="#e7f4e9" stroke="#cbd5ce"/><text x="${leftX+8}" y="${y+17}" font-family="${F}" font-size="11" font-weight="700" fill="#14532d">ENTERED MEASUREMENTS</text><rect x="${rightX}" y="${y}" width="${rightW}" height="25" fill="#e7f4e9" stroke="#cbd5ce"/><text x="${rightX+8}" y="${y+17}" font-family="${F}" font-size="11" font-weight="700" fill="#14532d">${lastResult.approx ? "APPROXIMATE AREA" : "CALCULATED AREA"}</text>`;
    y += 25;
    panel += rowsSvg(leftDims, leftX, y, leftW, rowH, rowFs, false) + rowsSvg(rightDims, rightX, y, rightW, rowH, rowFs, false);
    y += Math.max(leftDims.length, rightDims.length) * rowH + 10;
    panel += rowsSvg(areaRows, rightX, y, rightW, 21, 10, true);
    y += areaRows.length * 21 + 8;
    panel += `<text x="${rightX}" y="${y+10}" font-family="${F}" font-size="9.5" font-weight="700" fill="${lastResult.approx ? "#8a4b00" : "#14532d"}">Method: ${esc(lastResult.method)}</text>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="794" height="1123" viewBox="0 0 794 1123" role="img" aria-label="Aventrix Realty A4 portrait plot measurement drawing">
<rect width="794" height="1123" fill="#fff"/><rect x="8" y="8" width="778" height="1107" fill="none" stroke="#18211c" stroke-width="1.5"/>
<line x1="8" y1="112" x2="786" y2="112" stroke="#18211c"/>
<text x="30" y="47" font-family="Georgia, Times New Roman, serif" font-size="27" letter-spacing="2" fill="#101512">AVENTRIX</text><text x="32" y="71" font-family="Georgia, Times New Roman, serif" font-size="13" letter-spacing="6" fill="${GREEN}">REALTY</text><text x="30" y="94" font-family="${F}" font-size="10" fill="#39443c">aventrixrealty.com</text>
<text x="420" y="40" text-anchor="middle" font-family="${F}" font-size="16" font-weight="700" fill="#101512">PLOT MEASUREMENT DRAWING</text><text x="420" y="64" text-anchor="middle" font-family="${F}" font-size="12" fill="#101512">${esc(title)}</text><text x="420" y="86" text-anchor="middle" font-family="${F}" font-size="9.5" fill="#39443c">Ref: ${esc(ref)} · ${esc(date)} · Unit: ${unitLabel()}</text>
<rect x="24" y="126" width="746" height="492" fill="#fff" stroke="#cbd5ce"/><svg x="37" y="150" width="${DW}" height="${DH}" viewBox="0 0 ${DW} ${DH}" preserveAspectRatio="xMidYMid meet">${diag}</svg><text x="32" y="605" font-family="${F}" font-size="9.5" fill="#4b574e">${esc(scaleNote)}</text>
${panel}
<line x1="8" y1="1025" x2="786" y2="1025" stroke="#18211c"/><text x="28" y="1054" font-family="Georgia, Times New Roman, serif" font-size="16" letter-spacing="1" fill="#101512">AVENTRIX REALTY</text><text x="28" y="1076" font-family="${F}" font-size="10" fill="#39443c">Plot area estimate for reference</text><text x="28" y="1098" font-family="${F}" font-size="9.5" fill="#39443c">Illustrative estimate only — not an official survey plan. Verify with official survey records.</text></svg>`;
  }
  function wrap(text, max) {
    const words = String(text).split(" "), lines = [];
    let cur = "";
    words.forEach((w) => { if ((cur + " " + w).trim().length > max) { lines.push(cur.trim()); cur = w; } else cur += " " + w; });
    if (cur.trim()) lines.push(cur.trim());
    return lines;
  }

  /* ---------- Exports ---------- */
  function fileBase() { return "aventrix-plot-" + effectiveShape() + "-" + new Date().toISOString().slice(0, 10); }
  function downloadBlob(blob, name) {
    const url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url; a.download = name; a.rel = "noopener"; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
  function svgToPng(svgText) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas"); canvas.width = 1588; canvas.height = 2246;
          const ctx = canvas.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG encoding failed"))), "image/png");
        } catch (e) { reject(e); }
      };
      img.onerror = () => reject(new Error("SVG could not be rendered"));
      img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgText);
    });
  }
  function previewStatus(text, type) { const el = $("preview-status"); el.textContent = text; el.className = "avx-preview-status" + (type ? " is-" + type : ""); }
  function requireResult() { if (!lastResult) { setMessage("Calculate the plot area first.", "error"); return false; } return true; }

  function exportSvg() { if (!requireResult()) return; downloadBlob(new Blob([buildA4Sheet()], { type: "image/svg+xml;charset=utf-8" }), fileBase() + ".svg"); previewStatus("SVG downloaded.", "success"); }
  async function exportPng() {
    if (!requireResult()) return;
    previewStatus("Preparing PNG…");
    try { downloadBlob(await svgToPng(buildA4Sheet()), fileBase() + ".png"); previewStatus("PNG downloaded.", "success"); }
    catch (e) { previewStatus("Could not create the PNG in this browser. Please use Download SVG.", "error"); }
  }
  function printSheet() {
    if (!requireResult()) return;
    const svg = buildA4Sheet();
    const win = window.open("", "_blank");
    if (!win) { previewStatus("Pop-up blocked — printing from this page instead. Choose “Save as PDF” as the printer.", "warning"); window.print(); return; }
    win.document.open();
    win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(fileBase())}</title><style>@page{size:A4 portrait;margin:5mm}html,body{margin:0;padding:0;background:#fff}svg{display:block;width:100%;height:auto;max-height:287mm}</style></head><body>${svg}<script>window.addEventListener("load",function(){setTimeout(function(){window.focus();window.print();},250);});<\/script></body></html>`);
    win.document.close();
    previewStatus("Print dialog opened in a new tab. Choose “Save as PDF” to save a PDF.", "success");
  }
  async function shareSheet() {
    if (!requireResult()) return;
    const a = lastResult.area, pre = lastResult.approx ? "approx. " : "";
    const text = uiText("plot.share.summary", {
      shape: uiText(SHAPE_KEYS[effectiveShape()]),
      area: pre + fmt(a),
      cents: fmt(a / SQFT_PER_CENT, 4)
    });
    const url = location.origin + location.pathname;
    try {
      if (navigator.share) {
        try {
          const png = await svgToPng(buildA4Sheet());
          const file = new File([png], fileBase() + ".png", { type: "image/png" });
          if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: "Plot Measurement Drawing", text: text + " " + url }); previewStatus("Shared.", "success"); return; }
        } catch (e) { if (e && e.name === "AbortError") return; }
        await navigator.share({ title: "Aventrix Realty Plot Area Calculator", text, url });
        previewStatus("Shared.", "success"); return;
      }
      if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text + " " + url); previewStatus("Share text and link copied — paste it into WhatsApp, email or a message.", "success"); return; }
      window.prompt("Copy this text to share", text + " " + url);
    } catch (e) {
      if (e && e.name === "AbortError") return;
      previewStatus("Sharing is not available in this browser. Use Download PNG and share the image.", "error");
    }
  }

  /* ---------- Preview modal ---------- */
  let lastFocus = null;
  function openPreview() {
    if (!requireResult()) return;
    lastFocus = document.activeElement;
    $("preview-drawing").innerHTML = buildA4Sheet();
    const a = lastResult.area, pre = lastResult.approx ? "≈ " : "";
    $("preview-summary").textContent = uiText("plot.preview.summary", {
      shape: uiText(SHAPE_KEYS[effectiveShape()]),
      area: pre + fmt(a),
      cents: pre + fmt(a / SQFT_PER_CENT, 4)
    });
    previewStatus("");
    $("drawing-preview-modal").hidden = false;
    document.body.classList.add("avx-modal-open");
    $("close-preview").focus();
  }
  function closePreview() {
    $("drawing-preview-modal").hidden = true;
    document.body.classList.remove("avx-modal-open");
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  /* ---------- Large-area converter ---------- */
  function updateConverter() {
    const raw = $("converter-value").value.trim(), x = Number(raw);
    if (raw === "" || !Number.isFinite(x) || x < 0) { ["sqft", "acre", "cent", "sqm", "sqyd"].forEach((u) => ($("conv-" + u).textContent = "—")); return; }
    const sqft = areaToSqFt(x, $("converter-unit").value);
    $("conv-sqft").textContent = fmt(sqft) + " " + uiText("plot.unit.squareFeet");
    $("conv-acre").textContent = fmt(sqft / SQFT_PER_ACRE, 6) + " " + uiText("plot.unit.acres");
    $("conv-cent").textContent = fmt(sqft / SQFT_PER_CENT, 4) + " " + uiText("plot.unit.cents");
    $("conv-sqm").textContent = fmt(sqft * SQM_PER_SQFT) + " " + uiText("plot.unit.squareMetres");
    $("conv-sqyd").textContent = fmt(sqft / SQFT_PER_SQYD) + " " + uiText("plot.unit.squareYards");
  }

  /* ---------- Events ---------- */
  function setCount(n) {
    const cfg = SHAPES[effectiveShape()];
    n = Math.max(3, Math.min(20, Math.round(n) || cfg.sides));
    const values = {};
    $("dimension-fields").querySelectorAll("input[type=number]").forEach((el) => { if (el.id !== "point-count" && el.value !== "") values[el.id] = el.value; });
    const road = $("road-width").value;
    renderFields({ count: n, values });
    $("road-width").value = road;
    drawLive();
  }

  $("shape-grid").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-shape]"); if (!btn) return;
    selectedShape = btn.dataset.shape;
    document.querySelectorAll(".avx-shape-card").forEach((b) => { const on = b === btn; b.classList.toggle("is-active", on); b.setAttribute("aria-pressed", String(on)); });
    renderFields();
  });
  $("corner-shape").addEventListener("change", () => renderFields());

  $("length-unit").addEventListener("change", () => {
    const next = $("length-unit").value;
    if (next === currentUnit) return;
    const factor = currentUnit === "ft" && next === "m" ? 1 / FT_PER_M : FT_PER_M;
    const conv = (s) => String(Math.round(Number(s) * factor * 1000) / 1000);
    const values = {};
    $("dimension-fields").querySelectorAll("input[type=number]").forEach((el) => {
      if (el.value.trim() === "") return;
      values[el.id] = el.id === "point-count" || el.id === "surveyArea" ? el.value : conv(el.value);
    });
    const areaUnit = $("area-unit") ? $("area-unit").value : null;
    const road = $("road-width").value.trim();
    const hadResult = !!lastResult;
    currentUnit = next;
    renderFields({ count: sideCount(), values });
    if (areaUnit && $("area-unit")) $("area-unit").value = areaUnit;
    $("road-width").value = road ? conv(road) : "";
    if (hadResult) calculate(); else drawLive();
    setMessage(`Measurements converted to ${next === "m" ? "metres" : "feet"}.` + (hadResult ? " Area unchanged." : ""), "success");
  });

  $("dimension-fields").addEventListener("input", (e) => {
    if (e.target.id === "point-count") return;
    if (lastResult) { clearResult(); setMessage("Measurements changed — press Calculate Plot Area to update the result."); }
    drawLive();
  });
  $("dimension-fields").addEventListener("change", (e) => {
    if (e.target.id === "point-count") setCount(Number(e.target.value));
    else if (e.target.id === "area-unit") { if (lastResult) clearResult(); drawLive(); }
  });
  $("dimension-fields").addEventListener("click", (e) => {
    if (e.target.id === "count-plus") setCount(sideCount() + 1);
    if (e.target.id === "count-minus") setCount(sideCount() - 1);
  });
  $("plot-drawing").addEventListener("click", (e) => {
    const t = e.target.closest("[data-focus]"); if (!t) return;
    const input = $(t.dataset.focus); if (input) { input.focus({ preventScroll: true }); input.scrollIntoView({ behavior: "smooth", block: "center" }); }
  });
  $("plot-drawing").addEventListener("keydown", (e) => {
    if ((e.key === "Enter" || e.key === " ") && e.target.closest("[data-focus]")) { e.preventDefault(); e.target.dispatchEvent(new MouseEvent("click", { bubbles: true })); }
  });
  $("road-width").addEventListener("input", drawLive);
  $("dimension-form").addEventListener("submit", (e) => { e.preventDefault(); calculate(); });
  $("reset-button").addEventListener("click", () => {
    $("road-width").value = "";
    renderFields();
    setMessage("Measurements cleared.");
    const first = $("dimension-fields").querySelector("input"); if (first) first.focus({ preventScroll: true });
  });

  $("view-drawing").addEventListener("click", openPreview);
  $("close-preview").addEventListener("click", closePreview);
  $("drawing-preview-modal").addEventListener("click", (e) => { if (e.target === $("drawing-preview-modal")) closePreview(); });
  document.addEventListener("keydown", (e) => {
    if ($("drawing-preview-modal").hidden) return;
    if (e.key === "Escape") closePreview();
    if (e.key === "Tab") {
      const f = [...$("drawing-preview-modal").querySelectorAll("button")].filter((b) => !b.disabled);
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  });
  $("preview-print").addEventListener("click", printSheet);
  $("preview-share").addEventListener("click", shareSheet);
  $("preview-png").addEventListener("click", exportPng);
  $("preview-svg").addEventListener("click", exportSvg);
  $("converter-value").addEventListener("input", updateConverter);
  $("converter-unit").addEventListener("change", updateConverter);

  let resizeTimer, lastNarrow = null;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { const n = $("plot-drawing").clientWidth < 520; if (n !== lastNarrow) { lastNarrow = n; drawLive(); } }, 150);
  });
  renderFields();
  document.addEventListener("avx:i18n-ready", () => {
    const count = sideCount(), values = {};
    $("dimension-fields").querySelectorAll("input[type=number]").forEach((el) => {
      if (el.id !== "point-count" && el.value.trim() !== "") values[el.id] = el.value;
    });
    const road = $("road-width").value, hadResult = !!lastResult;
    renderFields({ count, values });
    $("road-width").value = road;
    if (hadResult) calculate();
    else drawLive();
    updateConverter();
  }, { once: true });
})(typeof window !== "undefined" ? window : globalThis);
