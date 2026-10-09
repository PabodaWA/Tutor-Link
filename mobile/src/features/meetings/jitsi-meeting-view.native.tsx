import type { ComponentType } from 'react';

import type { JitsiMeetingViewProps } from './jitsi-meeting-types';

type JitsiSdkProps = {
  room: string;
  serverURL: string;
  userInfo: { avatarURL: string; displayName: string; email: string };
  config: Record<string, unknown>;
  flags: Record<string, boolean>;
  eventListeners: Record<string, () => void>;
  style: { flex: number };
};

// Jitsi publishes its implementation as TypeScript source. A CommonJS import keeps
// the app type-check isolated from the SDK's private, unpublished source modules.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { JitsiMeeting } = require('@jitsi/react-native-sdk') as {
  JitsiMeeting: ComponentType<JitsiSdkProps>;
};

export default function JitsiMeetingView({
  room,
  serverURL,
  displayName,
  email,
  onClose,
}: JitsiMeetingViewProps) {
  return (
    <JitsiMeeting
      room={room}
      serverURL={serverURL}
      userInfo={{ avatarURL: '', displayName, email }}
      config={{ prejoinPageEnabled: false }}
      flags={{
        'invite.enabled': false,
        'ios.screensharing.enabled': false,
        'android.screensharing.enabled': false,
        'welcomepage.enabled': false,
      }}
      eventListeners={{
        onConferenceLeft: onClose,
        onReadyToClose: onClose,
      }}
      style={{ flex: 1 }}
    />
  );
}
