import Toast from 'react-native-toast-message';

export function useToast() {
  return {
    success: (title: string, message?: string) => {
      Toast.show({ type: 'success', text1: title, text2: message });
    },
    error: (title: string, message?: string) => {
      Toast.show({ type: 'error', text1: title, text2: message });
    },
    warning: (title: string, message?: string) => {
      Toast.show({ type: 'info', text1: title, text2: message });
    },
    info: (title: string, message?: string) => {
      Toast.show({ type: 'info', text1: title, text2: message });
    },
  };
}
