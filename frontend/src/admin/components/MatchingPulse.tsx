import { useEffect, useRef } from 'react'

/* Decorative header band for the Matching page — a sibling of the public
   pages' LifeBackground bloodstream. Two gold particle streams flow in from
   the left and right (the two halves of a couple) and converge on a beating
   heart at the center. The heartbeat drives flow through the same
   Windkessel-style compliance lag as LifeBackground, and all motion runs on
   accumulated simulation time so dropped frames never cause jumps.

   The `state` prop shifts the whole system's energy:
     idle    — slow, faint, resting pulse
     running — fast flow, elevated heart rate, sparks where streams meet
     done    — celebration burst (rings + spark spray), then settles

   Honors prefers-reduced-motion (static frame) and pauses when hidden. */

export type PulseState = 'idle' | 'running' | 'done'

interface Props {
  state: PulseState
  className?: string
}

type Vec = readonly [number, number]
interface Vein { p0: Vec; p1: Vec; p2: Vec; p3: Vec }

// Left-side vessels, ending at the heart (0.5, 0.5); right side is mirrored
const LEFT_VEINS: Vein[] = [
  { p0: [-0.06, 0.18], p1: [0.16, 0.04], p2: [0.3, 0.84], p3: [0.5, 0.5] },
  { p0: [-0.06, 0.84], p1: [0.2, 1.02], p2: [0.34, 0.24], p3: [0.5, 0.5] },
]
const mirror = (v: Vein): Vein => ({
  p0: [1 - v.p0[0], v.p0[1]],
  p1: [1 - v.p1[0], v.p1[1]],
  p2: [1 - v.p2[0], v.p2[1]],
  p3: [1 - v.p3[0], v.p3[1]],
})
const VEINS: Vein[] = [...LEFT_VEINS, ...LEFT_VEINS.map(mirror)]

// lub-dub pressure envelope over one beat cycle, phase ∈ [0,1) → [0,1]
function beatPulse(phase: number): number {
  const bump = (c: number, w: number) => Math.exp(-((phase - c) * (phase - c)) / (2 * w * w))
  return Math.min(1, bump(0.08, 0.07) + 0.6 * bump(0.32, 0.09))
}

function veinPoint(v: Vein, t: number, w: number, h: number): [number, number] {
  const u = 1 - t
  const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t
  return [
    (a * v.p0[0] + b * v.p1[0] + c * v.p2[0] + d * v.p3[0]) * w,
    (a * v.p0[1] + b * v.p1[1] + c * v.p2[1] + d * v.p3[1]) * h,
  ]
}

function veinDeriv(v: Vein, t: number, w: number, h: number): [number, number] {
  const u = 1 - t
  return [
    (3 * u * u * (v.p1[0] - v.p0[0]) + 6 * u * t * (v.p2[0] - v.p1[0]) + 3 * t * t * (v.p3[0] - v.p2[0])) * w,
    (3 * u * u * (v.p1[1] - v.p0[1]) + 6 * u * t * (v.p2[1] - v.p1[1]) + 3 * t * t * (v.p3[1] - v.p2[1])) * h,
  ]
}

interface Particle {
  vein: number
  t: number
  jitter: number
  depth: number
  size: number
  wobble: number
  phase: number
  sprite: number
}

interface Spark {
  x: number; y: number
  vx: number; vy: number
  life: number
  size: number
  sprite: number
}

interface Ring { r: number; v: number; alpha: number }

