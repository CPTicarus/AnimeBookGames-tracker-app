export {};

declare global {
  interface Window {
    electronAPI: {
      openLoginWindow: (url: string) => void;
      onLoginSuccess: (callback: (event: any, token: string) => void) => void;
    };
  }
}