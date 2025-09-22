export {};

declare global {
  interface Window {
    electronAPI: {
      // AniList Functions
      openLoginWindow: (url: string) => void;
      onLoginSuccess: (callback: (event: any, token: string) => void) => void;

      // TMDB Functions
      openTmdbLoginWindow: (url: string) => void;
      onTmdbLinkSuccess: (callback: () => void) => void;
    };
  }
}