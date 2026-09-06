import React from 'react';
import { View, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { RootNavigator } from './navigation/RootNavigator';
import { SettingsProvider } from './contexts/SettingsContext';
import { DatabaseProvider } from './contexts/DatabaseContext';
import './sentry';

class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean}> {
  state = { hasError: false };
  static getDerivedStateFromError(_error: Error) {
    return { hasError: true };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error, info.componentStack);
  }
  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold' }}>Something went wrong</Text>
          <Text style={{ color: '#9ca3af', fontSize: 14, marginTop: 12, textAlign: 'center' }}>
            The app hit an unexpected error. Please restart to continue.
          </Text>
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
            <DatabaseProvider>
              <NavigationContainer>
                <RootNavigator />
              </NavigationContainer>
            </DatabaseProvider>
          </SettingsProvider>
          <Toast />
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
