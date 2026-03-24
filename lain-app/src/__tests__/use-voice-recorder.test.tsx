import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';

import { useVoiceRecorder } from '@/hooks/use-voice-recorder';

function VoiceRecorderHarness() {
  const { startRecording, status } = useVoiceRecorder();

  return (
    <>
      <Text testID="voice-recorder-status">{status}</Text>
      <Pressable
        onPress={() => {
          void startRecording();
        }}
        testID="voice-recorder-start">
        <Text>Start</Text>
      </Pressable>
    </>
  );
}

describe('useVoiceRecorder', () => {
  it('does not read released recorder state during unmount cleanup', async () => {
    const view = render(<VoiceRecorderHarness />);

    await act(async () => {
      fireEvent.press(screen.getByTestId('voice-recorder-start'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('voice-recorder-status').props.children).toBe('recording');
    });

    expect(() => view.unmount()).not.toThrow();
  });
});
