"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PresetOnlyStrategy = void 0;
/**
 * @description
 * An {@link ImageTransformStrategy} which only allows transformations to be made using
 * presets which are defined in the available presets.
 *
 * With this strategy enabled, requests to the asset server must include a `preset` parameter (or use the default preset)
 *
 * This is valid: `http://localhost:3000/assets/some-asset.jpg?preset=medium`
 *
 * This is invalid: `http://localhost:3000/assets/some-asset.jpg?w=200&h=200`, and the dimensions will be ignored.
 *
 * The strategy can be configured to allow only certain quality values and formats, and to
 * optionally allow the focal point to be specified in the URL.
 *
 * If a preset is not found in the available presets, an error will be thrown.
 *
 * @example
 * ```ts
 * import { AssetServerPlugin, PresetOnlyStrategy } from '\@vendure/core';
 *
 * // ...
 *
 * AssetServerPlugin.init({
 *   //...
 *   imageTransformStrategy: new PresetOnlyStrategy({
 *     defaultPreset: 'thumbnail',
 *     permittedQuality: [0, 50, 75, 85, 95],
 *     permittedFormats: ['jpg', 'webp', 'avif'],
 *     allowFocalPoint: true,
 *   }),
 * });
 * ```
 *
 * @docsCategory core plugins/AssetServerPlugin
 * @docsPage PresetOnlyStrategy
 * @docsWeight 0
 * @since 3.1.0
 */
class PresetOnlyStrategy {
    constructor(options) {
        this.options = options;
    }
    getImageTransformParameters({ input, availablePresets, }) {
        var _a, _b, _c;
        const presetName = (_a = input.preset) !== null && _a !== void 0 ? _a : this.options.defaultPreset;
        const matchingPreset = availablePresets.find(p => p.name === presetName);
        if (!matchingPreset) {
            throw new Error(`Preset "${presetName}" not found`);
        }
        const permittedQuality = (_b = this.options.permittedQuality) !== null && _b !== void 0 ? _b : [0, 50, 75, 85, 95];
        const permittedFormats = (_c = this.options.permittedFormats) !== null && _c !== void 0 ? _c : ['jpg', 'webp', 'avif'];
        const quality = input.quality && permittedQuality.includes(input.quality) ? input.quality : undefined;
        const format = input.format && permittedFormats.includes(input.format) ? input.format : undefined;
        return {
            width: matchingPreset.width,
            height: matchingPreset.height,
            mode: matchingPreset.mode,
            quality,
            format,
            fpx: this.options.allowFocalPoint ? input.fpx : undefined,
            fpy: this.options.allowFocalPoint ? input.fpy : undefined,
            preset: input.preset,
        };
    }
}
exports.PresetOnlyStrategy = PresetOnlyStrategy;
//# sourceMappingURL=preset-only-strategy.js.map