// 使用 Web Audio API 合成科幻风格音效，无需音频文件

export class AudioManager {
  private ctx: AudioContext | null = null
  private ambientGain: GainNode | null = null
  private ambientOsc: OscillatorNode | null = null
  private ambientRunning = false

  private getCtx(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext()
    }
    return this.ctx
  }

  // 手势确认音 — 清脆的科幻"叮"
  playGestureConfirm(gesture: string) {
    const ctx = this.getCtx()
    const now = ctx.currentTime

    const frequencies: Record<string, number> = {
      pinch: 880,
      fist: 660,
      peace: 1040,
      point: 780,
      open_palm: 1320
    }
    const freq = frequencies[gesture] || 800

    // 双层音色 — 清脆主音 + 谐波
    const osc1 = ctx.createOscillator()
    osc1.type = 'sine'
    osc1.frequency.setValueAtTime(freq, now)
    osc1.frequency.exponentialRampToValueAtTime(freq * 1.5, now + 0.1)

    const osc2 = ctx.createOscillator()
    osc2.type = 'triangle'
    osc2.frequency.setValueAtTime(freq * 2, now)
    osc2.frequency.exponentialRampToValueAtTime(freq * 3, now + 0.08)

    const gain1 = ctx.createGain()
    gain1.gain.setValueAtTime(0.15, now)
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.3)

    const gain2 = ctx.createGain()
    gain2.gain.setValueAtTime(0.08, now)
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.2)

    osc1.connect(gain1).connect(ctx.destination)
    osc2.connect(gain2).connect(ctx.destination)

    osc1.start(now)
    osc2.start(now)
    osc1.stop(now + 0.3)
    osc2.stop(now + 0.2)
  }

  // 启动成功音 — 上升的琶音
  playLaunchSuccess() {
    const ctx = this.getCtx()
    const now = ctx.currentTime
    const notes = [523, 659, 784, 1047] // C5 E5 G5 C6

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, now + i * 0.06)

      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0, now + i * 0.06)
      gain.gain.linearRampToValueAtTime(0.12, now + i * 0.06 + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.3)

      osc.connect(gain).connect(ctx.destination)
      osc.start(now + i * 0.06)
      osc.stop(now + i * 0.06 + 0.3)
    })
  }

  // 粒子聚合音 — 上升的嗡鸣
  playMorphStart() {
    const ctx = this.getCtx()
    const now = ctx.currentTime

    const osc = ctx.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(100, now)
    osc.frequency.exponentialRampToValueAtTime(800, now + 0.8)

    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(200, now)
    filter.frequency.exponentialRampToValueAtTime(2000, now + 0.8)
    filter.Q.value = 5

    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.06, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.0)

    osc.connect(filter).connect(gain).connect(ctx.destination)
    osc.start(now)
    osc.stop(now + 1.0)
  }

  // 粒子爆发音 — 短暂的嘶嘶声
  playBurst() {
    const ctx = this.getCtx()
    const now = ctx.currentTime

    const bufferSize = ctx.sampleRate * 0.15
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.04))
    }

    const source = ctx.createBufferSource()
    source.buffer = buffer

    const filter = ctx.createBiquadFilter()
    filter.type = 'highpass'
    filter.frequency.value = 2000

    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.1, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15)

    source.connect(filter).connect(gain).connect(ctx.destination)
    source.start(now)
  }

  // 悬停音 — 微弱的持续音
  playHover() {
    const ctx = this.getCtx()
    const now = ctx.currentTime

    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(1200, now)

    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.03, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15)

    osc.connect(gain).connect(ctx.destination)
    osc.start(now)
    osc.stop(now + 0.15)
  }

  // 环境背景音 — 低沉的持续嗡鸣
  startAmbient() {
    if (this.ambientRunning) return
    const ctx = this.getCtx()

    this.ambientGain = ctx.createGain()
    this.ambientGain.gain.value = 0.02

    this.ambientOsc = ctx.createOscillator()
    this.ambientOsc.type = 'sine'
    this.ambientOsc.frequency.value = 55 // A1 低音

    const lfo = ctx.createOscillator()
    lfo.frequency.value = 0.1
    const lfoGain = ctx.createGain()
    lfoGain.gain.value = 3
    lfo.connect(lfoGain).connect(this.ambientOsc.frequency)

    this.ambientOsc.connect(this.ambientGain).connect(ctx.destination)
    this.ambientOsc.start()
    lfo.start()
    this.ambientRunning = true
  }
}