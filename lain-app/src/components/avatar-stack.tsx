import { View, Text, StyleSheet, Image, ViewStyle } from 'react-native';
import type { ActiveUser } from '@/types/editor';

type AvatarStackProps = {
  users: ActiveUser[];
  style?: ViewStyle;
};

export default function AvatarStack({ users, style }: AvatarStackProps) {
  return (
    <View style={[styles.container, style]}>
      {users.map(user => (
        <View key={user.id} style={styles.avatarWrapper}>
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
          <Text style={styles.label} numberOfLines={1}>
            {user.name}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatarWrapper: {
    alignItems: 'center',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1f1b24',
  },
  online: {
    borderWidth: 2,
    borderColor: '#3dffb8',
  },
  offline: {
    borderWidth: 1,
    borderColor: '#3a3a3a',
  },
  label: {
    color: '#f4e1d7',
    fontSize: 10,
    marginTop: 2,
  },
});
