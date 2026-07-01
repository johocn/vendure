import { AssetPreviewStrategy, RequestContext } from '@vendure/core';
import sharp from 'sharp';
/**
 * @description
 * This {@link AssetPreviewStrategy} uses the [Sharp library](https://sharp.pixelplumbing.com/) to generate
 * preview images of uploaded binary files. For non-image binaries, a generic "file" icon with the mime type
 * overlay will be generated.
 *
 * @docsCategory core plugins/AssetServerPlugin
 * @docsPage SharpAssetPreviewStrategy
 */
interface SharpAssetPreviewConfig {
    /**
     * @description
     * The max height in pixels of a generated preview image.
     *
     * @default 1600
     */
    maxHeight?: number;
    /**
     * @description
     * The max width in pixels of a generated preview image.
     *
     * @default 1600
     */
    maxWidth?: number;
    /**
     * @description
     * Set Sharp's options for encoding jpeg files: https://sharp.pixelplumbing.com/api-output#jpeg
     *
     * @since 1.7.0
     */
    jpegOptions?: sharp.JpegOptions;
    /**
     * @description
     * Set Sharp's options for encoding png files: https://sharp.pixelplumbing.com/api-output#png
     *
     * @since 1.7.0
     */
    pngOptions?: sharp.PngOptions;
    /**
     * @description
     * Set Sharp's options for encoding webp files: https://sharp.pixelplumbing.com/api-output#webp
     *
     * @since 1.7.0
     */
    webpOptions?: sharp.WebpOptions;
    /**
     * @description
     * Set Sharp's options for encoding gif files: https://sharp.pixelplumbing.com/api-output#gif
     *
     * @since 1.7.0
     */
    gifOptions?: sharp.GifOptions;
    /**
     * @description
     * Set Sharp's options for encoding avif files: https://sharp.pixelplumbing.com/api-output#avif
     *
     * @since 1.7.0
     */
    avifOptions?: sharp.AvifOptions;
}
/**
 * @description
 * This {@link AssetPreviewStrategy} uses the [Sharp library](https://sharp.pixelplumbing.com/) to generate
 * preview images of uploaded binary files. For non-image binaries, a generic "file" icon with the mime type
 * overlay will be generated.
 *
 * By default, this strategy will produce previews up to maximum dimensions of 1600 x 1600 pixels. The created
 * preview images will match the input format - so a source file in jpeg format will output a jpeg preview,
 * a webp source file will output a webp preview, and so on.
 *
 * The settings for the outputs will default to Sharp's defaults (https://sharp.pixelplumbing.com/api-output).
 * However, it is possible to pass your own configurations to control the output of each format:
 *
 * ```ts
 * AssetServerPlugin.init({
 *   previewStrategy: new SharpAssetPreviewStrategy({
 *     jpegOptions: { quality: 95 },
 *     webpOptions: { quality: 95 },
 *   }),
 * }),
 * ```
 *
 * @docsCategory core plugins/AssetServerPlugin
 * @docsPage SharpAssetPreviewStrategy
 * @docsWeight 0
 */
export declare class SharpAssetPreviewStrategy implements AssetPreviewStrategy {
    private readonly defaultConfig;
    private readonly config;
    constructor(config?: SharpAssetPreviewConfig);
    generatePreviewImage(ctx: RequestContext, mimeType: string, data: Buffer): Promise<Buffer>;
    private generateMimeTypeOverlay;
    private generateBinaryFilePreview;
}
export {};
