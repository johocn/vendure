"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SharpAssetPreviewStrategy = void 0;
const generated_types_1 = require("@vendure/common/lib/generated-types");
const core_1 = require("@vendure/core");
const path_1 = __importDefault(require("path"));
const sharp_1 = __importDefault(require("sharp"));
const constants_1 = require("../constants");
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
class SharpAssetPreviewStrategy {
    constructor(config) {
        this.defaultConfig = {
            maxHeight: 1600,
            maxWidth: 1600,
            jpegOptions: {},
            pngOptions: {},
            webpOptions: {},
            gifOptions: {},
            avifOptions: {},
        };
        this.config = Object.assign(Object.assign({}, this.defaultConfig), (config !== null && config !== void 0 ? config : {}));
    }
    async generatePreviewImage(ctx, mimeType, data) {
        const assetType = (0, core_1.getAssetType)(mimeType);
        const { maxWidth, maxHeight } = this.config;
        if (assetType === generated_types_1.AssetType.IMAGE) {
            try {
                const image = (0, sharp_1.default)(data, { failOn: 'truncated' }).rotate();
                const metadata = await image.metadata();
                const width = metadata.width || 0;
                const height = metadata.height || 0;
                if (maxWidth < width || maxHeight < height) {
                    image.resize(maxWidth, maxHeight, { fit: 'inside' });
                }
                if (mimeType === 'image/svg+xml') {
                    // Convert the SVG to a raster for the preview
                    return image.toBuffer();
                }
                else {
                    switch (metadata.format) {
                        case 'jpeg':
                        case 'jpg':
                            return image.jpeg(this.config.jpegOptions).toBuffer();
                        case 'png':
                            return image.png(this.config.pngOptions).toBuffer();
                        case 'webp':
                            return image.webp(this.config.webpOptions).toBuffer();
                        case 'gif':
                            return image.gif(this.config.jpegOptions).toBuffer();
                        case 'avif':
                            return image.avif(this.config.avifOptions).toBuffer();
                        default:
                            return image.toBuffer();
                    }
                }
            }
            catch (err) {
                core_1.Logger.error(`An error occurred when generating preview for image with mimeType ${mimeType}: ${JSON.stringify(err.message)}`, constants_1.loggerCtx);
                return this.generateBinaryFilePreview(mimeType);
            }
        }
        else {
            return this.generateBinaryFilePreview(mimeType);
        }
    }
    generateMimeTypeOverlay(mimeType) {
        return Buffer.from(`
            <svg xmlns="http://www.w3.org/2000/svg" height="150" width="800">
            <style>
                text {
                   font-size: 64px;
                   font-family: Arial, sans-serif;
                   fill: #666;
                }
              </style>

              <text x="400" y="110"  text-anchor="middle" width="800">${mimeType}</text>
            </svg>`);
    }
    generateBinaryFilePreview(mimeType) {
        return (0, sharp_1.default)(path_1.default.join(__dirname, '..', 'file-icon.png'))
            .resize(800, 800, { fit: 'outside' })
            .composite([
            {
                input: this.generateMimeTypeOverlay(mimeType),
                gravity: sharp_1.default.gravity.center,
            },
        ])
            .toBuffer();
    }
}
exports.SharpAssetPreviewStrategy = SharpAssetPreviewStrategy;
//# sourceMappingURL=sharp-asset-preview-strategy.js.map