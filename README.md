# Image Lines

Browser port of [cfloutier/image_lines](https://github.com/cfloutier/image_lines),
a Processing sketch that converts an image into a line drawing: parallel
lines are sampled against pixel brightness and only the segments above or
below a set of thresholds are kept. The result is a plotter-ready vector
drawing where the image is encoded in the presence or absence of line
segments.

The port runs entirely in the browser, without server, build step or
dependencies: open `index.html` locally. The algorithm lives in `lines.js`,
the page only handles UI and canvas.

## Settings

"save settings" downloads all parameters as JSON, "load settings" reads such
a file back. Files from the original's `Settings/` folder load as well; the
image itself is not part of a settings file.

## Tests

```
node --test
```

`test.js` covers the threshold distribution sequences, the threshold curve,
straight line geometry, the segment filter and the SVG output. No packages
needed.

## Status

Work in progress, ported step by step from the original sketch.

- [x] Straight lines (direction, size, spacing, precision)
- [x] Threshold filter (black/bright, nb values, power, min/max, all six
      distribution modes: progressive, mirror, hachures, interleaved, bisect,
      bisect bfs)
- [x] Circle lines (min/max radius, centre, ellipse)
- [x] Sinus lines (amplitude, period; direction and size shared with straight lines)
- [x] Image levels (min, max, gamma)
- [x] Export panel: SVG (pixels or paper size with 10 mm margin), PNG/WebP raster
- [x] Settings: save and load as JSON, also reads the original's `Settings/*.json` files

## Usage

Drop an image anywhere on the page or use "load image"; "example" reloads
the embedded demo portrait ([Andy Warhol, 1975](https://commons.wikimedia.org/wiki/File:Andy_Warhol1975.jpg),
public domain, Wikimedia Commons). Parameters follow the
original names; the [original README](https://github.com/cfloutier/image_lines#readme)
documents them in detail.

| Parameter | Role |
|-----------|------|
| `width` | Working width of the image in px; the drawing has the same size |
| `blur` | Blur radius applied before sampling |
| `levels min` / `levels max` / `levels gamma` | Input range clamp and gamma before sampling |
| `curve type` | lines, circles or sinus |
| `direction` | Angle of the lines in degrees (lines and sinus) |
| `size` | Half-length of the lines around the image centre (lines and sinus) |
| `min radius` / `max radius` | Innermost and outermost circle |
| `center x` / `center y` | Circle centre offset from the image centre |
| `ellipse` | 0 circle, positive wide, negative tall |
| `amplitude` / `period` | Sine wave height and wavelength |
| `lines spacing` | Distance between adjacent lines |
| `precision` | Step size along each line when sampling pixels |
| `black lines` | On: draw segments in dark areas; off: in bright areas |
| `distribution` | Threshold order across adjacent lines |
| `nb values` | Number of threshold levels |
| `power` | Curve exponent: 0 linear, > 0 packs thresholds into the dark end, < 0 into the bright end |
| `min` / `max` | Tonal range clamp before threshold evaluation |

## License and credits

Original algorithm and Processing implementation: Copyright cfloutier,
released under the GNU Lesser General Public License 2.1 or later (see the
header of `image_lines.pde` in the original repository).

This port: Copyright 2026 TLausZ, same license, see [LICENSE](LICENSE).

One deliberate deviation: the `bisect` distribution follows the sequence
documented in the original README (period 2^(n-1), e.g. `0 3 2 3 1 3 2 3`
for n = 4). The original code wraps the line index by `nb_values` before
applying the period, which reduces the sequence to `0 3 2 3`.
