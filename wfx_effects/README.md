# WLED-Lang: Effect Scripting Language

WLED-Lang is a domain-specific language for writing LED effects that compile to `.wfx` bytecode. Effects run on WLED's register-based VM inside ESP32 microcontrollers.

## Quick Start

### 1. Write an effect

```
effect "My Effect" {
  meta {
    slider speed "Speed"
    palette true
  }

  render {
    for i in 0..LEN {
      pixel(i, palette((i * 8 + NOW * speed / 256) % 256))
    }
    frame(speed)
  }
}
```

### 2. Compile it

```bash
cd wfx_compiler
node compiler.js ../wfx_effects/my_effect.wled -o ../wfx_effects/my_effect.wfx
```

### 3. Upload

Upload the `.wfx` file to your WLED device via the "Add Effects" button in the web UI. The effect appears in the effects list after reboot.

## CLI Reference

```bash
node compiler.js <input.wled> [-o output.wfx]   # compile
node compiler.js <input.wled> --ast              # dump AST (debug)
node compiler.js <input.wled> --hex              # dump bytecode hex (debug)
```

If `-o` is omitted, the output defaults to the input filename with `.wfx` extension.

---

## Language Guide

### File Structure

Every `.wled` file contains one `effect` declaration with three sections:

```
effect "Display Name" {
  meta { ... }          // optional: UI controls
  data bufname[size]    // optional: persistent byte buffers
  render { ... }        // required: per-frame logic
}
```

### Meta Block

Configures UI sliders, effect type, and palette usage.

```
meta {
  slider speed "Speed"
  slider intensity "Scale" default 128
  type 2D              // 1D (default) or 2D
  palette true         // show palette selector (default: false)
}
```

Up to 4 sliders are supported. They map to built-in variables in order:

| Position | Variable    |
|----------|-------------|
| 1st      | `speed`     |
| 2nd      | `intensity` |
| 3rd      | `custom1`   |
| 4th      | `custom2`   |

### Variables

Declare local variables with `let`:

```
let x = 42
let c = rgb(255, 0, 0)
```

Maximum 11 local variables. Variables inside `if`/`for`/`while` blocks are scoped -- their registers are reused after the block ends.

### Built-in Variables

These are always available without declaration:

| Variable   | Description                          | Access     |
|------------|--------------------------------------|------------|
| `speed`    | Segment speed (0-255)                | read-only  |
| `intensity`| Segment intensity (0-255)            | read-only  |
| `custom1`  | Segment custom1 slider (0-255)       | read-only  |
| `custom2`  | Segment custom2 slider (0-255)       | read-only  |
| `custom3`  | Segment custom3 slider (0-255)       | read-only  |
| `check1`   | Segment checkbox 1 (0 or 1)         | read-only  |
| `check2`   | Segment checkbox 2 (0 or 1)         | read-only  |
| `check3`   | Segment checkbox 3 (0 or 1)         | read-only  |
| `color0`   | Primary segment color (32-bit RGBW)  | read-only  |
| `color1`   | Secondary segment color              | read-only  |
| `color2`   | Tertiary segment color               | read-only  |
| `LEN`      | Segment length (number of LEDs)      | read-only  |
| `NOW`      | Current time in milliseconds         | read-only  |
| `CALL`     | Frame call counter                   | read-only  |
| `WIDTH`    | Segment width (2D matrix)            | read-only  |
| `HEIGHT`   | Segment height (2D matrix)           | read-only  |
| `aux0`     | Persistent 16-bit storage            | read/write |
| `aux1`     | Persistent 16-bit storage            | read/write |
| `step_val` | Persistent 32-bit step counter       | read/write |

### Control Flow

**if / else:**

```
if x > 10 {
  fill(rgb(255, 0, 0))
} else if x > 5 {
  fill(rgb(0, 255, 0))
} else {
  fill(rgb(0, 0, 255))
}
```

**for loop** (exclusive end -- `end` value is never reached):

```
for i in 0..LEN {
  pixel(i, color_wheel(i * 255 / LEN))
}

// with step
for k in LEN - 1..0 step -1 {
  // iterate backward
}
```

**while loop:**

```
let i = 0
while i < LEN {
  pixel(i, color0)
  i = i + 2
}
```

**frame** -- end the current frame and set delay:

