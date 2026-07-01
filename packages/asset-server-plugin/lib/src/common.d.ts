import { Request } from 'express';
import { AssetServerOptions, ImageTransformFormat } from './types';
export declare function getAssetUrlPrefixFn(options: AssetServerOptions): ((request: Request, identifier: string) => string) | ((...args: any[]) => string);
export declare function getValidFormat(format?: unknown): ImageTransformFormat | undefined;
