import { useState } from 'react';

export interface UseCounterOptions {
  initialValue?: number;
  initialStep?: number;
  min?: number;
  max?: number;
}

export interface UseCounterReturn {
  count: number;
  step: number;
  increment: () => void;
  decrement: () => void;
  reset: () => void;
  setStepValue: (newStep: number) => void;
  canDecrement: boolean;
  canIncrement: boolean;
}

export const useCounter = (options: UseCounterOptions = {}): UseCounterReturn => {
  const { initialValue = 0, initialStep = 1, min = -999, max = 999 } = options;

  const [count, setCount] = useState<number>(initialValue);
  const [step, setStep] = useState<number>(initialStep);

  const increment = (): void => {
    setCount((prev) => Math.min(prev + step, max));
  };

  const decrement = (): void => {
    setCount((prev) => Math.max(prev - step, min));
  };

  const reset = (): void => {
    setCount(initialValue);
  };

  const setStepValue = (newStep: number): void => {
    if (newStep > 0) {
      setStep(newStep);
    }
  };

  return {
    count,
    step,
    increment,
    decrement,
    reset,
    setStepValue,
    canDecrement: count > min,
    canIncrement: count < max,
  };
};