```
frame(speed)    // delay based on speed slider
frame(50)       // fixed 50ms delay
```

### Data Buffers

Declare persistent byte arrays for effects that need state between frames (like Fire 2012):

```
data heat[256]

render {
  // read
  let h = heat[i]

  // write
  heat[i] = newValue
}
```

- Byte granularity (values 0-255)
- Maximum 4096 bytes total across all buffers
- Size must be a compile-time constant (`LEN` resolves to 255 at compile time)

### Operators

**Arithmetic:** `+`, `-`, `*`, `/`, `%`

**Bitwise:** `&`, `|`, `^`, `<<`, `>>`

**Comparison:** `==`, `!=`, `<`, `>`, `<=`, `>=` (produce 0 or 1, do not chain)

**Logical:** `and`, `or` (short-circuit), `not` / `~` (bitwise NOT)

**Precedence** (lowest to highest):
1. `or`
2. `and`
3. `==` `!=` `<` `>` `<=` `>=`
4. `+` `-` `|` `^`
5. `*` `/` `%` `&` `<<` `>>`
6. `-` (unary), `not`, `~`

### Comments

```
// single-line comments only
```

---

## Built-in Functions

### Pixel Operations

| Function | Description |
|----------|-------------|
| `pixel(i, color)` | Set pixel at index `i` to `color` |
| `pixel2d(x, y, color)` | Set pixel at 2D coordinates |
| `get_pixel(i)` | Get color at pixel index (returns 32-bit color) |
| `get_pixel2d(x, y)` | Get color at 2D coordinates |
| `fill(color)` | Fill entire segment with a color |
| `fade(amount)` | Fade all pixels toward black (0=full fade, 255=no fade) |
| `blur(amount)` | Blur 1D pixel data (0-255) |
| `blur2d(amount)` | Blur 2D matrix pixel data (0-255) |

### Color Functions

| Function | Description |
|----------|-------------|
| `rgb(r, g, b)` | Create color from RGB values (0-255 each) |
| `rgbw(r, g, b, w)` | Create color from RGBW values |
| `blend(c1, c2, amount)` | Blend two colors (0=c1, 255=c2) |
| `color_fade(color, amount)` | Dim a color (0=off, 255=full) |
| `color_add(c1, c2)` | Additive color mixing with saturation |
| `palette(index)` | Look up color from active palette (0-255) |
| `palette_x(index, mapping, wrap)` | Extended palette lookup |
| `color_wheel(pos)` | Rainbow color at position (0-255) |
| `red(color)` | Extract red channel |
| `green(color)` | Extract green channel |
| `blue(color)` | Extract blue channel |
| `white(color)` | Extract white channel |

### Math Functions

| Function | Description |
|----------|-------------|
| `sin8(x)` | Fast 8-bit sine (input 0-255, output 0-255) |
| `cos8(x)` | Fast 8-bit cosine |
| `sin16(x)` | 16-bit sine (input 0-65535, output -32768..32767) |
| `beat8(bpm, low, high)` | Sine wave oscillating between `low` and `high` at `bpm` |
| `tri8(x)` | Triangle wave (0-255 in, 0-255 out) |
| `quad8(x)` | Quadratic ease wave |
| `scale8(value, scale)` | Scale 8-bit value: `(value * scale) / 256` |
| `qadd8(a, b)` | Saturating add (clamped at 255) |
| `qsub8(a, b)` | Saturating subtract (clamped at 0) |
| `random()` | Random 0-255 |
| `random(max)` | Random 0 to max-1 |
| `random(min, max)` | Random min to max-1 |
| `random16()` | Random 0-65535 |
| `noise(x)` | 1D Perlin noise (16-bit input, 8-bit output) |
| `noise2(x, y)` | 2D Perlin noise |
| `noise3(x, y, z)` | 3D Perlin noise |
| `sqrt(x)` | Integer square root |
| `abs(x)` | Absolute value |
| `min(a, b)` | Smaller of two values |
| `max(a, b)` | Larger of two values |

### 2D Drawing

| Function | Description |
|----------|-------------|
| `draw_line(x0, y0, x1, y1, color)` | Draw a line |
| `draw_circle(cx, cy, radius, color)` | Draw circle outline |
| `fill_circle(cx, cy, radius, color)` | Draw filled circle |
| `move_pixels(dir, delta, wrap)` | Move all pixels in a direction |

