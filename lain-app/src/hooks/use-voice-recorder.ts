import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from 'expo-audio';
import { useCallback, useEffect, useRef, useState } from 'react';

type RecorderStatus = 'idle' | 'recording' | 'processing' | 'ready' | 'error';

const RECORDING_OPTIONS = RecordingPresets.HIGH_QUALITY;
const RECORDING_AUDIO_MODE = {
  allowsBackgroundRecording: false,
  allowsRecording: true,
  interruptionMode: 'duckOthers' as const,
  playsInSilentMode: true,
  shouldPlayInBackground: false,
  shouldRouteThroughEarpiece: false,
};
const IDLE_AUDIO_MODE = {
  allowsBackgroundRecording: false,
  allowsRecording: false,
  interruptionMode: 'mixWithOthers' as const,
  playsInSilentMode: true,
  shouldPlayInBackground: false,
  shouldRouteThroughEarpiece: false,
};

export function useVoiceRecorder() {
  const recording = useAudioRecorder(RECORDING_OPTIONS);
  const [status, setStatus] = useState<RecorderStatus>('idle');
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const isMountedRef = useRef(true);
  const isRecordingRef = useRef(false);
  const restoreAudioMode = useCallback(() => {
    return setAudioModeAsync(IDLE_AUDIO_MODE).catch(() => null);
  }, []);
  const stopRecorderSilently = useCallback(async () => {
    try {
      await recording.stop();
    } catch {
      return null;
    }
  }, [recording]);
  const setRecorderStatus = useCallback((nextStatus: RecorderStatus) => {
    if (isMountedRef.current) {
      setStatus(nextStatus);
    }
  }, []);
  const clearAudioUri = useCallback(() => {
    if (isMountedRef.current) {
      setAudioUri(null);
    }
  }, []);
  const storeAudioUri = useCallback((nextAudioUri: string) => {
    if (isMountedRef.current) {
      setAudioUri(nextAudioUri);
    }
  }, []);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      isRecordingRef.current = false;
      void restoreAudioMode();
    };
  }, [restoreAudioMode]);

  const startRecording = async () => {
    if (isRecordingRef.current || status === 'recording' || status === 'processing') {
      return;
    }

    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setRecorderStatus('error');
        return;
      }

      await setAudioModeAsync(RECORDING_AUDIO_MODE);
      await recording.prepareToRecordAsync();
      recording.record();
      isRecordingRef.current = true;
      clearAudioUri();
      setRecorderStatus('recording');
    } catch {
      isRecordingRef.current = false;
      await restoreAudioMode();
      setRecorderStatus('error');
    }
  };

  const stopRecording = async () => {
    if (!isRecordingRef.current && status !== 'recording') {
      return null;
    }

    setRecorderStatus('processing');
    try {
      await recording.stop();
      isRecordingRef.current = false;
      const uri = recording.uri;
      if (!uri) {
        setRecorderStatus('error');
        return null;
      }

      storeAudioUri(uri);
      setRecorderStatus('ready');
      return uri;
    } catch {
      isRecordingRef.current = false;
      setRecorderStatus('error');
      return null;
    } finally {
      await restoreAudioMode();
    }
  };

  const reset = () => {
    if (isRecordingRef.current || status === 'recording') {
      isRecordingRef.current = false;
      void stopRecorderSilently();
    }
    void restoreAudioMode();
    clearAudioUri();
    setRecorderStatus('idle');
  };

  return {
    status,
    audioUri,
    recording,
    startRecording,
    stopRecording,
    reset,
  };
}
