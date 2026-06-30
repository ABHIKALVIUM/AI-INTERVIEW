import { useEffect, useRef, useCallback } from 'react';

type WaveformMode = 'idle' | 'listening' | 'speaking';

interface WaveformVisualiserProps {
  isActive: boolean;
  mode: WaveformMode;
}

const COLOR_MAP: Record<WaveformMode, { primary: string; secondary: string; glow: string }> = {
  idle: { primary: '#475569', secondary: '#334155', glow: 'rgba(71,85,105,0)' },
  listening: { primary: '#10b981', secondary: '#059669', glow: 'rgba(16,185,129,0.35)' },
  speaking: { primary: '#6366f1', secondary: '#8b5cf6', glow: 'rgba(99,102,241,0.45)' },
};

const BAR_COUNT = 64;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export default function WaveformVisualiser({ isActive, mode }: WaveformVisualiserProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const barsRef = useRef<Float32Array>(new Float32Array(BAR_COUNT).fill(0));
  const timeRef = useRef<number>(0);
  const modeRef = useRef<WaveformMode>(mode);

  // Keep modeRef in sync
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  // Color interpolation state
  const currentColorsRef = useRef({ primary: [71, 85, 105], secondary: [51, 65, 85], alpha: 0 });

  const parseHexToRGB = (hex: string): [number, number, number] => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return [r, g, b];
  };

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const currentMode = modeRef.current;
    const colors = COLOR_MAP[currentMode];

    timeRef.current += 0.02;
    const t = timeRef.current;

    // Smooth color transition
    const targetRGB = parseHexToRGB(colors.primary);
    const currColors = currentColorsRef.current;
    currColors.primary[0] = lerp(currColors.primary[0], targetRGB[0], 0.05);
    currColors.primary[1] = lerp(currColors.primary[1], targetRGB[1], 0.05);
    currColors.primary[2] = lerp(currColors.primary[2], targetRGB[2], 0.05);

    // Clear with subtle trail effect
    ctx.fillStyle = 'rgba(2,6,23,0.85)';
    ctx.fillRect(0, 0, W, H);

    // ── Get audio data ──────────────────────────────────────────────────────
    let dataArray: Uint8Array | null = null;
    if (analyserRef.current && currentMode === 'listening') {
      const arr = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(arr);
      dataArray = arr;
    }

    // ── Update bar heights ──────────────────────────────────────────────────
    const bars = barsRef.current;
    for (let i = 0; i < BAR_COUNT; i++) {
      let target = 0;

      if (currentMode === 'idle') {
        // Slow sinusoidal breathing animation
        const phase = (i / BAR_COUNT) * Math.PI * 2;
        target = (Math.sin(t * 0.8 + phase) * 0.5 + 0.5) * 0.15 + 0.02;
      } else if (currentMode === 'listening' && dataArray) {
        // Map frequency bins to bars
        const binIndex = Math.floor((i / BAR_COUNT) * (analyserRef.current!.frequencyBinCount / 2));
        const raw = dataArray[binIndex] / 255;
        // Apply perceptual weighting (boost mids)
        const weight = Math.sin((i / BAR_COUNT) * Math.PI) * 0.6 + 0.4;
        target = Math.pow(raw * weight, 0.7);
      } else if (currentMode === 'speaking') {
        // Smooth animated wave simulating TTS output
        const phase = (i / BAR_COUNT) * Math.PI * 4;
        const wave1 = Math.sin(t * 2.5 + phase) * 0.5 + 0.5;
        const wave2 = Math.sin(t * 1.8 - phase * 0.7) * 0.5 + 0.5;
        const wave3 = Math.sin(t * 3.2 + phase * 0.3) * 0.5 + 0.5;
        target = ((wave1 * 0.5 + wave2 * 0.3 + wave3 * 0.2) * 0.7 + 0.05);
      }

      // Smooth lerp toward target
      const speed = currentMode === 'idle' ? 0.06 : 0.18;
      bars[i] = lerp(bars[i], target, speed);
    }

    // ── Draw bars ───────────────────────────────────────────────────────────
    const barWidth = W / BAR_COUNT;
    const maxBarH = H * 0.82;
    const centerY = H / 2;

    const [r, g, b] = currColors.primary;

    for (let i = 0; i < BAR_COUNT; i++) {
      const barH = bars[i] * maxBarH;
      const x = i * barWidth;
      const bw = barWidth * 0.65;
      const bx = x + (barWidth - bw) / 2;

      // Opacity variation for depth
      const alpha = 0.4 + bars[i] * 0.6;

      // ── Gradient fill ────────────────────────────────────────────────────
      const gradient = ctx.createLinearGradient(0, centerY - barH / 2, 0, centerY + barH / 2);
      gradient.addColorStop(0, `rgba(${r},${g},${b},${alpha * 0.4})`);
      gradient.addColorStop(0.3, `rgba(${r},${g},${b},${alpha})`);
      gradient.addColorStop(0.5, `rgba(${r},${g},${b},${Math.min(1, alpha * 1.2)})`);
      gradient.addColorStop(0.7, `rgba(${r},${g},${b},${alpha})`);
      gradient.addColorStop(1, `rgba(${r},${g},${b},${alpha * 0.4})`);

      ctx.fillStyle = gradient;
      ctx.beginPath();
      const radius = Math.min(bw / 2, 3);
      ctx.roundRect(bx, centerY - barH / 2, bw, barH, radius);
      ctx.fill();

      // ── Glow for tall bars ───────────────────────────────────────────────
      if (bars[i] > 0.3 && currentMode !== 'idle') {
        ctx.save();
        ctx.shadowColor = `rgba(${r},${g},${b},0.8)`;
        ctx.shadowBlur = 8 + bars[i] * 12;
        ctx.fillStyle = `rgba(${r},${g},${b},${bars[i] * 0.3})`;
        ctx.beginPath();
        ctx.roundRect(bx, centerY - barH / 2, bw, barH, radius);
        ctx.fill();
        ctx.restore();
      }
    }

    // ── Center line ─────────────────────────────────────────────────────────
    const lineAlpha = currentMode === 'idle' ? 0.08 : 0.15;
    ctx.strokeStyle = `rgba(${r},${g},${b},${lineAlpha})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(W, centerY);
    ctx.stroke();

    // ── Outer glow ring (speaking mode) ─────────────────────────────────────
    if (currentMode === 'speaking') {
      const avgHeight = bars.reduce((s, v) => s + v, 0) / bars.length;
      const glowRadius = 60 + avgHeight * 40;
      const glowGrad = ctx.createRadialGradient(W / 2, centerY, 0, W / 2, centerY, glowRadius);
      glowGrad.addColorStop(0, `rgba(${r},${g},${b},${avgHeight * 0.08})`);
      glowGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = glowGrad;
      ctx.fillRect(0, 0, W, H);
    }

    rafRef.current = requestAnimationFrame(draw);
  }, []);

  // ── Microphone setup ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isActive) return;

    let cancelled = false;

    async function setupAudio() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const audioCtx = new AudioContext();
        audioCtxRef.current = audioCtx;
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.75;
        analyserRef.current = analyser;
        const source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);
        sourceRef.current = source;
      } catch {
        // Mic permission denied — waveform still animates in speaking/idle mode
      }
    }

    setupAudio();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      sourceRef.current?.disconnect();
      audioCtxRef.current?.close();
      analyserRef.current = null;
    };
  }, [isActive]);

  // ── Animation loop ──────────────────────────────────────────────────────────
  useEffect(() => {
    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [draw]);

  // ── Canvas DPR scaling ──────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const W = 600;
    const H = 220;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.scale(dpr, dpr);
  }, []);

  const colors = COLOR_MAP[mode];

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Canvas container with glow */}
      <div
        className="relative rounded-2xl overflow-hidden transition-all duration-700"
        style={{
          boxShadow: mode !== 'idle'
            ? `0 0 60px ${colors.glow}, 0 0 120px ${colors.glow.replace('0.35', '0.1').replace('0.45', '0.12')}`
            : 'none',
        }}
      >
        {/* Border glow */}
        <div
          className="absolute inset-0 rounded-2xl pointer-events-none z-10 transition-all duration-700"
          style={{
            background: mode !== 'idle'
              ? `linear-gradient(135deg, ${colors.glow}, transparent 60%)`
              : 'transparent',
            opacity: 0.3,
          }}
        />
        <canvas
          ref={canvasRef}
          className="block rounded-2xl"
          style={{ background: 'transparent' }}
        />
      </div>

      {/* Frequency dots (decorative) */}
      <div className="flex items-center gap-1">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="rounded-full transition-all duration-300"
            style={{
              width: 4,
              height: 4,
              background: mode !== 'idle' ? colors.primary : '#334155',
              opacity: mode !== 'idle' ? 0.4 + (i % 3) * 0.2 : 0.2,
              animationDelay: `${i * 0.1}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
