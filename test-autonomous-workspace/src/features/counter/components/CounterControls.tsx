import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { theme } from '../../../theme/theme';

export interface CounterControlsProps {
  onIncrement: () => void;
  onDecrement: () => void;
  onReset: () => void;
  onStepChange: (step: number) => void;
  currentStep: number;
}

export const CounterControls: React.FC<CounterControlsProps> = ({
  onIncrement,
  onDecrement,
  onReset,
  onStepChange,
  currentStep,
}) => {
  const steps = [1, 5, 10];

  return (
    <View style={styles.container}>
      <View style={styles.primaryRow}>
        <Pressable
          style={({ pressed }) => [
            styles.actionButton,
            styles.decrementButton,
            pressed && styles.pressed,
          ]}
          onPress={onDecrement}
        >
          <Text style={styles.actionButtonText}>-</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.actionButton,
            styles.incrementButton,
            pressed && styles.pressed,
          ]}
          onPress={onIncrement}
        >
          <Text style={styles.actionButtonText}>+</Text>
        </Pressable>
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.resetButton,
          pressed && styles.pressed,
        ]}
        onPress={onReset}
      >
        <Text style={styles.resetButtonText}>Reset Counter</Text>
      </Pressable>

      <View style={styles.stepContainer}>
        <Text style={styles.stepLabel}>Step Size:</Text>
        <View style={styles.stepRow}>
          {steps.map((s) => (
            <Pressable
              key={s}
              style={[
                styles.stepChip,
                currentStep === s && styles.activeStepChip,
              ]}
              onPress={() => onStepChange(s)}
            >
              <Text
                style={[
                  styles.stepChipText,
                  currentStep === s && styles.activeStepChipText,
                ]}
              >
                {s}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    gap: theme.spacing.md,
  },
  primaryRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  actionButton: {
    flex: 1,
    height: 64,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  decrementButton: {
    backgroundColor: theme.colors.error,
  },
  incrementButton: {
    backgroundColor: theme.colors.accent,
  },
  actionButtonText: {
    color: theme.colors.white,
    fontSize: theme.typography.fontSizes.xl,
    fontWeight: theme.typography.weights.bold,
  },
  resetButton: {
    backgroundColor: theme.colors.card,
    height: 48,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  resetButtonText: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.fontSizes.md,
    fontWeight: theme.typography.weights.semibold,
  },
  stepContainer: {
    marginTop: theme.spacing.sm,
    alignItems: 'center',
  },
  stepLabel: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.fontSizes.sm,
    marginBottom: theme.spacing.xs,
  },
  stepRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  stepChip: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  activeStepChip: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  stepChipText: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.fontSizes.sm,
    fontWeight: theme.typography.weights.medium,
  },
  activeStepChipText: {
    color: theme.colors.white,
    fontWeight: theme.typography.weights.bold,
  },
  pressed: {
    opacity: 0.8,
  },
});
