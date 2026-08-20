import React from 'react';
import { StatusBar } from 'react-native';
import { CounterScreen } from './src/features/counter/components/CounterScreen';

export default function App(): React.JSX.Element {
  const appTitle: string = "TestFlow Counter Application";

  return (
    <>
      <StatusBar barStyle="light-content" />
      <CounterScreen />
    </>
  );
}
