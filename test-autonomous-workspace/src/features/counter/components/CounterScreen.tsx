import React from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
import { useCounter } from '../hooks/useCounter';
import { CounterDisplay } from './CounterDisplay';
import { CounterControls } from './CounterControls';
import { theme } from '../../../theme/theme';

export const CounterScreen: React.FC = () => {
  const { count, step, increment, decrement, reset, setStepValue } = useCounter();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>TestFlow Counter</Text>
          <Text style={styles.subtitle}>Modern React Native Expo Application</Text>
        </View>

        <CounterDisplay count={count} step={step} />

        <CounterControls
          onIncrement={increment}
          onDecrement={decrement}
          onReset={reset}
          onStepChange={setStepValue}
          currentStep={step}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  container: {
    flex: 1,
    padding: theme.spacing.lg,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  title: {
    fontSize: theme.typography.fontSizes.xl,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
  },
  subtitle: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.xs,
  },
});
