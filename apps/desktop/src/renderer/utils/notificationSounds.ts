import type { NotificationSound } from '@shared/types';

interface ToneConfig {
  frequency: number;
  type: OscillatorType;
  duration: number;
  volume: number;
  pattern?: number[]; // [play, pause, play, pause...] in ms
}

const TONE_CONFIGS: Record<string, ToneConfig> = {
  // ~5s mellow double-ping repeated (C5 note)
  default: {
    frequency: 523,
    type: 'sine',
    duration: 250,
    volume: 0.3,
    pattern: [250, 150, 250, 800, 250, 150, 250, 800, 250, 150, 250, 800, 250, 150, 250],
  },
  // ~5s higher-pitched triple-chime groups
  chime: {
    frequency: 800,
    type: 'sine',
    duration: 200,
    volume: 0.3,
    pattern: [200, 100, 200, 100, 200, 600, 200, 100, 200, 100, 200, 600, 200, 100, 200, 100, 200, 600, 200, 100, 200],
  },
  // ~5s urgent triple-beep groups (square wave)
  alert: {
    frequency: 600,
    type: 'square',
    duration: 150,
    volume: 0.4,
    pattern: [150, 80, 150, 80, 150, 500, 150, 80, 150, 80, 150, 500, 150, 80, 150, 80, 150, 500, 150, 80, 150, 80, 150],
  },
  // ~5s continuous urgent alarm (sawtooth)
  alarm: {
    frequency: 880,
    type: 'sawtooth',
    duration: 300,
    volume: 0.5,
    pattern: [300, 150, 300, 150, 300, 400, 300, 150, 300, 150, 300, 400, 300, 150, 300, 150, 300, 400, 300, 150, 300],
  },
  // ~5s slow relaxed tone (A4 note)
  gentle: {
    frequency: 440,
    type: 'sine',
    duration: 500,
    volume: 0.2,
    pattern: [500, 400, 500, 600, 500, 400, 500, 600, 500, 400, 500],
  },
};

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
  return audioContext;
}

function playTone(frequency: number, type: OscillatorType, duration: number, volume: number): Promise<void> {
  return new Promise((resolve) => {
    const ctx = getAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);
    gainNode.gain.setValueAtTime(volume, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration / 1000);

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.start();
    oscillator.stop(ctx.currentTime + duration / 1000);

    setTimeout(resolve, duration);
  });
}

export async function playNotificationSound(sound: NotificationSound, customPath?: string): Promise<void> {
  if (sound === 'silent') return;

  if (sound === 'custom' && customPath) {
    try {
      const audio = new Audio(`file://${customPath}`);
      audio.volume = 0.5;
      await audio.play();
    } catch {
      // Fallback to chime if custom sound fails
      await playBuiltInTone('chime');
    }
    return;
  }

  await playBuiltInTone(sound);
}

async function playBuiltInTone(name: string): Promise<void> {
  const config = TONE_CONFIGS[name];
  if (!config) return;

  if (!config.pattern) {
    await playTone(config.frequency, config.type, config.duration, config.volume);
    return;
  }

  for (let i = 0; i < config.pattern.length; i++) {
    if (i % 2 === 0) {
      await playTone(config.frequency, config.type, config.pattern[i], config.volume);
    } else {
      await new Promise((resolve) => setTimeout(resolve, config.pattern![i]));
    }
  }
}

export const SOUND_OPTIONS: { value: NotificationSound; label: string }[] = [
  { value: 'default', label: 'Default' },
  { value: 'chime', label: 'Chime' },
  { value: 'alert', label: 'Alert' },
  { value: 'alarm', label: 'Alarm' },
  { value: 'gentle', label: 'Gentle' },
  { value: 'silent', label: 'Silent' },
  { value: 'custom', label: 'Custom' },
];
