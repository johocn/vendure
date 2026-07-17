import type { MapProviderConfig } from './map-config';
export declare function encryptMapConfig(config: MapProviderConfig | null): MapProviderConfig | null;
export declare function decryptMapConfig(config: MapProviderConfig | null): MapProviderConfig | null;
export declare function maskMapConfig(config: MapProviderConfig | null): MapProviderConfig | null;
export declare function mergeMapConfig(original: MapProviderConfig | null, patch: Partial<MapProviderConfig> | null): MapProviderConfig | null;
