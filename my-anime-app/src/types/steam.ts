export interface SteamGame {
    appid: number;
    name: string;
    header_image: string;
    price_overview?: {
        final_formatted: string;
        final: number;
        initial: number;
        discount_percent: number;
    };
    platforms: {
        windows: boolean;
        mac: boolean;
        linux: boolean;
    };
    categories?: Array<{
        id: number;
        description: string;
    }>;
    release_date?: {
        coming_soon: boolean;
        date: string;
    };
}

// Mapping function to convert Steam game data to our app's Media format
export const convertSteamToMedia = (game: SteamGame) => {
    return {
        api_source: 'STEAM',
        api_id: game.appid,
        primary_title: game.name,
        secondary_title: null,
        cover_image_url: game.header_image,
        media_type: 'GAME',
        display_title: game.name,
        display_sub: game.price_overview ? game.price_overview.final_formatted : 'Free to Play'
    };
};