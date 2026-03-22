import { View, StyleSheet, Image, ViewStyle } from 'react-native';
import type { ActiveUser } from '@/types/editor';

type AvatarStackProps = {
  users: ActiveUser[];
  style?: ViewStyle;
};

export default function AvatarStack({ users, style }: AvatarStackProps) {
  return (
    <View style={[styles.container, style]}>
      {users.map((user, index) => (
        <View
          key={user.id}
          accessibilityLabel={`${user.name} ${user.isOnline ? 'online' : 'offline'}`}
          accessible
          style={[styles.avatarWrapper, index > 0 && styles.avatarOverlap]}>
          <Image
            source={
              user.avatarUrl
                ? { uri: user.avatarUrl }
                : require('@/assets/images/react-logo.png')
            }
            style={[
              styles.avatar,
              user.isOnline ? styles.online : styles.offline,
            ]}
          />
          <View style={[styles.presenceDot, user.isOnline ? styles.presenceOnline : styles.presenceOffline]} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 8,
  },
  avatarWrapper: {
    marginLeft: -8,
    position: 'relative',
  },
  avatarOverlap: {
    marginLeft: -10,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#15181d',
    borderWidth: 1,
    borderColor: '#0b0d10',
  },
  online: {
    borderColor: '#d8f7e8',
  },
  offline: {
    borderColor: '#2f343c',
  },
  presenceDot: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 9,
    height: 9,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#0b0d10',
  },
  presenceOnline: {
    backgroundColor: '#7ef0b9',
  },
  presenceOffline: {
    backgroundColor: '#565c65',
  },
});
