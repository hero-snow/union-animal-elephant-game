/**
 * Procedural Web Audio synthesizer for game sound effects.
 * Avoids external audio dependencies while respecting browser autoplay policies.
 */
export class SoundEffects {
    private ctx: AudioContext | null = null;
    private muted: boolean = false;
    private lastImpactTime: number = 0;

    constructor() {
        const savedMute = localStorage.getItem('suikaMuted');
        if (savedMute === 'true') {
            this.muted = true;
        }
    }

    public isMuted(): boolean {
        return this.muted;
    }

    public setMuted(muted: boolean): void {
        this.muted = muted;
        localStorage.setItem('suikaMuted', String(muted));
    }

    public toggleMute(): boolean {
        this.setMuted(!this.muted);
        if (!this.muted) {
            this.unlock();
        }
        return this.muted;
    }

    public unlock(): void {
        const ctx = this.getContext();
        if (ctx && ctx.state === 'suspended') {
            ctx.resume().catch(() => {});
        }
    }

    private getContext(): AudioContext | null {
        if (this.muted) return null;
        if (!this.ctx) {
            const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
            if (!AudioCtx) return null;
            this.ctx = new AudioCtx();
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume().catch(() => {});
        }
        return this.ctx;
    }

    public playDrop(): void {
        const ctx = this.getContext();
        if (!ctx) return;

        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(420, now);
        osc.frequency.exponentialRampToValueAtTime(220, now + 0.09);

        gain.gain.setValueAtTime(0.14, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.11);
    }

    public playImpact(speed: number): void {
        const ctx = this.getContext();
        if (!ctx) return;

        const nowMs = performance.now();
        if (nowMs - this.lastImpactTime < 90 || speed < 2.2) return;
        this.lastImpactTime = nowMs;

        const vol = Math.min(0.1, (speed - 2.0) * 0.012);
        if (vol <= 0.005) return;

        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(125, now);
        osc.frequency.exponentialRampToValueAtTime(52, now + 0.06);

        gain.gain.setValueAtTime(vol, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.07);
    }

    public playMerge(tier: number, combo: number): void {
        const ctx = this.getContext();
        if (!ctx) return;

        // C major pentatonic scale frequencies
        const scale = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];
        const noteIndex = Math.min(scale.length - 1, Math.max(0, tier - 1 + Math.min(3, combo - 1)));
        const baseFreq = scale[noteIndex];

        const now = ctx.currentTime;
        this.playTone(ctx, baseFreq, 'sine', now, 0.22, 0.16);
        this.playTone(ctx, baseFreq * 1.5, 'triangle', now + 0.03, 0.18, 0.08);

        if (combo >= 2) {
            this.playTone(ctx, baseFreq * 2, 'sine', now + 0.06, 0.2, 0.07);
        }
    }

    public playElephantMerge(): void {
        const ctx = this.getContext();
        if (!ctx) return;

        const now = ctx.currentTime;

        // 1. Anticipation rising shimmer before impact (0..180ms)
        const riseOsc = ctx.createOscillator();
        const riseGain = ctx.createGain();
        riseOsc.type = 'sine';
        riseOsc.frequency.setValueAtTime(220, now);
        riseOsc.frequency.exponentialRampToValueAtTime(880, now + 0.17);
        riseGain.gain.setValueAtTime(0.06, now);
        riseGain.gain.exponentialRampToValueAtTime(0.14, now + 0.17);
        riseOsc.connect(riseGain);
        riseGain.connect(ctx.destination);
        riseOsc.start(now);
        riseOsc.stop(now + 0.18);

        const burstTime = now + 0.18;

        // 2. Deep celebratory bass boom
        const boomOsc = ctx.createOscillator();
        const boomGain = ctx.createGain();
        boomOsc.type = 'sine';
        boomOsc.frequency.setValueAtTime(110, burstTime);
        boomOsc.frequency.exponentialRampToValueAtTime(34, burstTime + 0.48);
        boomGain.gain.setValueAtTime(0.28, burstTime);
        boomGain.gain.exponentialRampToValueAtTime(0.001, burstTime + 0.5);
        boomOsc.connect(boomGain);
        boomGain.connect(ctx.destination);
        boomOsc.start(burstTime);
        boomOsc.stop(burstTime + 0.52);

        // 3. Ascending fanfare arpeggio + final chord
        const fanfare = [
            { freq: 523.25, delay: 0.0, dur: 0.22, vol: 0.15 },  // C5
            { freq: 659.25, delay: 0.07, dur: 0.22, vol: 0.15 }, // E5
            { freq: 783.99, delay: 0.14, dur: 0.24, vol: 0.16 }, // G5
            { freq: 1046.5, delay: 0.22, dur: 0.55, vol: 0.18 }, // C6
            { freq: 1318.5, delay: 0.26, dur: 0.5, vol: 0.12 },  // E6
            { freq: 1567.98, delay: 0.30, dur: 0.55, vol: 0.12 } // G6
        ];

        fanfare.forEach(note => {
            this.playTone(ctx, note.freq, 'triangle', burstTime + note.delay, note.dur, note.vol);
            this.playTone(ctx, note.freq * 0.5, 'sine', burstTime + note.delay, note.dur, note.vol * 0.5);
        });
    }

    public playGameOver(): void {
        const ctx = this.getContext();
        if (!ctx) return;

        const now = ctx.currentTime;
        this.playTone(ctx, 329.63, 'triangle', now, 0.2, 0.12);
        this.playTone(ctx, 261.63, 'triangle', now + 0.16, 0.22, 0.12);
        this.playTone(ctx, 220.0, 'sine', now + 0.34, 0.4, 0.14);
    }

    private playTone(
        ctx: AudioContext,
        freq: number,
        type: OscillatorType,
        startTime: number,
        duration: number,
        volume: number
    ): void {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0.001, startTime);
        gain.gain.linearRampToValueAtTime(volume, startTime + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + duration + 0.02);
    }
}
