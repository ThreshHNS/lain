jest.mock('expo-status-bar', () => ({
  StatusBar: () => null,
}));

jest.mock('expo-glass-effect', () => {
  return {
    GlassView: ({ children, style }: { children?: unknown; style?: unknown }) => {
      const React = require('react');
      const { View } = require('react-native');
      return React.createElement(View, { style }, children);
    },
    isLiquidGlassAvailable: () => false,
  };
});

jest.mock('expo-audio', () => {
  const React = require('react');

  function createReleasedRecorderError() {
    return new Error(
      'NativeSharedObjectNotFoundException: Unable to find the native shared object associated with given JavaScript object',
    );
  }

  function createMockRecorder() {
    let isRecording = false;
    let uri: string | null = null;
    let isReleased = false;
    const assertAvailable = () => {
      if (isReleased) {
        throw createReleasedRecorderError();
      }
    };

    const recorder = {
      currentTime: 0,
      getAvailableInputs: jest.fn(() => {
        assertAvailable();
        return [];
      }),
      getCurrentInput: jest.fn(() => {
        assertAvailable();
        return Promise.resolve({
          name: 'Built-in Microphone',
          type: 'microphone',
          uid: 'mock-input',
        });
      }),
      getStatus: jest.fn(() => {
        assertAvailable();
        return {
          canRecord: true,
          durationMillis: 0,
          id: recorder.id,
          isRecording,
          mediaServicesDidReset: false,
          url: uri,
        };
      }),
      id: 'mock-recorder',
      pause: jest.fn(() => {
        assertAvailable();
      }),
      prepareToRecordAsync: jest.fn(() => {
        assertAvailable();
        return Promise.resolve();
      }),
      record: jest.fn(() => {
        assertAvailable();
        isRecording = true;
        uri = null;
      }),
      recordForDuration: jest.fn(() => {
        assertAvailable();
      }),
      release: jest.fn(() => {
        isRecording = false;
        isReleased = true;
      }),
      setInput: jest.fn(() => {
        assertAvailable();
      }),
      startRecordingAtTime: jest.fn(() => {
        assertAvailable();
      }),
      stop: jest.fn(() => {
        assertAvailable();
        isRecording = false;
        uri = 'file://mock-voice';
        return Promise.resolve();
      }),
    };

    Object.defineProperties(recorder, {
      isRecording: {
        configurable: true,
        enumerable: true,
        get: () => {
          assertAvailable();
          return isRecording;
        },
      },
      uri: {
        configurable: true,
        enumerable: true,
        get: () => {
          assertAvailable();
          return uri;
        },
      },
    });

    return recorder;
  }

  return {
    RecordingPresets: {
      HIGH_QUALITY: {},
    },
    requestRecordingPermissionsAsync: jest.fn(() => Promise.resolve({ granted: true })),
    setAudioModeAsync: jest.fn(() => Promise.resolve()),
    useAudioRecorder: jest.fn(() => {
      const recorderRef = React.useRef<ReturnType<typeof createMockRecorder> | null>(null);
      if (recorderRef.current == null) {
        recorderRef.current = createMockRecorder();
      }
      React.useEffect(() => {
        return () => {
          recorderRef.current?.release();
        };
      }, []);
      return recorderRef.current;
    }),
  };
});

jest.mock('expo-haptics', () => ({
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
  },
  NotificationFeedbackType: {
    Error: 'error',
    Success: 'success',
  },
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  selectionAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock('react-native-safe-area-context', () => {
  const actual = jest.requireActual('react-native-safe-area-context');

  return {
    ...actual,
    useSafeAreaInsets: () => ({
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    }),
  };
});
