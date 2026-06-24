import { useEffect, useRef, useCallback } from 'react';
import Voice, { SpeechResultsEvent, SpeechErrorEvent } from '@react-native-voice/voice';
import { VOICE_COMMANDS } from '../constants';

type CommandKey = keyof typeof VOICE_COMMANDS;

interface VoiceCommandOptions {
  onCommand: (command: CommandKey, fullText: string) => void;
  onError?: (error: string) => void;
  language?: string;
  active?: boolean;
}

export function useVoiceCommands({
  onCommand,
  onError,
  language = 'en-US',
  active = true,
}: VoiceCommandOptions) {
  const isListening = useRef(false);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const matchCommand = useCallback(
    (text: string): CommandKey | null => {
      const lower = text.toLowerCase().trim();
      for (const [key, phrases] of Object.entries(VOICE_COMMANDS) as [CommandKey, readonly string[]][]) {
        if (phrases.some((phrase) => lower.includes(phrase))) {
          return key;
        }
      }
      return null;
    },
    [],
  );

  const startListening = useCallback(async () => {
    if (isListening.current || !active) return;
    try {
      await Voice.start(language);
      isListening.current = true;
    } catch {
      // Voice not available — gracefully skip
    }
  }, [language, active]);

  const stopListening = useCallback(async () => {
    if (!isListening.current) return;
    try {
      await Voice.stop();
    } catch {
      // ignore
    }
    isListening.current = false;
  }, []);

  useEffect(() => {
    const handleResults = (event: SpeechResultsEvent) => {
      const results = event.value ?? [];
      for (const text of results) {
        const command = matchCommand(text);
        if (command) {
          onCommand(command, text);
          // Restart listening after processing
          restartTimerRef.current = setTimeout(startListening, 500);
          return;
        }
      }
      // No command matched — keep listening
      startListening();
    };

    const handleError = (event: SpeechErrorEvent) => {
      isListening.current = false;
      onError?.(event.error?.message ?? 'Speech recognition error');
      // Auto-restart on error
      restartTimerRef.current = setTimeout(startListening, 1000);
    };

    const handleEnd = () => {
      isListening.current = false;
      // Keep listening continuously while active
      if (active) {
        restartTimerRef.current = setTimeout(startListening, 200);
      }
    };

    Voice.onSpeechResults = handleResults;
    Voice.onSpeechError = handleError;
    Voice.onSpeechEnd = handleEnd;

    if (active) {
      startListening();
    }

    return () => {
      clearTimeout(restartTimerRef.current);
      Voice.destroy().then(Voice.removeAllListeners);
      isListening.current = false;
    };
  }, [active, matchCommand, onCommand, onError, startListening]);

  return { startListening, stopListening };
}
