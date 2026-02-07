import React from 'react';
import { View, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { RootNavigator } from './navigation/RootNavigator';
import { SettingsProvider } from './contexts/SettingsContext';

class ErrorBoundary extends React.Component<{children: React.ReactNode}, {error: string | null}> {
  state = { error: null as string | null };
  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }
  render() {
    if (this.state.error) {
      return (
        <View style={{ flex: 1, backgroundColor: '#dc2626', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold' }}>Something went wrong</Text>
          <Text style={{ color: 'white', fontSize: 14, marginTop: 10 }}>{this.state.error}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <SettingsProvider>
            <NavigationContainer>
              <RootNavigator />
            </NavigationContainer>
          </SettingsProvider>
          <Toast />
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
