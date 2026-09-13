// run: node --test
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const L = require('./lines.js').ImageLines;

const base = { direction: 0, size: 10, lines_spacing: 1, precision: 1, lineWidth: 1,
  black: true, distribution_mode: 0, nb_values: 1, power: 0, min_value: 0, max_value: 255 };
const p = o => ({ ...base, ...o });
const seq = (P, len) => Array.from({ length: len }, (_, i) => L.distributedIndex(P, i)).join(' ');

test('distribution sequences match the original README', () => {
  assert.equal(seq(p({ nb_values: 1, distribution_mode: 4 }), 4), '0 0 0 0');
  assert.equal(seq(p({ nb_values: 4, distribution_mode: 0 }), 8), '0 1 2 3 0 1 2 3');
  assert.equal(seq(p({ nb_values: 4, distribution_mode: 2 }), 8), '0 3 1 2 0 3 1 2');
  assert.equal(seq(p({ nb_values: 4, distribution_mode: 4 }), 8), '0 3 2 3 1 3 2 3');
  assert.equal(seq(p({ nb_values: 8, distribution_mode: 5 }), 8), '0 4 2 6 1 3 5 7');
  // interleaved: every threshold exactly once per period
  const il = seq(p({ nb_values: 8, distribution_mode: 3 }), 8).split(' ').map(Number).sort((a, b) => a - b);
  assert.deepEqual(il, [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.equal(L.interleavedTable(8).slice(0, 2).join(), '0,4');
});

test('mirror walks the thresholds back and forth', () => {
  // mirror is applied in applyThreshold, observe it via which lines survive
  const img = { w: 4, h: 4, data: new Uint8ClampedArray(64).fill(100) }; // uniform grey 100
  const P = p({ nb_values: 3, distribution_mode: 1, size: 3, lines_spacing: 1 });
  // thresholds 0, 127.5, 255; line i kept when 100 < thr => index 1 and 2 pass, 0 fails
  const lines = L.buildStraightLines(P);          // 7 lines, only those inside the image sample pixels
  const kept = L.applyThreshold(P, lines, img).length;
  assert.ok(kept > 0 && kept < lines.length);
});

test('thresholdByIndex: middle for n=1, linear for power 0, sign of power', () => {
  assert.equal(L.thresholdByIndex(p({ nb_values: 1 }), 0), 127.5);
  const lin = p({ nb_values: 5 });
  assert.deepEqual([0, 1, 2, 3, 4].map(i => L.thresholdByIndex(lin, i)), [0, 63.75, 127.5, 191.25, 255]);
  const mid = P => L.thresholdByIndex(P, 2);
  assert.ok(mid(p({ nb_values: 5, power: 2 })) < 127.5, 'positive power pushes thresholds down (towards dark values)');
  assert.ok(mid(p({ nb_values: 5, power: -2 })) > 127.5, 'negative power pushes thresholds up');
  assert.equal(L.thresholdByIndex(p({ nb_values: 2, min_value: 50, max_value: 150 }), 1), 150);
});

test('straight lines: count, length and angle', () => {
  const P = p({ direction: 90, size: 10, lines_spacing: 2, precision: 1 });
  const lines = L.buildStraightLines(P);
  assert.equal(lines.length, 11);                        // advance -10..10 step 2
  const first = lines[0];
  assert.equal(first.length, 21 * 2);                    // 0..20 step 1
  // direction 90: forward = (0,1), all x equal within a line
  assert.ok(first.every((v, i) => i % 2 || Math.abs(v - first[0]) < 1e-9));
  assert.ok(Math.abs(first[first.length - 1] - first[1] - 20) < 1e-9);
});

test('applyThreshold keeps segments in the dark half only', () => {
  // 4x4 image, left half black, right half white
  const data = new Uint8ClampedArray(64);
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
    const v = x < 2 ? 0 : 255, i = (x + y * 4) * 4;
    data[i] = data[i + 1] = data[i + 2] = v; data[i + 3] = 255;
  }
  const img = { w: 4, h: 4, data };
  const P = p({ direction: 0, size: 2, lines_spacing: 1, precision: 0.5 });
  const lines = L.buildStraightLines(P);
  const dark = L.applyThreshold(P, lines, img);
  assert.ok(dark.length > 0);
  for (const pts of dark) for (let i = 0; i < pts.length; i += 2) assert.ok(pts[i] < 0, 'x in dark half');
  const bright = L.applyThreshold({ ...P, black: false }, lines, img);
  for (const pts of bright) for (let i = 0; i < pts.length; i += 2) assert.ok(pts[i] >= 0, 'x in bright half');
  assert.equal(L.getPixelValue(img, 5, 0), -1);
});

test('buildSvg: pixel and paper variants', () => {
  const img = { w: 100, h: 50, data: null };
  const drawn = [[-50, -25, 50, 25]];
  const px = L.buildSvg(p({ lineWidth: 2 }), drawn, img, null);
  assert.match(px, /viewBox="0 0 100 50"/);
  assert.match(px, /d="M0.00 0.00L100.00 50.00"/);
  assert.match(px, /stroke-width="2"/);
  const a4 = L.buildSvg(p({}), drawn, img, [210, 297]);
  assert.match(a4, /viewBox="0 0 297 210" width="297mm"/, 'landscape image rotates the paper');
  // scale = (297-20)/100 = 2.77, offsets centre the drawing
  assert.match(a4, /translate\(10.000 35.750\) scale\(2.770000\)/);
  assert.match(a4, /stroke-width="0.1083"/);            // 0.3 mm / 2.77
});

test('circle lines: count, closure, radius, ellipse stretch', () => {
  const P = p({ min_radius: 2, max_radius: 10, lines_spacing: 2, precision: 0.5, center_x: 3, center_y: -1, ellipse: 0 });
  const lines = L.buildCircleLines(P);
  assert.equal(lines.length, 4);                                   // r = 2, 4, 6, 8
  for (const [k, pts] of lines.entries()) {
    assert.equal(pts[0], pts[pts.length - 2]); assert.equal(pts[1], pts[pts.length - 1]);   // closed
    const r = 2 + 2 * k;
    for (let i = 0; i < pts.length; i += 2)
      assert.ok(Math.abs(Math.hypot(pts[i] - 3, pts[i + 1] + 1) - r) < 1e-9);
  }
  const wide = L.buildCircleLines({ ...P, ellipse: 1 })[0];        // strech 2: rx = 4, ry = 1
  assert.ok(Math.abs(wide[0] - 3 - 4) < 1e-9);
  const tall = L.buildCircleLines({ ...P, ellipse: -1 })[0];       // strech 0.5: rx = 1
  assert.ok(Math.abs(tall[0] - 3 - 1) < 1e-9);
});

test('sinus lines: amplitude, period and direction', () => {
  const P = p({ direction: 0, size: 100, lines_spacing: 50, precision: 1, high: 10, period: 100 });
  const lines = L.buildSinusLines(P);
  assert.equal(lines.length, 5);                                   // advance -100..100 step 50
  const mid = lines[2];                                            // advance 0, y = 10 sin(2 pi x / 100)
  const at = x => mid[(x + 100) * 2 + 1];
  assert.ok(Math.abs(at(0)) < 1e-9);
  assert.ok(Math.abs(at(25) - 10) < 1e-9);
  assert.ok(Math.abs(at(75) + 10) < 1e-9);
  const ys = mid.filter((_, i) => i % 2);
  assert.ok(Math.max(...ys) <= 10 + 1e-9 && Math.min(...ys) >= -10 - 1e-9);
  // direction 90: x and y swap roles
  const rot = L.buildSinusLines({ ...P, direction: 90 })[2];
  assert.ok(Math.abs(rot[(25 + 100) * 2] + 10) < 1e-9);
  assert.equal(L.buildLines({ ...P, type: 2 }).length, 5);
  assert.equal(L.buildLines({ ...P, type: 0 }).length, 5);
});
