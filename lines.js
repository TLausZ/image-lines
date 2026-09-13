// image lines, algorithm. Browser port of https://github.com/cfloutier/image_lines
// Original: Copyright (C) cfloutier, LGPL-2.1-or-later
// Port:     Copyright (C) 2026 TLausZ, LGPL-2.1-or-later (see LICENSE)
//
// Pure functions, no DOM. Loaded by index.html via <script> and by test.js via require.
// Coordinates are centered on the image; polylines are flat arrays [x0,y0,x1,y1,...].
// img = { w, h, data } with data as RGBA bytes (canvas ImageData layout).
'use strict';
(function (root) {

// DataImage.getPixelValue: mean of r,g,b, -1 outside the image
function getPixelValue(img, x, y) {
  const xp = Math.trunc(x + img.w / 2), yp = Math.trunc(y + img.h / 2);
  if (xp < 0 || xp >= img.w || yp < 0 || yp >= img.h) return -1;
  const i = (xp + yp * img.w) * 4;
  return (img.data[i] + img.data[i + 1] + img.data[i + 2]) / 3;
}

// StraightLines.buildLines
function buildStraightLines(P) {
  const rad = P.direction * Math.PI / 180;
  const fx = Math.cos(rad), fy = Math.sin(rad);   // forward
  const rx = -fy, ry = fx;                        // right
  const radius = P.size, spacing = P.lines_spacing, prec = Math.max(0.5, P.precision);
  const lines = [];
  for (let advance = -radius; advance <= radius; advance += spacing) {
    const sx = advance * rx - fx * radius, sy = advance * ry - fy * radius;
    const pts = [];
    for (let a = 0; a <= radius * 2; a += prec) pts.push(sx + fx * a, sy + fy * a);
    if (pts.length >= 4) lines.push(pts);
  }
  return lines;
}

// CircleLines.buildLines: concentric circles or ellipses around (center_x, center_y)
function buildCircleLines(P) {
  const prec = Math.max(0.5, P.precision);
  const strech = P.ellipse >= 0 ? 1 + P.ellipse : 1 / (1 - P.ellipse);
  const lines = [];
  for (let r = P.min_radius; r < P.max_radius; r += P.lines_spacing) {
    const rx = r * strech, ry = r / strech;
    const nb = Math.ceil(2 * Math.PI * (rx + ry) / 2 / prec);
    const delta = 2 * Math.PI / nb;
    const pts = [];
    for (let a = 0; a < 2 * Math.PI; a += delta)
      pts.push(P.center_x + rx * Math.cos(a), P.center_y + ry * Math.sin(a));
    pts.push(pts[0], pts[1]);                     // close the circle
    if (pts.length >= 4) lines.push(pts);
  }
  return lines;
}

// SinusLines.buildLines: parallel sine waves, amplitude high, wavelength period
function buildSinusLines(P) {
  const rad = P.direction * Math.PI / 180;
  const fx = Math.cos(rad), fy = Math.sin(rad);
  const rx = -fy, ry = fx;
  const radius = P.size, prec = Math.max(0.5, P.precision);
  const lines = [];
  for (let advance = -radius; advance <= radius; advance += P.lines_spacing) {
    const pts = [];
    for (let x = -radius; x <= radius; x += prec) {
      const y = P.high * Math.sin(2 * Math.PI * x / P.period) + advance;
      pts.push(fx * x + rx * y, fy * x + ry * y);
    }
    if (pts.length >= 4) lines.push(pts);
  }
  return lines;
}

// MultiLinesGenerator.buildLines: type 0 straight, 1 circles, 2 sinus
function buildLines(P) {
  return [buildStraightLines, buildCircleLines, buildSinusLines][P.type || 0](P);
}

// DataThreshold (xLib_ThresholdData.pde)
function thresholdByIndex(P, index) {
  const n = P.nb_values;
  const ratio = n > 1 ? index / (n - 1) : 0.5;
  const factor = P.power >= 0 ? 1 + P.power : 1 / (1 - P.power);
  return P.min_value + (P.max_value - P.min_value) * Math.pow(ratio, factor);
}

function interleavedTable(n) {
  const t = new Array(n).fill(0), used = new Array(n).fill(false);
  used[0] = true;
  for (let ti = 1; ti < n; ti++) {
    let best = -1, bestScore = -1;
    for (let c = 0; c < n; c++) {
      if (used[c]) continue;
      let nearest = n;
      for (let u = 0; u < n; u++) {
        if (!used[u]) continue;
        const d = Math.min(Math.abs(c - u), n - Math.abs(c - u));
        if (d < nearest) nearest = d;
      }
      if (nearest > bestScore) { bestScore = nearest; best = c; }
    }
    used[best] = true; t[best] = ti;
  }
  return t;
}

function bisectBfsTable(n) {
  const t = new Array(n).fill(0);
  if (n <= 1) return t;
  const q = [[1, n - 1]];
  let li = 1;
  while (q.length && li < n) {
    const [lo, hi] = q.shift();
    const mid = Math.floor((lo + hi) / 2);
    t[li++] = mid;
    if (lo < mid) q.push([lo, mid - 1]);
    if (mid < hi) q.push([mid + 1, hi]);
  }
  return t;
}

const tableCache = {};
function distributedIndex(P, index) {
  const n = P.nb_values;
  if (n <= 1) return 0;
  const wrapped = ((index % n) + n) % n;
  switch (P.distribution_mode) {
    case 2: return wrapped % 2 === 0 ? wrapped / 2 : (n - 1) - Math.floor(wrapped / 2);
    case 3: return (tableCache['i' + n] ??= interleavedTable(n))[wrapped];
    case 4: {
      // deviates from the original code, which wraps by nb_values first (period n instead of 2^(n-1))
      const period = 1 << (n - 1);
      const i = ((index % period) + period) % period;
      if (i === 0) return 0;
      const tz = 31 - Math.clz32(i & -i);
      return Math.max(0, (n - 1) - tz);
    }
    case 5: return (tableCache['b' + n] ??= bisectBfsTable(n))[wrapped];
    default: return wrapped;
  }
}

// ThresholdFilter.buildLines
function applyThreshold(P, lines, img) {
  const out = [];
  let dir = 1, ti = 0, thr = 0;
  const n = P.nb_values;
  for (const pts of lines) {
    thr = thresholdByIndex(P, distributedIndex(P, ti));
    if (P.distribution_mode === 1) {
      ti += dir;
      if (ti >= n || ti < 0) { dir = -dir; ti += dir * 2; }
    } else {
      ti++; if (ti >= n) ti = 0;
    }
    let cur = null;
    const close = () => { if (cur && cur.length >= 4) out.push(cur); cur = null; };
    for (let i = 0; i < pts.length; i += 2) {
      const v = getPixelValue(img, pts[i], pts[i + 1]);
      const keep = v !== -1 && (P.black ? v < thr : v > thr);
      if (keep) (cur ??= []).push(pts[i], pts[i + 1]); else close();
    }
    close();
  }
  return out;
}

// SVG. paper = null for pixel size, or [width_mm, height_mm]; 10 mm margin, 0.3 mm per line width unit
function buildSvg(P, drawn, img, paper) {
  const w = img.w, h = img.h, cx = w / 2, cy = h / 2;
  const paths = drawn.map(pts => {
    let d = '';
    for (let i = 0; i < pts.length; i += 2)
      d += (i ? 'L' : 'M') + (pts[i] + cx).toFixed(2) + ' ' + (pts[i + 1] + cy).toFixed(2);
    return `<path d="${d}"/>`;
  }).join('\n');
  const attrs = 'fill="none" stroke="#000" stroke-linejoin="round" stroke-linecap="round"';
  if (!paper)
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
<g ${attrs} stroke-width="${P.lineWidth}">
${paths}
</g>
</svg>`;
  let [pw, ph] = paper;
  if ((w > h) !== (pw > ph)) [pw, ph] = [ph, pw];
  const margin = 10;
  const sc = Math.min((pw - 2 * margin) / w, (ph - 2 * margin) / h);
  const ox = (pw - w * sc) / 2, oy = (ph - h * sc) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${pw} ${ph}" width="${pw}mm" height="${ph}mm">
<g transform="translate(${ox.toFixed(3)} ${oy.toFixed(3)}) scale(${sc.toFixed(6)})" ${attrs} stroke-width="${(P.lineWidth * 0.3 / sc).toFixed(4)}">
${paths}
</g>
</svg>`;
}

root.ImageLines = { getPixelValue, buildStraightLines, buildCircleLines, buildSinusLines, buildLines, thresholdByIndex, distributedIndex,
  interleavedTable, bisectBfsTable, applyThreshold, buildSvg };
})(typeof module !== 'undefined' ? module.exports : globalThis);
