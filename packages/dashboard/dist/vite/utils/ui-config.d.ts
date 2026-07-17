import type { VendureConfig } from '@vendure/core';
import { ResolvedUiConfig, UiConfigPluginOptions } from '../vite-plugin-ui-config.js';
export declare function getUiConfig(config: VendureConfig, pluginOptions: UiConfigPluginOptions): Omit<ResolvedUiConfig, 'version'>;
