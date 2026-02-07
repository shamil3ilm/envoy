import type { EnvoyAPI } from '../../preload/index';

declare global {
  interface Window {
    envoy: EnvoyAPI;
  }
}

export {};
