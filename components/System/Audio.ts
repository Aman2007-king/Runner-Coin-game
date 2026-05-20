/**
 * @license SPDX-License-Identifier: Apache-2.0
 */
export class AudioController {
  ctx:        AudioContext | null = null;
  masterGain: GainNode     | null = null;
  private _muted  = false;
  private _volume = 0.35;
  musicInterval:  ReturnType<typeof setInterval> | null = null;
  private _musicBeat = 0;

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this._muted ? 0 : this._volume;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(()=>{});
  }

  setMuted(m: boolean) {
    this._muted = m;
    if (this.masterGain) this.masterGain.gain.value = m ? 0 : this._volume;
  }

  private ready() {
    if (!this.ctx || !this.masterGain) this.init();
    return !!(this.ctx && this.masterGain);
  }

  playGemCollect() {
    if (!this.ready()) return;
    const t = this.ctx!.currentTime;
    const o = this.ctx!.createOscillator();
    const g = this.ctx!.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(1200, t);
    o.frequency.exponentialRampToValueAtTime(2200, t+0.1);
    g.gain.setValueAtTime(0.4, t);
    g.gain.exponentialRampToValueAtTime(0.01, t+0.15);
    o.connect(g); g.connect(this.masterGain!); o.start(t); o.stop(t+0.15);
  }

  playLetterCollect() {
    if (!this.ready()) return;
    [523,659,784].forEach((f,i) => {
      const t = this.ctx!.currentTime + i*0.04;
      const o = this.ctx!.createOscillator();
      const g = this.ctx!.createGain();
      o.type = 'triangle'; o.frequency.value = f;
      g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.01, t+0.3);
      o.connect(g); g.connect(this.masterGain!); o.start(t); o.stop(t+0.3);
    });
  }

  playJump(isDouble = false) {
    if (!this.ready()) return;
    const t = this.ctx!.currentTime;
    const o = this.ctx!.createOscillator();
    const g = this.ctx!.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(isDouble ? 400 : 200, t);
    o.frequency.exponentialRampToValueAtTime(isDouble ? 900 : 500, t+0.15);
    g.gain.setValueAtTime(0.18, t); g.gain.exponentialRampToValueAtTime(0.01, t+0.15);
    o.connect(g); g.connect(this.masterGain!); o.start(t); o.stop(t+0.15);
  }

  playSlide() {
    if (!this.ready()) return;
    const t = this.ctx!.currentTime;
    const o = this.ctx!.createOscillator();
    const g = this.ctx!.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(300, t); o.frequency.exponentialRampToValueAtTime(80, t+0.25);
    g.gain.setValueAtTime(0.2, t); g.gain.exponentialRampToValueAtTime(0.01, t+0.25);
    o.connect(g); g.connect(this.masterGain!); o.start(t); o.stop(t+0.25);
  }

  playBoost() {
    if (!this.ready()) return;
    const t = this.ctx!.currentTime;
    const o = this.ctx!.createOscillator();
    const g = this.ctx!.createGain();
    o.type = 'square';
    o.frequency.setValueAtTime(200, t); o.frequency.exponentialRampToValueAtTime(1600, t+0.3);
    g.gain.setValueAtTime(0.3, t); g.gain.exponentialRampToValueAtTime(0.01, t+0.35);
    o.connect(g); g.connect(this.masterGain!); o.start(t); o.stop(t+0.35);
  }

  playDamage() {
    if (!this.ready()) return;
    const t = this.ctx!.currentTime;
    const o = this.ctx!.createOscillator();
    const g = this.ctx!.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(100, t); o.frequency.exponentialRampToValueAtTime(20, t+0.3);
    g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.01, t+0.3);
    o.connect(g); g.connect(this.masterGain!); o.start(t); o.stop(t+0.3);
  }

  playPowerUp() {
    if (!this.ready()) return;
    const t = this.ctx!.currentTime;
    const o = this.ctx!.createOscillator();
    const g = this.ctx!.createGain();
    o.type = 'square';
    o.frequency.setValueAtTime(400, t);
    o.frequency.exponentialRampToValueAtTime(1200, t+0.2);
    o.frequency.exponentialRampToValueAtTime(800, t+0.4);
    g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.01, t+0.5);
    o.connect(g); g.connect(this.masterGain!); o.start(t); o.stop(t+0.5);
  }

  playShieldActivate() {
    if (!this.ready()) return;
    for (let i = 0; i < 3; i++) {
      const t = this.ctx!.currentTime + i*0.05;
      const o = this.ctx!.createOscillator();
      const g = this.ctx!.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(400+i*100, t);
      o.frequency.exponentialRampToValueAtTime(800+i*200, t+0.3);
      g.gain.setValueAtTime(0.18, t); g.gain.exponentialRampToValueAtTime(0.01, t+0.4);
      o.connect(g); g.connect(this.masterGain!); o.start(t); o.stop(t+0.4);
    }
  }

  // Adaptive music — BPM scales with speed
  startMusic(bpm = 140) {
    if (this.musicInterval) return;
    this._musicBeat = 0;
    const ms = (60000 / bpm) / 2;
    this.musicInterval = setInterval(() => {
      if (!this.ctx || !this.masterGain) return;
      const t = this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'sawtooth';
      const freq = this._musicBeat % 4 === 0 ? 55 : this._musicBeat % 2 === 0 ? 41.2 : 49;
      o.frequency.setValueAtTime(freq, t); o.frequency.exponentialRampToValueAtTime(freq/2, t+0.18);
      g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.01, t+0.18);
      o.connect(g); g.connect(this.masterGain); o.start(t); o.stop(t+0.18);
      this._musicBeat++;
    }, ms);
  }

  stopMusic() {
    if (this.musicInterval) { clearInterval(this.musicInterval); this.musicInterval = null; }
  }

  updateMusicBPM(speed: number, baseSpeed: number) {
    const bpm = Math.min(220, Math.round(140 * (speed / baseSpeed)));
    this.stopMusic(); this.startMusic(bpm);
  }
}

export const audio = new AudioController();
