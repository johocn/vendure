import { Injector, RequestContext } from '@vendure/core';
import { EmailPluginDevModeOptions, EmailPluginOptions, EmailTransportOptions } from './types';
export declare function isDevModeOptions(input: EmailPluginOptions | EmailPluginDevModeOptions): input is EmailPluginDevModeOptions;
export declare function resolveTransportSettings(options: EmailPluginOptions, injector: Injector, ctx?: RequestContext): Promise<EmailTransportOptions>;