---

## Examples

### Rainbow

Scrolling rainbow using the color wheel:

```
effect "Rainbow" {
  meta {
    slider speed "Speed"
    slider intensity "Width"
  }

  render {
    let offset = NOW * speed / 256

    for i in 0..LEN {
      let hue = (i * 256 / LEN + offset) % 256
      pixel(i, color_wheel(hue))
    }

    frame(speed)
  }
}
```

### Sparkle

Random palette-colored sparkles with fade:

```
effect "Sparkle" {
  meta {
    slider speed "Speed"
    slider intensity "Density"
    palette true
  }

  render {
    fade(224)

    let count = intensity / 16 + 1
    for j in 0..count {
      let pos = random(LEN)
      pixel(pos, palette(random(255)))
    }

    frame(speed)
  }
}
```

### Fire 2012

Classic fire simulation using a data buffer:

```
effect "Fire 2012" {
  meta {
    slider speed "Cooling"
    slider intensity "Sparking"
    palette true
  }

  data heat[256]

  render {
    // Cool down every cell
    for i in 0..LEN {
      let cool = random(0, speed / 5 + 2)
      let h = heat[i]
      heat[i] = qsub8(h, cool)
    }

    // Heat drifts up and diffuses
    for k in LEN - 1..1 step -1 {
      let below = heat[k - 1]
      let below2 = heat[k - 2]
      let cur = heat[k]
      heat[k] = (below + below2 + cur) / 3
    }

    // Randomly ignite sparks near bottom
    if random(255) < intensity {
      let y = random(7)
      let h = heat[y]
      heat[y] = qadd8(h, random(160, 255))
    }

    // Map heat to palette colors
    for j in 0..LEN {
      let colorindex = scale8(heat[j], 240)
      pixel(j, palette(colorindex))
    }

    frame(speed)
  }
}
```

### Plasma 2D

2D plasma effect using sine/cosine and palette:

```
effect "Plasma 2D" {
  meta {
    slider speed "Speed"
    slider intensity "Scale"
    type 2D
    palette true
  }

  render {
    let t = NOW * speed / 512

    for y in 0..HEIGHT {
      for x in 0..WIDTH {
        let v1 = sin8(x * intensity / 4 + t)
        let v2 = cos8(y * intensity / 4 + t)
        let v3 = sin8((x + y) * intensity / 8 + t / 2)
        let idx = (v1 + v2 + v3) / 3
        pixel2d(x, y, palette(idx))
      }
    }

    frame(speed)
  }
}
```

### Scanner

Bouncing light bar with trail:

```
effect "Scan" {
  meta {
    slider speed "Speed"
    slider intensity "Width"
    palette true
  }

  render {
    let width = max(intensity / 32, 1)
    let cycle = (NOW * speed / 512) % (LEN * 2)
    let pos = cycle

    // Bounce: reverse in second half
    if pos >= LEN {
      pos = LEN * 2 - pos - 1
    }

    fade(192)

    for j in 0..width {
      let idx = pos + j
      if idx >= 0 and idx < LEN {
        pixel(idx, palette(j * 255 / width))
      }
    }

    frame(speed)
  }
}
```

---

## VM Safety Limits

| Limit | Value |
|-------|-------|
| Max cycles per frame | 50,000 (watchdog) |
| Max data allocation | 4,096 bytes |
| Max bytecode size | 65,535 bytes |
| Max local variables | 11 |
| Max expression depth | 5 temp registers |
| Division by zero | Returns 0 |
| Out-of-bounds pixel | Silently ignored |
| Out-of-bounds data | Read returns 0, write ignored |

## Tips

- Use `NOW` with `speed` for time-based animation: `NOW * speed / 256`
- Use `%` (modulo) to wrap values: `(i + offset) % LEN`
- Use `fade()` before drawing for trail effects
- Use `fill(rgb(0,0,0))` for clean-slate effects
- Use `palette()` with `palette true` in meta to let users pick color schemes
- `for i in 0..LEN` iterates 0, 1, ..., LEN-1 (end is exclusive)
- `sin8`/`cos8` are fast lookup tables -- prefer them over `sin16` when 8-bit precision is enough
- `scale8(value, 240)` is a cheap way to map 0-255 to 0-240
- `qadd8`/`qsub8` clamp to 0-255 -- use them to avoid overflow in byte math
