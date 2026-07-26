import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useGetMe } from '@workspace/api-client-react';

interface CreditBadgeProps {
  onPress?: () => void;
}

export function CreditBadge({ onPress }: CreditBadgeProps) {
  const colors = useColors();
  const { data: user, isLoading } = useGetMe();

  return (
    <TouchableOpacity
      style={[styles.badge, { backgroundColor: colors.muted, borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Ionicons name="flash" size={13} color={colors.accent} />
      {isLoading ? (
        <ActivityIndicator size="small" color={colors.accent} style={{ marginLeft: 4 }} />
      ) : (
        <Text style={[styles.text, { color: colors.foreground }]}>
          {user?.credits?.toLocaleString() ?? '—'}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  text: {
    fontSize: 13,
    fontWeight: '600' as const,
    fontFamily: 'Inter_600SemiBold',
  },
});
