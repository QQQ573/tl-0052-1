import Phaser from 'phaser';
import { StorageManager } from './StorageManager';

export class AudioManager {
  private scene: Phaser.Scene;
  private bgm: Phaser.Sound.BaseSound | null = null;
  private bgmKey: string = 'bgm';
  private bgmFastKey: string = 'bgm_fast';
  private currentSpeed: number = 1;
  private isMuted: boolean = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.isMuted = !StorageManager.isMusicEnabled();
  }

  preload(): void {
    if (!this.scene.cache.audio.has('correct')) {
      this.generateSounds();
    }
  }

  private generateSounds(): void {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

    this.createBeepSound(audioContext, 'correct', 880, 0.1, 'sine');
    this.createBeepSound(audioContext, 'wrong', 220, 0.2, 'square');
    this.createBeepSound(audioContext, 'complete', 1047, 0.15, 'sine');
    this.createBeepSound(audioContext, 'warning', 440, 0.3, 'sawtooth');
    this.createBeepSound(audioContext, 'click', 660, 0.05, 'sine');

    this.createBGMSound(audioContext, 'bgm', 120);
    this.createBGMSound(audioContext, 'bgm_fast', 180);
  }

  private createBeepSound(ctx: AudioContext, key: string, freq: number, duration: number, type: OscillatorType): void {
    const sampleRate = ctx.sampleRate;
    const buffer = ctx.createBuffer(1, sampleRate * duration, sampleRate);
    const data = buffer.getChannelData(0);

    const oscillator = ctx.createOscillator();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(freq, 0);

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0.3, 0);
    gainNode.gain.exponentialRampToValueAtTime(0.01, duration);

    const offlineCtx = new OfflineAudioContext(1, sampleRate * duration, sampleRate);
    const osc = offlineCtx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, 0);
    const gain = offlineCtx.createGain();
    gain.gain.setValueAtTime(0.3, 0);
    gain.gain.exponentialRampToValueAtTime(0.01, duration);

    osc.connect(gain);
    gain.connect(offlineCtx.destination);
    osc.start();

    offlineCtx.startRendering().then((renderedBuffer) => {
      for (let i = 0; i < renderedBuffer.length; i++) {
        data[i] = renderedBuffer.getChannelData(0)[i];
      }
      this.scene.cache.audio.add(key, buffer);
    });
  }

  private createBGMSound(ctx: AudioContext, key: string, bpm: number): void {
    const duration = 8;
    const sampleRate = ctx.sampleRate;
    const buffer = ctx.createBuffer(2, sampleRate * duration, sampleRate);
    const leftData = buffer.getChannelData(0);
    const rightData = buffer.getChannelData(1);

    const beatInterval = 60 / bpm;
    const beats = Math.floor(duration / beatInterval);
    const bassFreq = 110;
    const chordFreqs = [261.63, 329.63, 392.00];

    for (let beat = 0; beat < beats; beat++) {
      const beatStart = beat * beatInterval * sampleRate;
      const beatEnd = (beat + 1) * beatInterval * sampleRate;

      const chordIndex = beat % 4;

      for (let i = beatStart; i < beatEnd && i < buffer.length; i++) {
        const t = (i - beatStart) / sampleRate;
        const envelope = Math.exp(-t * 4);

        const bassNote = bassFreq * Math.pow(2, (chordIndex % 2) * 0.25);
        const bassSample = Math.sin(2 * Math.PI * bassNote * t) * envelope * 0.3;

        const chordSample = chordFreqs.reduce((sum, freq) => {
          return sum + Math.sin(2 * Math.PI * freq * t * Math.pow(2, chordIndex * 0.25)) * envelope * 0.15;
        }, 0);

        const drumSample = (Math.random() * 2 - 1) * envelope * 0.2 * (beat % 2 === 0 ? 1 : 0.5);

        const sample = bassSample + chordSample + drumSample;
        leftData[i] = sample * 0.5;
        rightData[i] = sample * 0.5;
      }
    }

    this.scene.cache.audio.add(key, buffer);
  }

  playBGM(speed: number = 1): void {
    if (this.isMuted) return;

    this.stopBGM();

    const key = speed > 1 ? this.bgmFastKey : this.bgmKey;
    this.currentSpeed = speed;

    this.bgm = this.scene.sound.add(key, {
      loop: true,
      volume: 0.3
    });
    this.bgm.play();
  }

  stopBGM(): void {
    if (this.bgm) {
      this.bgm.stop();
      this.bgm.destroy();
      this.bgm = null;
    }
  }

  setBGMSpeed(speed: number): void {
    if (this.currentSpeed !== speed) {
      this.playBGM(speed);
    }
  }

  playCorrect(): void {
    this.playSound('correct');
  }

  playWrong(): void {
    this.playSound('wrong');
  }

  playComplete(): void {
    this.playSound('complete');
  }

  playWarning(): void {
    this.playSound('warning');
  }

  playClick(): void {
    this.playSound('click');
  }

  private playSound(key: string): void {
    if (this.isMuted || !StorageManager.isSoundEnabled()) return;

    try {
      this.scene.sound.play(key, { volume: 0.5 });
    } catch (e) {
      console.warn('Could not play sound:', key);
    }
  }

  toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    StorageManager.setMusicEnabled(!this.isMuted);
    StorageManager.setSoundEnabled(!this.isMuted);

    if (this.isMuted) {
      this.stopBGM();
    } else if (this.bgm === null && this.scene.scene.isActive()) {
      this.playBGM(this.currentSpeed);
    }

    return !this.isMuted;
  }

  isMutedSound(): boolean {
    return this.isMuted;
  }

  destroy(): void {
    this.stopBGM();
  }
}
