/* @ds-bundle: {"format":4,"namespace":"Meadow","components":[{"name":"GlyphSpecimen"},{"name":"TimeDial"},{"name":"WindControl"},{"name":"ControlPanel"},{"name":"HeroText"},{"name":"GlyphRamp"}]} */
(function () {
  var React = window.React
  var h = React.createElement
  var useEffect = React.useEffect
  var useRef = React.useRef
  var useState = React.useState

  // ── shared helpers ────────────────────────────────────────────────────

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v
  }
  function hash(x, y, z) {
    var n = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 1442695041)
    n = Math.imul(n ^ (n >>> 13), 1274126177)
    n ^= n >>> 16
    return (n >>> 0) / 4294967296
  }
  function noise1(x, seed) {
    var i = Math.floor(x)
    var f = x - i
    var u = f * f * (3 - 2 * f)
    var a = hash(i, seed, 0)
    var b = hash(i + 1, seed, 0)
    return (a + (b - a) * u) * 2 - 1
  }
  function hexRgb(s) {
    s = (s || '').trim()
    if (s[0] === '#') {
      if (s.length === 4) s = '#' + s[1] + s[1] + s[2] + s[2] + s[3] + s[3]
      return [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)]
    }
    var m = s.match(/[\d.]+/g)
    return m ? [+m[0], +m[1], +m[2]] : [128, 128, 128]
  }
  function css(c, a) {
    return a === undefined ? 'rgb(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ')' : 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + a + ')'
  }
  function mix(a, b, t) {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
  }
  function smooth(e0, e1, x) {
    var t = clamp((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)
  }
  // Scene colours come from the per-time tokens (`day-poppy`, `sunset-sky-top`, …), blended by hour
  // the way the garden does; page colours come from the theme.
  var SCENE = ['sky-top', 'sky-horizon', 'cloud', 'haze', 'hill-far', 'hill-near', 'ground', 'grass-dark', 'grass-light', 'stem', 'poppy', 'poppy-deep', 'cosmos', 'cosmos-vein', 'lace', 'dandelion', 'disc', 'fluff']
  var KEYS = [[0, 'night'], [4.5, 'night'], [6.5, 'dawn'], [9, 'day'], [16, 'day'], [17.75, 'golden'], [19, 'sunset'], [20.15, 'twilight'], [21.4, 'night'], [24, 'night']]
  function readPalette(el, hour) {
    var cs = getComputedStyle(el)
    var hr = (((hour === undefined ? 15 : hour) % 24) + 24) % 24
    var i = 0
    while (i < KEYS.length - 2 && KEYS[i + 1][0] <= hr) i++
    var t = smooth(0, 1, (hr - KEYS[i][0]) / (KEYS[i + 1][0] - KEYS[i][0] || 1))
    var p = {}
    SCENE.forEach(function (n) {
      var a = hexRgb(cs.getPropertyValue('--' + KEYS[i][1] + '-' + n))
      var b = hexRgb(cs.getPropertyValue('--' + KEYS[i + 1][1] + '-' + n))
      p[n] = mix(a, b, t)
    })
    // How far into the night: 0 by day, 1 at full night.
    var NIGHT = { day: 0, golden: 0.1, sunset: 0.3, twilight: 0.6, night: 1, dawn: 0.35 }
    p.night = NIGHT[KEYS[i][1]] + (NIGHT[KEYS[i + 1][1]] - NIGHT[KEYS[i][1]]) * t
    // The page follows the sky: light by day, dark from sunset to dawn, switching quickly.
    p.page = mix(hexRgb(cs.getPropertyValue('--page-dark')), hexRgb(cs.getPropertyValue('--page-light')), skyLight(p['sky-top']))
    p.ink = hexRgb(cs.getPropertyValue('--ink'))
    return p
  }
  function skyLight(sky) {
    return smooth(0.21, 0.26, (0.2126 * sky[0] + 0.7152 * sky[1] + 0.0722 * sky[2]) / 255)
  }
  // The page theme for an hour, for setting data-theme on <html>.
  function pageFor(hour) {
    return skyLight(readPalette(document.documentElement, hour)['sky-top']) > 0.5 ? 'light' : 'dark'
  }

  // The home page is the scene, full bleed. Leaving it, the page colour closes over the scene
  // from the edges in: `veilOrder` says when each point is covered, 0 at the edges (first) to 1
  // in the middle (last), with a soft band 26% in from the sides, 24% from the top and deeper at
  // the bottom. `veil` runs 0 (home) to 1 (plain page) over --veil-duration, eased.
  function veilOrder(u, v) {
    return smooth(0, 0.26, u) * smooth(0, 0.26, 1 - u) * smooth(0, 0.24, v) * smooth(0.14, 0.5, 1 - v)
  }
  function easeInOut(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
  }
  var veils = {}
  // Lays the page colour over the scene as far as the veil has come. Draw it last.
  function paintVeil(ctx, W, H, page, veil) {
    if (!(veil > 0)) return
    if (veil >= 1) {
      ctx.fillStyle = css(page)
      ctx.fillRect(0, 0, W, H)
      return
    }
    var key = page.map(Math.round).join(',') + '/' + veil.toFixed(3)
    var m = veils[key]
    if (!m) {
      var cw = 64
      var chh = 48
      m = document.createElement('canvas')
      m.width = cw
      m.height = chh
      var mc = m.getContext('2d')
      var img = mc.createImageData(cw, chh)
      for (var y = 0; y < chh; y++)
        for (var x = 0; x < cw; x++) {
          var o = (y * cw + x) * 4
          img.data[o] = page[0]
          img.data[o + 1] = page[1]
          img.data[o + 2] = page[2]
          img.data[o + 3] = clamp(2 * veil - veilOrder((x + 0.5) / cw, (y + 0.5) / chh), 0, 1) * 255
        }
      mc.putImageData(img, 0, 0)
      if (Object.keys(veils).length > 64) veils = {}
      veils[key] = m
    }
    ctx.imageSmoothingEnabled = true
    ctx.drawImage(m, 0, 0, W, H)
  }
  // Sky to horizon to meadow, as in the garden; the horizon sits at `hz` of the height.
  function paintScene(ctx, W, H, p, hz) {
    var g = ctx.createLinearGradient(0, 0, 0, H)
    g.addColorStop(0, css(p['sky-top']))
    g.addColorStop(hz - 0.01, css(p['sky-horizon']))
    g.addColorStop(Math.min(0.99, hz + 0.06), css(mix(p['hill-near'], p.ground, 0.5)))
    g.addColorStop(1, css(p.ground))
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)
    // Mist along the horizon.
    var m = ctx.createLinearGradient(0, H * (hz - 0.08), 0, H * (hz + 0.06))
    m.addColorStop(0, css(p.haze, 0))
    m.addColorStop(0.55, css(p.haze, 0.55))
    m.addColorStop(1, css(p.haze, 0))
    ctx.fillStyle = m
    ctx.fillRect(0, H * (hz - 0.08), W, H * 0.14)
  }
  function reducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }
  // Re-read the palette whenever data-theme changes on <html>.
  function useThemeTick() {
    var s = useState(0)
    useEffect(function () {
      var mo = new MutationObserver(function () {
        s[1](function (n) {
          return n + 1
        })
      })
      mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class', 'style'] })
      return function () {
        mo.disconnect()
      }
    }, [])
    return s[0]
  }

  // ── GlyphSpecimen: one flower at specimen scale, reprinted as type ─────

  var RAMP = " .:-=+*#%@"
  var EDGE = ['-', '\\', '|', '/']
  var KIND = { petal: 1, disc: 2, stem: 3, leaf: 4, fluff: 5 }
  var KIND_CSS = ['', '#0000ff', '#00ff00', '#00ffff', '#ff0000', '#ff00ff']

  function petalPath(ctx, x, y, angle, len, wid, notch) {
    // A petal: narrow at the base, broad and rounded (or notched) at the tip.
    var ca = Math.cos(angle)
    var sa = Math.sin(angle)
    function P(u, v) {
      return [x + ca * u - sa * v, y + sa * u + ca * v]
    }
    var p = new Path2D()
    var a = P(0, 0)
    p.moveTo(a[0], a[1])
    var c1 = P(len * 0.35, -wid * 0.9)
    var c2 = P(len * 0.95, -wid * 1.05)
    var e = P(len, -wid * 0.3)
    p.bezierCurveTo(c1[0], c1[1], c2[0], c2[1], e[0], e[1])
    if (notch) {
      var n1 = P(len - len * notch, -wid * 0.1)
      var n2 = P(len, wid * 0.1)
      var n3 = P(len - len * notch, wid * 0.3)
      p.lineTo(n1[0], n1[1])
      p.lineTo(n2[0], n2[1])
      p.lineTo(n3[0], n3[1])
    } else {
      var t = P(len * 1.04, 0)
      p.quadraticCurveTo(t[0], t[1] - 0, P(len, wid * 0.3)[0], P(len, wid * 0.3)[1])
    }
    var d1 = P(len * 0.95, wid * 1.05)
    var d2 = P(len * 0.35, wid * 0.9)
    p.bezierCurveTo(d1[0], d1[1], d2[0], d2[1], a[0], a[1])
    p.closePath()
    return p
  }

  function makeLayer(w, hgt) {
    var c = document.createElement('canvas')
    c.width = w
    c.height = hgt
    return c.getContext('2d', { willReadFrequently: true })
  }

  function drawFlower(L, species, p, W, H, t, wind, stage) {
    // L.fill(path, rgb, kind) draws into both the colour and material layers.
    var baseX = W * 0.5
    var baseY = H + 4
    var sway = wind * (0.16 + 0.1 * noise1(t * 0.35, 3)) + wind * 0.08 * Math.sin(t * 1.3)
    var heightK = species === 'dandelion' ? 0.55 : 0.68
    var len = H * heightK
    var tipX = baseX + Math.sin(sway) * len * 0.6
    var tipY = baseY - Math.cos(sway * 0.6) * len
    var bud = stage === 'bud'
    var nod = bud && species === 'poppy'
    // Stalk: a curve that bends with the wind, hooked over when a poppy bud nods.
    var stem = new Path2D()
    stem.moveTo(baseX, baseY)
    var cx = baseX + Math.sin(sway) * len * 0.15
    var cy = baseY - len * 0.55
    if (nod) {
      tipX = baseX + len * 0.16
      tipY = baseY - len * 0.86
      stem.bezierCurveTo(cx, cy, baseX + len * 0.02, baseY - len * 1.02, tipX, tipY)
    } else stem.quadraticCurveTo(cx, cy, tipX, tipY)
    L.stroke(stem, p.stem, KIND.stem, Math.max(2, W * 0.012))

    // Basal leaves.
    for (var i = 0; i < 2; i++) {
      var side = i ? 1 : -1
      var leaf = new Path2D()
      var lx = baseX + side * W * 0.02
      var ly = baseY - 2
      var lw = W * (species === 'dandelion' ? 0.24 : 0.14)
      leaf.moveTo(lx, ly)
      leaf.quadraticCurveTo(lx + side * lw * 0.6, ly - H * 0.2, lx + side * lw * (1 + 0.05 * Math.sin(t + i)), ly - H * (species === 'dandelion' ? 0.06 : 0.22))
      leaf.quadraticCurveTo(lx + side * lw * 0.3, ly - H * 0.05, lx, ly)
      L.fill(leaf, mix(p['grass-dark'], p.stem, 0.4), KIND.leaf)
    }

    var R = Math.min(W, H) * (species === 'dandelion' ? 0.2 : 0.24)
    var face = sway * 0.6
    if (species === 'poppy') {
      if (bud) {
        var b = new Path2D()
        b.ellipse(tipX, tipY + R * 0.3, R * 0.28, R * 0.42, -0.3, 0, Math.PI * 2)
        L.fill(b, p.stem, KIND.leaf)
        return
      }
      // Cup seen from three-quarters: two back petals, the dark centre, two front petals.
      var back = mix(p.poppy, p['poppy-deep'], 0.45)
      L.fill(petalPath(L.ctx, tipX, tipY, -Math.PI / 2 - 0.75 + face, R, R * 0.62), back, KIND.petal)
      L.fill(petalPath(L.ctx, tipX, tipY, -Math.PI / 2 + 0.75 + face, R, R * 0.62), back, KIND.petal)
      var centre = new Path2D()
      centre.ellipse(tipX, tipY - R * 0.22, R * 0.3, R * 0.13, face, 0, Math.PI * 2)
      L.fill(centre, p.disc, KIND.disc)
      L.fill(petalPath(L.ctx, tipX, tipY + R * 0.05, -Math.PI / 2 - 1.25 + face, R * 0.95, R * 0.6), p.poppy, KIND.petal)
      L.fill(petalPath(L.ctx, tipX, tipY + R * 0.05, -Math.PI / 2 + 1.25 + face, R * 0.95, R * 0.6), p.poppy, KIND.petal)
      var front = new Path2D()
      front.ellipse(tipX, tipY + R * 0.12, R * 0.5, R * 0.28, face, 0, Math.PI)
      L.fill(front, mix(p.poppy, [255, 255, 255], 0.12), KIND.petal)
    } else if (species === 'cosmos') {
      // Eight notched rays around a small raised disc, tilted a little toward the viewer.
      var squash = 0.62
      for (var k = 0; k < 8; k++) {
        var a = (k / 8) * Math.PI * 2 + face + 0.2
        var ex = Math.cos(a)
        var ey = Math.sin(a) * squash
        var ang = Math.atan2(ey, ex)
        var rl = R * Math.hypot(ex, ey)
        var col = ey < 0 ? mix(p.cosmos, p['cosmos-vein'], 0.35) : p.cosmos
        L.fill(petalPath(L.ctx, tipX, tipY, ang, rl, R * 0.24 * (0.7 + 0.3 * Math.abs(Math.cos(a))), 0.12), col, KIND.petal)
      }
      var d = new Path2D()
      d.ellipse(tipX, tipY, R * 0.2, R * 0.2 * squash, 0, 0, Math.PI * 2)
      L.fill(d, p.dandelion, KIND.disc)
      var d2 = new Path2D()
      d2.ellipse(tipX, tipY - R * 0.03, R * 0.09, R * 0.06, 0, 0, Math.PI * 2)
      L.fill(d2, p.disc, KIND.disc)
    } else if (species === 'lace') {
      // Flat-topped umbel: rays fanning up, each ending in a cluster of florets.
      var rays = new Path2D()
      var florets = new Path2D()
      for (var j = 0; j < 13; j++) {
        var f = j / 12 - 0.5
        var rx = tipX + f * R * 2.1
        var ry = tipY - R * 0.55 + Math.abs(f) * R * 0.3
        rays.moveTo(tipX, tipY)
        rays.quadraticCurveTo(tipX + f * R * 0.6, tipY - R * 0.35, rx, ry)
        for (var q = 0; q < 6; q++) {
          var qa = (q / 6) * Math.PI * 2
          var fx = rx + Math.cos(qa) * R * 0.11
          var fy = ry + Math.sin(qa) * R * 0.06
          florets.moveTo(fx + R * 0.045, fy)
          florets.ellipse(fx, fy, R * 0.045, R * 0.045, 0, 0, Math.PI * 2)
        }
      }
      L.stroke(rays, p.stem, KIND.stem, Math.max(1, W * 0.005))
      L.fill(florets, p.lace, KIND.fluff)
      var dark = new Path2D()
      dark.ellipse(tipX, tipY - R * 0.62, R * 0.06, R * 0.06, 0, 0, Math.PI * 2)
      L.fill(dark, p['poppy-deep'], KIND.disc)
    } else {
      // Dandelion clock: spokes to a sphere of seeds, a dark receptacle at the middle.
      var cyy = tipY - R * 0.9
      var spokes = new Path2D()
      var seeds = new Path2D()
      for (var s = 0; s < 46; s++) {
        var yy = 1 - (s / 45) * 2
        var rr = Math.sqrt(1 - yy * yy)
        var th = s * 2.39996 + t * 0.05
        var sx = tipX + Math.cos(th) * rr * R
        var sy = cyy + yy * R
        spokes.moveTo(tipX, cyy)
        spokes.lineTo(sx, sy)
        seeds.moveTo(sx + R * 0.05, sy)
        seeds.ellipse(sx, sy, R * 0.05, R * 0.05, 0, 0, Math.PI * 2)
      }
      L.stroke(spokes, p.fluff, KIND.fluff, 0.8, 0.5)
      L.fill(seeds, p.fluff, KIND.fluff)
      var rc = new Path2D()
      rc.ellipse(tipX, cyy, R * 0.12, R * 0.12, 0, 0, Math.PI * 2)
      L.fill(rc, p.disc, KIND.disc)
    }
  }

  function renderSpecimen(canvas, opts, t) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2)
    var W = canvas.clientWidth
    var H = canvas.clientHeight
    if (W < 2 || H < 2) return
    if (canvas.width !== Math.round(W * dpr)) {
      canvas.width = Math.round(W * dpr)
      canvas.height = Math.round(H * dpr)
    }
    var cw = opts.cell
    var ch = Math.round(cw * 1.32)
    var cols = Math.ceil(W / cw)
    var rows = Math.ceil(H / ch)
    var SS = 2
    var color = makeLayer(cols * SS, rows * SS)
    var kind = makeLayer(cols * SS, rows * SS)
    color.setTransform(SS / cw, 0, 0, SS / ch, 0, 0)
    kind.setTransform(SS / cw, 0, 0, SS / ch, 0, 0)
    var p = opts.palette
    var L = {
      ctx: color,
      fill: function (path, rgb, k, a) {
        color.globalAlpha = kind.globalAlpha = a === undefined ? 1 : a
        color.fillStyle = css(rgb)
        color.fill(path)
        kind.fillStyle = KIND_CSS[k]
        kind.fill(path)
      },
      stroke: function (path, rgb, k, w, a) {
        color.globalAlpha = kind.globalAlpha = a === undefined ? 1 : a
        color.lineWidth = kind.lineWidth = w
        color.lineCap = kind.lineCap = 'round'
        color.strokeStyle = css(rgb)
        color.stroke(path)
        kind.strokeStyle = KIND_CSS[k]
        kind.stroke(path)
      },
    }
    drawFlower(L, opts.species, p, W, H, t, opts.wind, opts.stage)
    var cd = color.getImageData(0, 0, cols * SS, rows * SS).data
    var kd = kind.getImageData(0, 0, cols * SS, rows * SS).data
    var n = cols * rows
    var cov = new Float32Array(n)
    var kk = new Uint8Array(n)
    var rgb = new Float32Array(n * 3)
    var Wd = cols * SS
    for (var r = 0; r < rows; r++)
      for (var c = 0; c < cols; c++) {
        var A = 0, R0 = 0, G0 = 0, B0 = 0, kr = 0, kg = 0, kb = 0, ka = 0
        for (var sy = 0; sy < SS; sy++)
          for (var sx = 0; sx < SS; sx++) {
            var o = ((r * SS + sy) * Wd + c * SS + sx) * 4
            var al = cd[o + 3]
            A += al
            R0 += cd[o] * al
            G0 += cd[o + 1] * al
            B0 += cd[o + 2] * al
            var kal = kd[o + 3]
            ka += kal
            kr += kd[o] * kal
            kg += kd[o + 1] * kal
            kb += kd[o + 2] * kal
          }
        var i = r * cols + c
        cov[i] = A / (255 * SS * SS)
        if (A > 0) {
          rgb[i * 3] = R0 / A
          rgb[i * 3 + 1] = G0 / A
          rgb[i * 3 + 2] = B0 / A
        }
        var half = 127.5 * ka
        kk[i] = ka > 0 ? (kr > half ? 4 : 0) | (kg > half ? 2 : 0) | (kb > half ? 1 : 0) : 0
      }

    var ctx = canvas.getContext('2d')
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    // Full bleed, as on the home page.
    paintScene(ctx, W, H, p, 0.62)
    ctx.font = '500 ' + Math.round(ch * 0.78) + 'px "IBM Plex Mono", ui-monospace, Menlo, monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    function at(c2, r2) {
      return c2 < 0 || r2 < 0 || c2 >= cols || r2 >= rows ? 0 : cov[r2 * cols + c2]
    }
    for (r = 0; r < rows; r++)
      for (c = 0; c < cols; c++) {
        i = r * cols + c
        var v = cov[i]
        var k = kk[i]
        if (v < 0.08 || !k) continue
        var col = [rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2]]
        var lum = (0.2126 * col[0] + 0.7152 * col[1] + 0.0722 * col[2]) / 255
        var gx = at(c + 1, r) - at(c - 1, r)
        var gy = at(c, r + 1) - at(c, r - 1)
        var edge = Math.hypot(gx, gy) > 0.35
        var glyph
        var alpha = 1
        if (k === KIND.disc) glyph = v > 0.6 ? '@' : '#'
        else if (k === KIND.stem || (edge && (k === KIND.petal || k === KIND.leaf))) {
          // Outlines and stalks follow the shape: the line glyph nearest the contour's direction.
          var ang = k === KIND.stem && !edge ? Math.PI / 2 : Math.atan2(gy * ch, gx * cw) + Math.PI / 2
          if (ang < 0) ang += Math.PI
          glyph = EDGE[Math.round(ang / (Math.PI / 4)) % 4]
          if (k === KIND.stem && v < 0.15) glyph = ':'
        } else if (k === KIND.fluff) glyph = v > 0.5 ? '*' : '+'
        else {
          // Interiors stay light so the outline carries the shape; the tile behind gives the colour.
          var dd = clamp(v * 0.15 + lum * 0.5 - 0.08 + (hash(c, r, 7) - 0.5) * 0.1, 0, 0.999)
          glyph = RAMP[1 + Math.floor(dd * (RAMP.length - 1))]
          alpha = 0.92
        }
        // Petals get a faint fill so the head reads as one mass.
        if (k === KIND.petal || k === KIND.disc) {
          ctx.globalAlpha = 0.24 * v
          ctx.fillStyle = css(col)
          ctx.fillRect(c * cw, r * ch, cw, ch)
        }
        ctx.globalAlpha = alpha * clamp(v * 1.8, 0.45, 1)
        // Outlines print paler than the fill, more so at night, so dark petals keep their edge.
        var pale = k === KIND.disc ? 0 : edge && k === KIND.petal ? 0.22 + 0.33 * (p.night || 0) : 0.12
        ctx.fillStyle = css(mix(col, [255, 250, 240], pale))
        ctx.fillText(glyph, c * cw + cw / 2, r * ch + ch / 2 + 0.5)
      }
    ctx.globalAlpha = 1
  }

  function GlyphSpecimen(props) {
    var species = props.species || 'poppy'
    var ref = useRef(null)
    var opts = useRef({})
    var tick = useThemeTick()
    opts.current = { species: species, hour: props.hour, wind: props.wind === undefined ? 1 : props.wind, cell: props.cell || 9, stage: props.stage || 'bloom' }
    useEffect(
      function () {
        var canvas = ref.current
        if (!canvas) return
        var raf = 0
        var t0 = performance.now()
        function frame(now) {
          opts.current.palette = readPalette(canvas, opts.current.hour)
          renderSpecimen(canvas, opts.current, (now - t0) / 1000)
          if (!reducedMotion()) raf = requestAnimationFrame(frame)
        }
        raf = requestAnimationFrame(frame)
        return function () {
          cancelAnimationFrame(raf)
        }
      },
      [tick, species, props.cell, props.stage],
    )
    return h(
      'figure',
      { className: 'cm-specimen', style: { height: props.height || 300 } },
      h('canvas', { ref: ref, 'aria-hidden': true }),
      props.label ? h('figcaption', null, props.label) : null,
    )
  }

  // ── TimeDial ───────────────────────────────────────────────────────────

  function phaseName(hour) {
    if (hour < 4.5 || hour >= 21) return 'Night'
    if (hour < 8) return 'Dawn'
    if (hour < 12) return 'Morning'
    if (hour < 17) return 'Afternoon'
    if (hour < 18.4) return 'Golden hour'
    if (hour < 19.6) return 'Sunset'
    return 'Twilight'
  }
  function clock(hour) {
    var hh = Math.floor(hour) % 24
    var mm = Math.floor((hour % 1) * 60)
    return (hh < 10 ? '0' : '') + hh + ':' + (mm < 10 ? '0' : '') + mm
  }

  function TimeDial(props) {
    var own = useState(props.defaultValue === undefined ? 15 : props.defaultValue)
    var value = props.value === undefined ? own[0] : props.value
    var id = useRef('cm-time-' + Math.random().toString(36).slice(2, 7)).current
    // The track is the day's horizon, keyframe by keyframe, read from the scene tokens.
    var stops = KEYS.map(function (k) {
      return 'var(--' + k[1] + '-sky-horizon) ' + ((k[0] / 24) * 100).toFixed(1) + '%'
    }).join(',')
    function set(v) {
      if (props.value === undefined) own[1](v)
      if (props.onChange) props.onChange(v)
    }
    return h(
      'div',
      { className: 'cm-dial' },
      h(
        'div',
        { className: 'cm-dial-head' },
        h('label', { htmlFor: id }, 'Time'),
        h('span', { className: 'cm-dial-phase' }, phaseName(value)),
        h('output', { htmlFor: id }, clock(value)),
      ),
      h('div', { className: 'cm-dial-track', style: { background: 'linear-gradient(90deg,' + stops + ')' } }),
      h('input', {
        id: id,
        type: 'range',
        min: 0,
        max: 24,
        step: 0.05,
        value: value,
        onChange: function (e) {
          set(Number(e.target.value))
        },
      }),
      props.onLiveChange
        ? h(
            'label',
            { className: 'cm-check' },
            h('input', {
              type: 'checkbox',
              checked: !!props.live,
              onChange: function (e) {
                props.onLiveChange(e.target.checked)
              },
            }),
            'Follow my clock',
          )
        : null,
    )
  }

  // ── WindControl ────────────────────────────────────────────────────────

  function WindControl(props) {
    var own = useState(props.defaultValue === undefined ? 1 : props.defaultValue)
    var value = props.value === undefined ? own[0] : props.value
    var ref = useRef(null)
    var live = useRef(value)
    live.current = value
    var hourRef = useRef(props.hour)
    hourRef.current = props.hour
    var id = useRef('cm-wind-' + Math.random().toString(36).slice(2, 7)).current
    var tick = useThemeTick()
    useEffect(
      function () {
        var canvas = ref.current
        var raf = 0
        var t0 = performance.now()
        function frame(now) {
          var t = (now - t0) / 1000
          var dpr = Math.min(window.devicePixelRatio || 1, 2)
          var W = canvas.clientWidth
          var H = canvas.clientHeight
          canvas.width = Math.round(W * dpr)
          canvas.height = Math.round(H * dpr)
          var ctx = canvas.getContext('2d')
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
          var p = readPalette(canvas, hourRef.current)
          ctx.font = '500 11px "IBM Plex Mono", ui-monospace, monospace'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          var cw = 7
          var cols = Math.floor(W / cw)
          // A strip of blades: gust bands roll left to right and turn the blades pale as they bend.
          for (var c = 0; c < cols; c++) {
            var gust = Math.max(0, noise1(c / 9 - t * 1.4, 4) * 1.3 + 0.2)
            var bend = live.current * (0.25 + gust)
            var tall = 2 + Math.floor(hash(c, 1, 2) * 2)
            for (var r = 0; r < tall; r++) {
              var lean = bend * ((r + 1) / tall)
              var g = lean < 0.3 ? '|' : lean < 1.1 ? '/' : r === tall - 1 ? '_' : '/'
              ctx.fillStyle = css(mix(p['grass-dark'], p['grass-light'], clamp(0.25 + bend * 0.45, 0, 1)))
              ctx.fillText(g, c * cw + cw / 2 + lean * 2, H - 6 - r * 9)
            }
          }
          if (!reducedMotion()) raf = requestAnimationFrame(frame)
        }
        raf = requestAnimationFrame(frame)
        return function () {
          cancelAnimationFrame(raf)
        }
      },
      [tick],
    )
    return h(
      'div',
      { className: 'cm-wind' },
      h('div', { className: 'cm-dial-head' }, h('label', { htmlFor: id }, 'Wind'), h('output', { htmlFor: id }, value === 0 ? 'Still' : value < 0.6 ? 'Breeze' : value < 1.6 ? 'Gusts' : 'Gale')),
      h('canvas', { ref: ref, className: 'cm-wind-strip', 'aria-hidden': true }),
      h('input', {
        id: id,
        type: 'range',
        min: 0,
        max: 2.5,
        step: 0.05,
        value: value,
        onChange: function (e) {
          var v = Number(e.target.value)
          if (props.value === undefined) own[1](v)
          if (props.onChange) props.onChange(v)
        },
      }),
    )
  }

  // ── ControlPanel ───────────────────────────────────────────────────────

  function localHour() {
    var d = new Date()
    return d.getHours() + d.getMinutes() / 60
  }
  function ControlPanel(props) {
    // Follows the viewer's clock until the time is moved; the time is also the light/dark control.
    var hour = useState(props.hour === undefined ? localHour() : props.hour)
    var wind = useState(props.wind === undefined ? 1 : props.wind)
    var live = useState(props.hour === undefined)
    var text = useState(true)
    function setHour(v) {
      hour[1](v)
      live[1](false)
      if (props.onHour) props.onHour(v)
      if (props.onPage) props.onPage(pageFor(v))
    }
    return h(
      'form',
      {
        className: 'cm-panel',
        onSubmit: function (e) {
          e.preventDefault()
        },
      },
      h(TimeDial, {
        value: hour[0],
        onChange: setHour,
        live: live[0],
        onLiveChange: function (v) {
          live[1](v)
          if (v) {
            var hh = localHour()
            hour[1](hh)
            if (props.onHour) props.onHour(hh)
            if (props.onPage) props.onPage(pageFor(hh))
          }
        },
      }),
      h(WindControl, {
        value: wind[0],
        hour: hour[0],
        onChange: function (v) {
          wind[1](v)
          if (props.onWind) props.onWind(v)
        },
      }),
      h(
        'label',
        { className: 'cm-check' },
        h('input', {
          type: 'checkbox',
          checked: text[0],
          onChange: function (e) {
            text[1](e.target.checked)
            if (props.onText) props.onText(e.target.checked)
          },
        }),
        'Show text',
      ),

      h(
        'div',
        { className: 'cm-buttons' },
        h('button', { type: 'button', className: 'cm-button', onClick: props.onRegrow }, 'Regrow'),
        h('button', { type: 'button', className: 'cm-button', onClick: props.onHide, title: 'Press H' }, 'Hide'),
      ),
    )
  }

  // ── HeroText: the bio on the home page ─────────────────────────────────

  // The home page: sky, ridge and grass full bleed, the bio straight on it in light ink.
  // Grass near the text thins, the same rule the koi pond uses for fish under its text.
  // `veil` (0 to 1) shows the hand-off to another page: page colour closing in from the edges.
  function HeroText(props) {
    var links = props.links || []
    var wrap = useRef(null)
    var text = useRef(null)
    var canvas = useRef(null)
    var tick = useThemeTick()
    var garden = props.garden !== false
    var hourRef = useRef(props.hour)
    hourRef.current = props.hour
    var veilRef = useRef(props.veil || 0)
    veilRef.current = props.veil || 0
    useEffect(
      function () {
        if (!garden) return
        var raf = 0
        var t0 = performance.now()
        function frame(now) {
          var cv = canvas.current
          var box = wrap.current
          var tx = text.current
          if (!cv || !box || !tx) return
          var t = (now - t0) / 1000
          var dpr = Math.min(window.devicePixelRatio || 1, 2)
          var W = box.clientWidth
          var H = box.clientHeight
          cv.width = Math.round(W * dpr)
          cv.height = Math.round(H * dpr)
          var ctx = cv.getContext('2d')
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
          var p = readPalette(cv, hourRef.current)
          var ob = box.getBoundingClientRect()
          var tb = tx.getBoundingClientRect()
          var L = tb.left - ob.left
          var T = tb.top - ob.top
          var R = tb.right - ob.left
          var B = tb.bottom - ob.top
          // Horizon just above the text, so the bio sits on the ground.
          var hz = clamp((T - 24) / H, 0.25, 0.6)
          paintScene(ctx, W, H, p, hz)
          // One low ridge across the horizon.
          ctx.beginPath()
          ctx.moveTo(0, H * hz)
          for (var x0 = 0; x0 <= W; x0 += 8) ctx.lineTo(x0, H * hz - H * (0.05 + 0.04 * noise1(x0 / 260, 5)))
          ctx.lineTo(W, H * hz + 4)
          ctx.lineTo(0, H * hz + 4)
          ctx.closePath()
          ctx.fillStyle = css(mix(p['hill-far'], p['sky-horizon'], 0.3))
          ctx.fill()
          var cw = 7
          var ch = 9
          var pad = cw * 14
          ctx.font = '500 7px "IBM Plex Mono", ui-monospace, monospace'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          var cols = Math.ceil(W / cw)
          var rows = Math.ceil(H / ch)
          for (var r = 0; r < rows; r++)
            for (var c = 0; c < cols; c++) {
              var x = c * cw + cw / 2
              var y = r * ch + ch / 2
              if (y < H * hz) continue
              // Sparse: grass is texture, not subject.
              if (hash(c, r, 3) > 0.22) continue
              var d = Math.hypot(Math.max(L - x, 0, x - R), Math.max(T - y, 0, y - B))
              var a = 0.6 * (0.22 + 0.78 * smooth(0, pad, d))
              var gust = Math.max(0, noise1(c / 10 - t * 1.2, 6) * 1.3 + 0.2)
              var glyph = gust > 0.9 ? '/' : hash(c, r, 9) < 0.2 ? ':' : '|'
              ctx.globalAlpha = a
              ctx.fillStyle = css(mix(p['grass-dark'], p['grass-light'], clamp(0.3 + gust * 0.4, 0, 1)))
              ctx.fillText(glyph, x, y)
            }
          ctx.globalAlpha = 1
          paintVeil(ctx, W, H, p.page, easeInOut(clamp(veilRef.current, 0, 1)))
          if (!reducedMotion()) raf = requestAnimationFrame(frame)
        }
        raf = requestAnimationFrame(frame)
        return function () {
          cancelAnimationFrame(raf)
        }
      },
      [tick, garden],
    )
    return h(
      'section',
      {
        className: 'cm-hero',
        ref: wrap,
        // The bio leaves before the veil closes over it and returns once the scene is mostly back.
        'data-veiled': (props.veil || 0) > 0.3 ? '' : undefined,
        style: props.height ? { height: props.height } : null,
      },
      garden ? h('canvas', { ref: canvas, className: 'cm-hero-garden', 'aria-hidden': true }) : null,
      h(
        'div',
        { className: 'cm-hero-text', ref: text },
        props.children ? h('div', { className: 'body' }, props.children) : null,
        links.length
          ? h(
              'nav',
              { className: 'cm-links' },
              links.map(function (l, i) {
                return h(
                  React.Fragment,
                  { key: l.href },
                  i ? h('span', { 'aria-hidden': true }, '/') : null,
                  h('a', { href: l.href, target: '_blank', rel: 'noopener noreferrer', className: 'cm-link' }, l.label),
                )
              }),
            )
          : null,
      ),
    )
  }

  // ── GlyphRamp ──────────────────────────────────────────────────────────

  var MATERIALS = [
    { name: 'Petal', token: 'day-poppy', ramp: " .':-=+*x#%@", note: 'Interiors stay light; the colour comes from a faint tile behind' },
    { name: 'Outline', token: 'day-fluff', ramp: '- \\ | /', note: 'Along the contour of petals, stalks and wires: the silhouette carries the species' },
    { name: 'Centre', token: 'day-dandelion', ramp: ' .o0O@#', note: 'In the disc colour: always the darkest, densest mark in a head' },
    { name: 'Foliage', token: 'day-grass-light', ramp: " .,':;!|", note: 'Grass and leaves; quiet, fading toward the viewer' },
    { name: 'Seed', token: 'day-fluff', ramp: " .'*+x*#", note: 'Clocks, pappus, umbel florets, fireflies' },
    { name: 'Land', token: 'day-cloud', ramp: ' .·:', note: 'Ordered-dither halftone over painted hills' },
    { name: 'Cloud', token: 'day-cloud', ramp: ' ·.:-=+*o', note: 'Dithered cumulus, lit from above' },
  ]
  function GlyphRamp(props) {
    var rows = props.materials
      ? MATERIALS.filter(function (m) {
          return props.materials.indexOf(m.name) >= 0
        })
      : MATERIALS
    return h(
      'table',
      { className: 'cm-ramps' },
      h(
        'tbody',
        null,
        rows.map(function (m) {
          return h(
            'tr',
            { key: m.name },
            h('th', { scope: 'row' }, m.name),
            // Glyphs print on the scene's ground, as they do in the garden.
            h('td', { className: 'cm-ramp-glyphs', style: { color: 'var(--' + m.token + ')' } }, m.ramp),
            h('td', { className: 'cm-ramp-note' }, m.note),
          )
        }),
      ),
    )
  }

  window.Meadow = Object.assign(window.Meadow || {}, {
    GlyphSpecimen: GlyphSpecimen,
    TimeDial: TimeDial,
    WindControl: WindControl,
    ControlPanel: ControlPanel,
    HeroText: HeroText,
    GlyphRamp: GlyphRamp,
    pageFor: pageFor,
    paintVeil: paintVeil,
    veilOrder: veilOrder,
  })
})()