// Pre-rendered soft glow blob — far cheaper than per-particle shadowBlur
function makeSprite(r: number, g: number, b: number): HTMLCanvasElement {
  const s = document.createElement('canvas')
  s.width = s.height = 64
  const c = s.getContext('2d')
  if (c) {
    const grad = c.createRadialGradient(32, 32, 0, 32, 32, 32)
    grad.addColorStop(0, `rgba(${r},${g},${b},0.9)`)
    grad.addColorStop(0.35, `rgba(${r},${g},${b},0.4)`)
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`)
    c.fillStyle = grad
    c.fillRect(0, 0, 64, 64)
  }
  return s
}

function makeParticles(count: number): Particle[] {
  const list: Particle[] = []
  for (let i = 0; i < count; i++) {
    const depth = 0.2 + Math.random() * 0.8
    list.push({
      vein: i % VEINS.length,
      t: Math.random(),
      jitter: 0.8 + Math.random() * 0.6,
      depth,
      size: 1.1 + depth * 2.4,
      wobble: 0.5 + Math.random() * 1.1,
      phase: Math.random() * Math.PI * 2,
      // mostly gold, a few deep-gold and warm-rose for "blood" warmth
      sprite: Math.random() < 0.62 ? 0 : Math.random() < 0.6 ? 1 : 2,
    })
  }
  return list
}

// Per-state energy targets: beat period (s), flow gain, overall brightness
const STATE_PARAMS: Record<PulseState, { beatS: number; gain: number; glow: number }> = {
  idle:    { beatS: 2.1,  gain: 0.5,  glow: 0.55 },
  running: { beatS: 0.95, gain: 1.6,  glow: 1 },
  done:    { beatS: 1.7,  gain: 0.75, glow: 0.85 },
}

export default function MatchingPulse({ state, className = '' }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef<PulseState>(state)
  const burstRef = useRef(0) // increments to request a celebration burst
  const redrawRef = useRef<(() => void) | null>(null)

  // Track state changes; a running → done transition queues the burst
  useEffect(() => {
    if (stateRef.current === 'running' && state === 'done') burstRef.current++
    stateRef.current = state
    redrawRef.current?.() // reduced-motion: repaint the static frame
  }, [state])

  useEffect(() => {
    const wrap = wrapRef.current
    const canvas = canvasRef.current
    if (!wrap || !canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return // jsdom / unsupported

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const sprites = [
      makeSprite(201, 169, 110), // gold (--t-accent)
      makeSprite(176, 125, 46), //  deep gold (--t-warning)
      makeSprite(209, 106, 86), //  warm rose
    ]
    const particles = makeParticles(40)
    const sparks: Spark[] = []
    const rings: Ring[] = []

    let w = 0
    let h = 0
    let raf = 0
    let lastTime = 0
    let simTime = 0
    let flow = 0.5
    let beatS = STATE_PARAMS[stateRef.current].beatS
    let gain = STATE_PARAMS[stateRef.current].gain
    let glow = STATE_PARAMS[stateRef.current].glow
    let beatPhase = 0
    let pop = 0 // heart pop on celebration, decays to 0
    let burstSeen = burstRef.current

    function resize() {
      const rect = wrap!.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      w = rect.width
      h = rect.height
      canvas!.width = Math.round(w * dpr)
      canvas!.height = Math.round(h * dpr)
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
      if (reduceMotion) drawFrame(0, 0.55, 0.4)
    }

    function drawVeins(flowNorm: number) {
      ctx!.lineCap = 'round'
      for (const v of VEINS) {
        ctx!.beginPath()
        ctx!.moveTo(v.p0[0] * w, v.p0[1] * h)
        ctx!.bezierCurveTo(v.p1[0] * w, v.p1[1] * h, v.p2[0] * w, v.p2[1] * h, v.p3[0] * w, v.p3[1] * h)
        for (const [lw, a] of [[42, 0.018], [20, 0.026], [7, 0.038]] as const) {
          ctx!.lineWidth = lw
          ctx!.strokeStyle = `rgba(201,169,110,${a * glow * (0.85 + 0.45 * flowNorm)})`
          ctx!.stroke()
        }
      }
    }

    function drawHeart(cx: number, cy: number, s: number, alpha: number) {
      ctx!.save()
      ctx!.globalAlpha = alpha
      ctx!.beginPath()
      ctx!.moveTo(cx, cy + s * 0.62)
      ctx!.bezierCurveTo(cx - s, cy - s * 0.1, cx - s * 0.42, cy - s * 0.78, cx, cy - s * 0.22)
      ctx!.bezierCurveTo(cx + s * 0.42, cy - s * 0.78, cx + s, cy - s * 0.1, cx, cy + s * 0.62)
      const grad = ctx!.createLinearGradient(cx, cy - s, cx, cy + s)
      grad.addColorStop(0, 'rgba(214,181,126,0.95)')
      grad.addColorStop(1, 'rgba(176,125,46,0.9)')
      ctx!.fillStyle = grad
      ctx!.fill()
      ctx!.restore()
    }

    function spawnSpark(cx: number, cy: number, speed: number) {
      if (sparks.length > 90) return
      const ang = Math.random() * Math.PI * 2
      const v = speed * (0.4 + Math.random() * 0.9)
      sparks.push({
        x: cx, y: cy,
        vx: Math.cos(ang) * v,
        vy: Math.sin(ang) * v - speed * 0.2,
        life: 1,
        size: 1 + Math.random() * 2,
        sprite: Math.random() < 0.7 ? 0 : 2,
      })
    }

    function celebrate(cx: number, cy: number) {
      pop = 1
      rings.push({ r: 6, v: 90, alpha: 0.5 }, { r: 2, v: 60, alpha: 0.35 })
      for (let i = 0; i < 26; i++) spawnSpark(cx, cy, 70)
    }

    // Advances the sim by dt (0 = render only) and paints the frame
    function drawFrame(dt: number, flowVal: number, flowNorm: number) {
      ctx!.clearRect(0, 0, w, h)
      drawVeins(flowNorm)

      const cx = w / 2
      const cy = h / 2
      const running = stateRef.current === 'running'

      // stream particles
      for (const p of particles) {
        const vein = VEINS[p.vein]
        if (dt > 0) {
          const [dx0, dy0] = veinDeriv(vein, p.t, w, h)
          const arc = Math.max(Math.hypot(dx0, dy0), 40)
          const vel = (46 + 80 * p.depth) * p.jitter * (0.3 + 0.85 * flowVal * gain)
          p.t += (vel * dt) / arc
          if (p.t > 1) {
            // the stream dissolves into the heart; sparks only while working
            if (running && Math.random() < 0.5) spawnSpark(cx, cy, 34)
            p.t = 0
            p.phase = Math.random() * Math.PI * 2
          }
        }
        const [bx, by] = veinPoint(vein, p.t, w, h)
        const [dx, dy] = veinDeriv(vein, p.t, w, h)
        const m = Math.hypot(dx, dy) || 1
        const swing = Math.sin(simTime * p.wobble + p.phase) * (3 + 5 * (1 - p.depth * 0.5))
        const x = bx + (-dy / m) * swing
        const y = by + (dx / m) * swing
        // fade out as the particle merges into the heart
        const merge = p.t > 0.88 ? 1 - (p.t - 0.88) / 0.12 : 1
        const size = p.size * (1 + 0.14 * flowNorm * p.depth)
        ctx!.globalAlpha = (0.2 + 0.45 * p.depth) * (0.7 + 0.4 * flowNorm) * glow * merge
        ctx!.drawImage(sprites[p.sprite], x - size * 3, y - size * 3, size * 6, size * 6)
      }

      // sparks
      for (let i = sparks.length - 1; i >= 0; i--) {
        const sp = sparks[i]
        if (dt > 0) {
          sp.x += sp.vx * dt
          sp.y += sp.vy * dt
          sp.vx *= Math.exp(-1.6 * dt)
          sp.vy *= Math.exp(-1.6 * dt)
          sp.life -= dt * 1.3
          if (sp.life <= 0) { sparks.splice(i, 1); continue }
        }
        const sz = sp.size * (0.6 + 0.4 * sp.life)
        ctx!.globalAlpha = sp.life * 0.7
        ctx!.drawImage(sprites[sp.sprite], sp.x - sz * 3, sp.y - sz * 3, sz * 6, sz * 6)
      }

      // celebration rings
      for (let i = rings.length - 1; i >= 0; i--) {
        const ring = rings[i]
        if (dt > 0) {
          ring.r += ring.v * dt
          ring.alpha -= dt * 0.55
          if (ring.alpha <= 0) { rings.splice(i, 1); continue }
        }
        ctx!.globalAlpha = 1
        ctx!.beginPath()
        ctx!.arc(cx, cy, ring.r, 0, Math.PI * 2)
        ctx!.lineWidth = 1.5
        ctx!.strokeStyle = `rgba(201,169,110,${Math.max(ring.alpha, 0)})`
        ctx!.stroke()
      }

      // heart: glow halo + beating shape
      const heartScale = (9 + h * 0.04) * (1 + 0.22 * flowNorm + 0.45 * pop)
      const halo = heartScale * (3.2 + 1.4 * flowNorm)
      ctx!.globalAlpha = (0.3 + 0.5 * flowNorm) * glow
      ctx!.drawImage(sprites[0], cx - halo, cy - halo, halo * 2, halo * 2)
      ctx!.globalAlpha = 1
      drawHeart(cx, cy, heartScale, (0.75 + 0.25 * flowNorm) * Math.min(glow + 0.25, 1))
    }

    function tick(now: number) {
      const dt = lastTime ? Math.min((now - lastTime) / 1000, 1 / 20) : 1 / 60
      lastTime = now
      simTime += dt

      // ease the per-state energy targets so transitions feel organic
      const target = STATE_PARAMS[stateRef.current]
      const ease = 1 - Math.exp(-3 * dt)
      beatS += (target.beatS - beatS) * ease
      gain += (target.gain - gain) * ease
      glow += (target.glow - glow) * ease

      if (burstRef.current !== burstSeen) {
        burstSeen = burstRef.current
        celebrate(w / 2, h / 2)
      }
      pop = Math.max(0, pop - dt * 1.6)

      // pressure wave from the beat; flow follows with vascular compliance
      beatPhase = (beatPhase + dt / beatS) % 1
      const pressure = 0.35 + beatPulse(beatPhase)
      flow += (pressure - flow) * (1 - Math.exp(-5 * dt))
      const flowNorm = Math.min(Math.max((flow - 0.4) / 0.5, 0), 1)

      drawFrame(dt, flow, flowNorm)
      raf = requestAnimationFrame(tick)
    }

    function onVisibility() {
      if (document.hidden) {
        cancelAnimationFrame(raf)
      } else {
        lastTime = 0
        raf = requestAnimationFrame(tick)
      }
    }

    redrawRef.current = reduceMotion ? () => drawFrame(0, 0.55, 0.4) : null

    window.addEventListener('resize', resize)
    resize()

    if (!reduceMotion) {
      raf = requestAnimationFrame(tick)
      document.addEventListener('visibilitychange', onVisibility)
    }

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', onVisibility)
      redrawRef.current = null
    }
  }, [])

  return (
    <div
      ref={wrapRef}
      aria-hidden="true"
      className={`overflow-hidden pointer-events-none select-none ${className}`}
    >
      {/* warm atmosphere behind the stream */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(60% 80% at 50% 45%, color-mix(in srgb, var(--t-accent) 12%, transparent), transparent 72%)',
        }}
      />
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
    </div>
  )
}
