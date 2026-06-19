// Central place to read the Mapbox token and decide whether real maps are on.
export const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";
export const HAS_MAPBOX = MAPBOX_TOKEN.length > 0;

// Dark style that matches the Loop palette.
export const MAP_STYLE = "mapbox://styles/mapbox/dark-v11";
