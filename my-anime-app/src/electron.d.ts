export {};

declare global {
  interface Window {
    electronAPI: {
      openLoginWindow: () => void;
      onLoginSuccess: (callback: (event: any, token: string) => void) => void;
    };
  }
}