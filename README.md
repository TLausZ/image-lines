# Image Lines

Browser port of [cfloutier/image_lines](https://github.com/cfloutier/image_lines),
a Processing sketch that converts an image into a line drawing: parallel
lines are sampled against pixel brightness and only the segments above or
below a set of thresholds are kept. The result is a plotter-ready vector
drawing where the image is encoded in the presence or absence of line
segments.

The port runs entirely in the browser, without server, build step or
dependencies: open `index.html` locally.

## Status

Work in progress, ported step by step from the original sketch.

- [x] Straight lines (direction, size, spacing, precision)
- [x] Threshold filter (black/bright, nb values, power, min/max, all six
      distribution modes: progressive, mirror, hachures, interleaved, bisect,
      bisect bfs)
- [ ] Circle lines
- [ ] Sinus lines
- [ ] Image levels (min, max, gamma)
- [x] Export panel: SVG (pixels or paper size with 10 mm margin), PNG/WebP raster
- [ ] Settings presets

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
| `direction` | Angle of the lines in degrees |
| `size` | Half-length of the lines around the image centre |
| `lines spacing` | Distance between adjacent lines |
| `precision` | Step size along each line when sampling pixels |
| `black lines` | On: draw segments in dark areas; off: in bright areas |
| `distribution` | Threshold order across adjacent lines |
| `nb values` | Number of threshold levels |
| `power` | Curve exponent: 0 linear, > 0 towards bright, < 0 towards dark |
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
