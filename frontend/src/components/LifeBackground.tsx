import { useEffect, useRef } from 'react'

/* Animated "alive" backdrop for the public pages: a canvas bloodstream of
   warm gold particles whose flow surges in a heartbeat rhythm. Pointer
   parallax adds depth on fine-pointer devices. Honors prefers-reduced-motion
   (single static frame, no surge, no parallax) and pauses while the tab is
   hidden. `fixed` pins the layer to the viewport for long scrolling pages. */

const BEAT_MS = 1875 // ~64 bpm — the pulse driving the flow surges

// lub-dub envelope over one beat cycle, phase ∈ [0,1) → pulse ∈ [0,1]
function beatPulse(phase: number): number {
  const bump = (c: number, w: number) => Math.exp(-((phase - c) * (phase - c)) / (2 * w * w))
  return Math.min(1, bump(0.08, 0.045) + 0.65 * bump(0.3, 0.06))
}

type Vec = readonly [number, number]
interface Vein { p0: Vec; p1: Vec; p2: Vec; p3: Vec }

// Normalized cubic béziers flowing across the viewport — the "vessels"
const VEINS: Vein[] = [
  { p0: [-0.08, 0.74], p1: [0.28, 0.52], p2: [0.6, 0.96], p3: [1.08, 0.68] },
  { p0: [-0.08, 0.26], p1: [0.34, 0.44], p2: [0.66, 0.1], p3: [1.08, 0.32] },
  { p0: [-0.08, 0.52], p1: [0.42, 0.72], p2: [0.58, 0.34], p3: [1.08, 0.5] },
]

function veinPoint(v: Vein, t: number, w: number, h: number): [number, number] {
  const u = 1 - t
  const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t
  return [
    (a * v.p0[0] + b * v.p1[0] + c * v.p2[0] + d * v.p3[0]) * w,
    (a * v.p0[1] + b * v.p1[1] + c * v.p2[1] + d * v.p3[1]) * h,
  ]
}

interface Particle {
  vein: number
  t: number
  speed: number
  depth: number // 0 = far, 1 = near
  size: number
  wobble: number
  phase: number
  sprite: number
}

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
    const depth = 0.15 + Math.random() * 0.85
    list.push({
      vein: i % VEINS.length,
      t: Math.random(),
      speed: 0.035 + Math.random() * 0.04,
      depth,
      size: 1.2 + depth * 2.8,
      wobble: 0.6 + Math.random() * 1.4,
      phase: Math.random() * Math.PI * 2,
      // mostly gold, a few deep-gold and warm-rose for "blood" warmth
      sprite: Math.random() < 0.62 ? 0 : Math.random() < 0.6 ? 1 : 2,
    })
  }
  return list
}

const GRAIN =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E" +
  "%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E" +
  "%3Crect width='160' height='160' filter='url(%23n)' opacity='0.6'/%3E%3C/svg%3E"

interface Props {
  /** Pin to the viewport instead of filling the nearest positioned ancestor */
  fixed?: boolean
}

export default function LifeBackground({ fixed = false }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const wrap = wrapRef.current
    const canvas = canvasRef.current
    if (!wrap || !canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return // jsdom / unsupported

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const finePointer = window.matchMedia('(pointer: fine)').matches

    const sprites = [
      makeSprite(201, 169, 110), // gold (--t-accent)
      makeSprite(176, 125, 46), //  deep gold (--t-warning)
      makeSprite(209, 106, 86), //  warm rose — the faint blood note
    ]
    const particles = makeParticles(64)

    let w = 0
    let h = 0
    let raf = 0
    let lastTime = 0
    // pointer parallax, smoothed each frame
    let targetPX = 0, targetPY = 0, px = 0, py = 0

    function resize() {
      const rect = wrap!.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      w = rect.width
      h = rect.height
      canvas!.width = Math.round(w * dpr)
      canvas!.height = Math.round(h * dpr)
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
      if (reduceMotion) drawFrame(0, 0.25)
    }

    function drawVeins(pulse: number) {
      ctx!.lineCap = 'round'
      for (const v of VEINS) {
        ctx!.beginPath()
        ctx!.moveTo(v.p0[0] * w, v.p0[1] * h)
        ctx!.bezierCurveTo(v.p1[0] * w, v.p1[1] * h, v.p2[0] * w, v.p2[1] * h, v.p3[0] * w, v.p3[1] * h)
        for (const [lw, a] of [[64, 0.016], [30, 0.022], [10, 0.032]] as const) {
          ctx!.lineWidth = lw
          ctx!.strokeStyle = `rgba(201,169,110,${a * (0.85 + 0.5 * pulse)})`
          ctx!.stroke()
        }
      }
    }

    function drawFrame(now: number, pulse: number) {
      ctx!.clearRect(0, 0, w, h)
      drawVeins(pulse)
      for (const p of particles) {
        const [bx, by] = veinPoint(VEINS[p.vein], p.t, w, h)
        const x = bx + px * 22 * p.depth
        const y = by + Math.sin(now * 0.001 * p.wobble + p.phase) * 12 + py * 14 * p.depth
        const size = p.size * (1 + 0.18 * pulse * p.depth)
        ctx!.globalAlpha = (0.18 + 0.42 * p.depth) * (0.8 + 0.35 * pulse)
        ctx!.drawImage(sprites[p.sprite], x - size * 3, y - size * 3, size * 6, size * 6)
      }
      ctx!.globalAlpha = 1
    }

    function tick(now: number) {
      const dt = lastTime ? Math.min((now - lastTime) / 1000, 0.05) : 0.016
      lastTime = now
      const pulse = beatPulse((now % BEAT_MS) / BEAT_MS)

      px += (targetPX - px) * 0.06
      py += (targetPY - py) * 0.06

      for (const p of particles) {
        // blood is pushed in surges: flow speed follows the beat envelope
        p.t += p.speed * dt * (0.55 + 1.1 * pulse) * (0.5 + p.depth)
        if (p.t > 1.04) {
          p.t = -0.04
          p.phase = Math.random() * Math.PI * 2
        }
      }

      drawFrame(now, pulse)
      raf = requestAnimationFrame(tick)
    }

    function onPointerMove(e: PointerEvent) {
      targetPX = (e.clientX / window.innerWidth) * 2 - 1
      targetPY = (e.clientY / window.innerHeight) * 2 - 1
    }

    function onVisibility() {
      if (document.hidden) {
        cancelAnimationFrame(raf)
      } else {
        lastTime = 0
        raf = requestAnimationFrame(tick)
      }
    }

    const ro = new ResizeObserver(resize)
    ro.observe(wrap)
    resize()

    if (!reduceMotion) {
      raf = requestAnimationFrame(tick)
      document.addEventListener('visibilitychange', onVisibility)
      if (finePointer) window.addEventListener('pointermove', onPointerMove, { passive: true })
    }

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pointermove', onPointerMove)
    }
  }, [])

  return (
    <div
      ref={wrapRef}
      aria-hidden="true"
      className={`${fixed ? 'fixed' : 'absolute'} inset-0 overflow-hidden pointer-events-none select-none`}
    >
      {/* warm atmosphere */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(60% 50% at 72% 16%, color-mix(in srgb, var(--t-accent) 13%, transparent), transparent 70%),' +
            'radial-gradient(50% 42% at 12% 88%, color-mix(in srgb, var(--t-accent) 9%, transparent), transparent 70%)',
        }}
      />

      {/* bloodstream particles */}
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      {/* film grain for texture */}
      <div className="absolute inset-0 opacity-[0.05] mix-blend-multiply" style={{ backgroundImage: `url("${GRAIN}")` }} />
    </div>
  )
}
