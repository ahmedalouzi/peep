import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../../../theme/theme';

export interface CounterDisplayProps {
  count: number;
  step: number;
}

export const CounterDisplay: React.FC<CounterDisplayProps> = ({ count, step }) => {
  const getBadgeStyle = () => {
    if (count > 0) return styles.positiveBadge;
    if (count < 0) return styles.negativeBadge;
    return styles.neutralBadge;
  };

  const getBadgeText = () => {
    if (count > 0) return 'POSITIVE';
    if (count < 0) return 'NEGATIVE';
    return 'ZERO';
  };

  return (
    <View style={styles.container}>
      <View style={[styles.badge, getBadgeStyle()]}>
        <Text style={styles.badgeText}>{getBadgeText()}</Text>
      </View>
      <Text style={styles.countText}>{count}</Text>
      <Text style={styles.stepText}>Current Step: ±{step}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  badge: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.full,
    marginBottom: theme.spacing.sm,
  },
  positiveBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
  },
  negativeBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
  },
  neutralBadge: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
  },
  badgeText: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.fontSizes.sm,
    fontWeight: theme.typography.weights.semibold,
    letterSpacing: 1,
  },
  countText: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.fontSizes.xxl,
    fontWeight: theme.typography.weights.bold,
  },
  stepText: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.fontSizes.sm,
    marginTop: theme.spacing.xs,
  },
});
