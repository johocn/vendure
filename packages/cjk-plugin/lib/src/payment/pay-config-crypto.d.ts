import type { PayConfig } from './payment-config.types';
export declare function encryptPayConfig(config: PayConfig | null): PayConfig | null;
export declare function decryptPayConfig(config: PayConfig | null): PayConfig | null;
export declare function maskPayConfig(config: PayConfig | null): PayConfig | null;
export declare function mergePayConfig(original: PayConfig | null, patch: Partial<PayConfig> | null): PayConfig | null;
