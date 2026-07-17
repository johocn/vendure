"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.transformImage = transformImage;
exports.resizeToFocalPoint = resizeToFocalPoint;
const core_1 = require("@vendure/core");
const sharp_1 = __importDefault(require("sharp"));
const constants_1 = require("./constants");
/**
 * Applies transforms to the given image according to the query params passed.
 */
async function transformImage(originalImage, parameters) {
    const { width, height, mode, format } = parameters;
    const options = {};
    if (mode === 'crop') {
        options.position = sharp_1.default.strategy.entropy;
    }
    else {
        options.fit = 'inside';
    }
    const image = (0, sharp_1.default)(originalImage).rotate();
    try {
        await applyFormat(image, parameters.format, parameters.quality);
    }
    catch (e) {
        core_1.Logger.error(e.message, constants_1.loggerCtx, e.stack);
    }
    if (parameters.fpx && parameters.fpy && width && height && mode === 'crop') {
        const metadata = await image.metadata();
        if (metadata.width && metadata.height) {
            const xCenter = parameters.fpx * metadata.width;
            const yCenter = parameters.fpy * metadata.height;
            const { width: resizedWidth, height: resizedHeight, region, } = resizeToFocalPoint({ w: metadata.width, h: metadata.height }, { w: width, h: height }, { x: xCenter, y: yCenter });
            return image.resize(resizedWidth, resizedHeight).extract(region);
        }
    }
    return image.resize(width, height, options);
}
async function applyFormat(image, format, quality) {
    switch (format) {
        case 'jpg':
        case 'jpeg':
            return image.jpeg({ quality });
        case 'png':
            return image.png();
        case 'webp':
            return image.webp({ quality });
        case 'avif':
            return image.avif({ quality });
        default: {
            if (quality) {
                // If a quality has been specified but no format, we need to determine the format from the image
                // and apply the quality to that format.
                const metadata = await image.metadata();
                if (isImageTransformFormat(metadata.format)) {
                    return applyFormat(image, metadata.format, quality);
                }
            }
            return image;
        }
    }
}
function isImageTransformFormat(input) {
    return !!input && ['jpg', 'jpeg', 'webp', 'avif'].includes(input);
}
/**
 * Resize an image but keep it centered on the focal point.
 * Based on the method outlined in https://github.com/lovell/sharp/issues/1198#issuecomment-384591756
 */
function resizeToFocalPoint(original, target, focalPoint) {
    const { width, height, factor } = getIntermediateDimensions(original, target);
    const region = getExtractionRegion(factor, focalPoint, target, { w: width, h: height });
    return { width, height, region };
}
/**
 * Calculates the dimensions of the intermediate (resized) image.
 */
function getIntermediateDimensions(original, target) {
    const hRatio = original.h / target.h;
    const wRatio = original.w / target.w;
    let factor;
    let width;
    let height;
    if (hRatio < wRatio) {
        factor = hRatio;
        height = Math.round(target.h);
        width = Math.round(original.w / factor);
    }
    else {
        factor = wRatio;
        width = Math.round(target.w);
        height = Math.round(original.h / factor);
    }
    return { width, height, factor };
}
/**
 * Calculates the Region to extract from the intermediate image.
 */
function getExtractionRegion(factor, focalPoint, target, intermediate) {
    const newXCenter = focalPoint.x / factor;
    const newYCenter = focalPoint.y / factor;
    const region = {
        left: 0,
        top: 0,
        width: target.w,
        height: target.h,
    };
    if (intermediate.h < intermediate.w) {
        region.left = clamp(0, intermediate.w - target.w, Math.round(newXCenter - target.w / 2));
    }
    else {
        region.top = clamp(0, intermediate.h - target.h, Math.round(newYCenter - target.h / 2));
    }
    return region;
}
/**
 * Limit the input value to the specified min and max values.
 */
function clamp(min, max, input) {
    return Math.min(Math.max(min, input), max);
}
//# sourceMappingURL=transform-image.js.map