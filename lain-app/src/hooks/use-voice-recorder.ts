import { useEffect, useState } from 'react';
import { Audio, AVPlaybackStatus } from 'expo-av';

type RecorderStatus = 'idle' | 'recording' | 'processing' | 'ready' | 'error';

const RECORDING_OPTIONS = Audio.RECORDING_OPTIONS_PRESET_HIGH_QUALITY;

export function useVoiceRecorder() {
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [status, setStatus] = useState<RecorderStatus>('idle');
  const [audioUri, setAudioUri] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      recording?.stopAndUnloadAsync().catch(() => null);
    };
  }, [recording]);

  const startRecording = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        setStatus('error');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const newRecording = new Audio.Recording();
      await newRecording.prepareToRecordAsync(RECORDING_OPTIONS);
      await newRecording.startAsync();
      setRecording(newRecording);
      setStatus('recording');
    } catch (error) {
      setStatus('error');
    }
  };

  const stopRecording = async () => {
    if (!recording) {
      return;
    }

    setStatus('processing');
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setAudioUri(uri);
      setRecording(null);
      setStatus('ready');
    } catch (error) {
      setStatus('error');
    }
  };

  const reset = () => {
    recording?.stopAndUnloadAsync().catch(() => null);
    setRecording(null);
    setAudioUri(null);
    setStatus('idle');
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
