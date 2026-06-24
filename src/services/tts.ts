import * as Speech from 'expo-speech';
import { AudioMessage, AudioPriority, SpeechSpeed, SpeechGender } from '../types';
import { SPEECH_RATE } from '../constants';

interface QueuedMessage extends AudioMessage {
  id: string;
}

class TTSService {
  private queue: QueuedMessage[] = [];
  private isSpeaking = false;
  private speechSpeed: SpeechSpeed = 'normal';
  private speechGender: SpeechGender = 'female';
  private language = 'en-US';
  private messageCounter = 0;
  private currentPriority: AudioPriority = 'normal';

  configure(speed: SpeechSpeed, gender: SpeechGender, language: string) {
    this.speechSpeed = speed;
    this.speechGender = gender;
    this.language = language;
  }

  async speak(message: AudioMessage): Promise<void> {
    const msg: QueuedMessage = { ...message, id: String(++this.messageCounter) };

    if (msg.priority === 'critical') {
      this.queue = this.queue.filter((q) => q.priority === 'critical');
      this.queue.unshift(msg);
      if (this.isSpeaking && msg.interruptCurrent !== false) {
        await Speech.stop();
        this.isSpeaking = false;
      }
    } else if (msg.priority === 'high') {
      const insertIdx = this.queue.findIndex(
        (q) => q.priority !== 'critical' && q.priority !== 'high',
      );
      if (insertIdx === -1) {
        this.queue.push(msg);
      } else {
        this.queue.splice(insertIdx, 0, msg);
      }
    } else {
      this.queue.push(msg);
    }

    this.drain();
  }

  speakImmediate(text: string): void {
    this.speak({ text, priority: 'critical', interruptCurrent: true });
  }

  speakHigh(text: string): void {
    this.speak({ text, priority: 'high' });
  }

  speakNormal(text: string): void {
    this.speak({ text, priority: 'normal' });
  }

  speakLow(text: string): void {
    this.speak({ text, priority: 'low' });
  }

  private drain(): void {
    if (this.isSpeaking || this.queue.length === 0) return;

    const msg = this.queue.shift()!;
    this.isSpeaking = true;
    this.currentPriority = msg.priority;

    Speech.speak(msg.text, {
      language: this.language,
      pitch: 1.0,
      rate: SPEECH_RATE[this.speechSpeed],
      voice: this.resolveVoice(),
      onDone: () => {
        this.isSpeaking = false;
        this.drain();
      },
      onError: () => {
        this.isSpeaking = false;
        this.drain();
      },
      onStopped: () => {
        this.isSpeaking = false;
        this.drain();
      },
    });
  }

  private resolveVoice(): string | undefined {
    // Platform-specific voice names. Expo Speech falls back gracefully if not found.
    if (this.language.startsWith('en')) {
      return this.speechGender === 'female' ? 'com.apple.ttsbundle.Samantha-compact' : undefined;
    }
    return undefined;
  }

  async stop(): Promise<void> {
    this.queue = [];
    await Speech.stop();
    this.isSpeaking = false;
  }

  async getAvailableVoices() {
    return Speech.getAvailableVoicesAsync();
  }

  isBusyWithCritical(): boolean {
    return this.isSpeaking && this.currentPriority === 'critical';
  }

  clearQueue(): void {
    this.queue = [];
  }
}

export const tts = new TTSService();
