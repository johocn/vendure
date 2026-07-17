import { ConfigService, ProcessContext } from '@vendure/core';
import express from 'express';
import { ImageTransformStrategy } from './config/image-transform-strategy';
import { AssetServerOptions, ImageTransformPreset } from './types';
/**
 * This houses the actual Express server that handles incoming requests, performs image transformations,
 * caches the results, and serves the transformed images.
 */
export declare class AssetServer {
    private options;
    private configService;
    private processContext;
    private readonly assetStorageStrategy;
    private readonly cacheDir;
    private cacheHeader;
    private presets;
    private imageTransformStrategies;
    constructor(options: AssetServerOptions, configService: ConfigService, processContext: ProcessContext);
    /** @internal */
    onApplicationBootstrap(): void;
    /**
     * Creates the image server instance
     */
    createAssetServer(serverConfig: {
        presets: ImageTransformPreset[];
        imageTransformStrategies: ImageTransformStrategy[];
    }): express.Router;
    /**
     * Reads the file requested and send the response to the browser.
     */
    private sendAsset;
    /**
     * If an exception was thrown by the first handler, then it may be because a transformed image
     * is being requested which does not yet exist. In this case, this handler will generate the
     * transformed image, save it to cache, and serve the result as a response.
     */
    private generateTransformedImage;
    private getImageTransformParameters;
    private getInitialImageTransformParameters;
    private getFileNameFromParameters;
    /**
     * Sanitize the file path to prevent directory traversal attacks.
     */
    private sanitizeFilePath;
    private md5;
    private addSuffix;
    /**
     * Attempt to get the mime type from the file name.
     */
    private getMimeType;
}
