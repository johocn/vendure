"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.translateEntity = translateEntity;
exports.translateDeep = translateDeep;
exports.translateTree = translateTree;
const constants_1 = require("../../../common/constants");
const errors_1 = require("../../../common/error/errors");
/**
 * Converts a Translatable entity into the public-facing entity by unwrapping
 * the translated strings from the matching Translation entity.
 */
function translateEntity(translatable, languageCode) {
    let translation;
    let defaultTranslation;
    if (translatable.translations) {
        if (Array.isArray(languageCode)) {
            for (const lc of languageCode) {
                translation = translatable.translations.find(t => t.languageCode === lc);
                if (translation)
                    break;
            }
        }
        else {
            translation = translatable.translations.find(t => t.languageCode === languageCode);
        }
        if (!translation && languageCode !== constants_1.DEFAULT_LANGUAGE_CODE) {
            defaultTranslation = translatable.translations.find(t => t.languageCode === constants_1.DEFAULT_LANGUAGE_CODE);
            translation = defaultTranslation;
        }
        if (!translation) {
            // If we cannot find any suitable translation, just return the first one to at least
            // prevent graphql errors when returning the entity.
            translation = translatable.translations[0];
        }
    }
    if (!translation) {
        throw new errors_1.InternalServerError('error.entity-has-no-translation-in-language', {
            entityName: translatable.constructor.name,
            languageCode: Array.isArray(languageCode) ? languageCode.join() : languageCode,
        });
    }
    // Lazily-built fallback chain for field-level empty value resolution.
    // Only constructed when an empty field is actually encountered.
    let fallbackTranslations;
    const translated = Object.create(Object.getPrototypeOf(translatable), Object.getOwnPropertyDescriptors(translatable));
    for (const [key, value] of Object.entries(translation)) {
        if (key === 'customFields') {
            if (!translated.customFields) {
                translated.customFields = {};
            }
            const customFields = value;
            let needsFallback = false;
            for (const cfValue of Object.values(customFields)) {
                if (cfValue === '' || cfValue == null) {
                    needsFallback = true;
                    break;
                }
            }
            if (needsFallback) {
                if (fallbackTranslations === undefined) {
                    fallbackTranslations = buildFieldFallbackChain(translatable.translations, translation, languageCode, defaultTranslation);
                }
                const mergedCustomFields = Object.assign({}, customFields);
                for (const [cfKey, cfValue] of Object.entries(mergedCustomFields)) {
                    if (cfValue === '' || cfValue == null) {
                        for (const fallback of fallbackTranslations) {
                            const fallbackCf = fallback.customFields;
                            if (fallbackCf && fallbackCf[cfKey] !== '' && fallbackCf[cfKey] != null) {
                                mergedCustomFields[cfKey] = fallbackCf[cfKey];
                                break;
                            }
                        }
                    }
                }
                Object.assign(translated.customFields, mergedCustomFields);
            }
            else {
                Object.assign(translated.customFields, customFields);
            }
        }
        else if (key !== 'base' && key !== 'id' && key !== 'createdAt' && key !== 'updatedAt') {
            if (key !== 'languageCode' && (value == null || value === '')) {
                if (fallbackTranslations === undefined) {
                    fallbackTranslations = buildFieldFallbackChain(translatable.translations, translation, languageCode, defaultTranslation);
                }
                let fallbackValue = '';
                for (const fallback of fallbackTranslations) {
                    const fbVal = fallback[key];
                    if (fbVal != null && fbVal !== '') {
                        fallbackValue = fbVal;
                        break;
                    }
                }
                translated[key] = fallbackValue;
            }
            else {
                translated[key] = value !== null && value !== void 0 ? value : '';
            }
        }
    }
    return translated;
}
/**
 * Builds an ordered list of fallback translations for field-level resolution.
 * When `languageCode` is an array (as from TranslatorService: [requested, channelDefault, systemDefault]),
 * the array priority is respected. Otherwise falls back to the system default, then first available.
 */
function buildFieldFallbackChain(translations, selectedTranslation, languageCode, cachedDefaultTranslation) {
    const fallbacks = [];
    const addIfNew = (t) => {
        if (t && t !== selectedTranslation && !fallbacks.includes(t)) {
            fallbacks.push(t);
        }
    };
    // When languageCode is an array, it encodes the full priority chain
    // (e.g. [requestedLang, channelDefault, systemDefault] from TranslatorService).
    // Use remaining entries as field-level fallbacks in priority order.
    if (Array.isArray(languageCode)) {
        for (const lc of languageCode) {
            addIfNew(translations.find(t => t.languageCode === lc));
        }
    }
    // System default language (reuse cached lookup when available)
    const defaultTrans = cachedDefaultTranslation !== null && cachedDefaultTranslation !== void 0 ? cachedDefaultTranslation : (selectedTranslation.languageCode === constants_1.DEFAULT_LANGUAGE_CODE
        ? undefined
        : translations.find(t => t.languageCode === constants_1.DEFAULT_LANGUAGE_CODE));
    addIfNew(defaultTrans);
    // Last resort: first available translation
    addIfNew(translations[0]);
    return fallbacks;
}
/**
 * Translates an entity and its deeply-nested translatable properties. Supports up to 2 levels of nesting.
 */
function translateDeep(translatable, languageCode, translatableRelations = []) {
    let translatedEntity;
    try {
        translatedEntity = translateEntity(translatable, languageCode);
    }
    catch (e) {
        translatedEntity = translatable;
    }
    for (const path of translatableRelations) {
        let object;
        let property;
        let value;
        if (Array.isArray(path) && path.length === 2) {
            const [path0, path1] = path;
            const valueLevel0 = translatable[path0];
            if (Array.isArray(valueLevel0)) {
                valueLevel0.forEach((nested1, index) => {
                    object = translatedEntity[path0][index];
                    property = path1;
                    object[property] = translateLeaf(object, property, languageCode);
                });
                property = '';
                object = null;
            }
            else {
                object = translatedEntity[path0];
                property = path1;
                value = translateLeaf(object, property, languageCode);
            }
        }
        else {
            object = translatedEntity;
            property = path;
            value = translateLeaf(object, property, languageCode);
        }
        if (object && property) {
            object[property] = value;
        }
    }
    return translatedEntity;
}
function translateLeaf(object, property, languageCode) {
    if (object && object[property]) {
        if (Array.isArray(object[property])) {
            return object[property].map((nested2) => {
                try {
                    return translateEntity(nested2, languageCode);
                }
                catch (e) {
                    if (e instanceof errors_1.InternalServerError) {
                        return nested2;
                    }
                    throw e;
                }
            });
        }
        else if (object[property]) {
            try {
                return translateEntity(object[property], languageCode);
            }
            catch (e) {
                if (e instanceof errors_1.InternalServerError) {
                    return object[property];
                }
                throw e;
            }
        }
    }
}
/**
 * Translates a tree structure of Translatable entities
 */
function translateTree(node, languageCode, translatableRelations = []) {
    const output = translateDeep(node, languageCode, translatableRelations);
    if (Array.isArray(output.children)) {
        output.children = output.children.map(child => translateTree(child, languageCode, translatableRelations));
    }
    return output;
}
//# sourceMappingURL=translate-entity.js.map