import { brand, darkTheme, fontFamily, lightTheme, radii, shadows } from '@vendure-io/design-tokens';
/**
 * Dashboard-specific tokens that extend the base design-tokens themes.
 * These are layered on top of `@vendure-io/design-tokens` `lightTheme`/`darkTheme`.
 */
const dashboardLightExtensions = {
    'dev-mode': brand[400],
    'dev-mode-foreground': brand[950],
    brand: brand[500],
    'brand-lighter': brand[300],
    'brand-darker': brand[700],
    'font-sans': fontFamily.sans,
    'font-heading': fontFamily.heading,
    'font-body': fontFamily.body,
    'font-mono': fontFamily.mono,
};
const dashboardDarkExtensions = {
    'dev-mode': brand[400],
    'dev-mode-foreground': brand[950],
    brand: brand[500],
    'brand-lighter': brand[50],
    'brand-darker': brand[700],
    'font-sans': fontFamily.sans,
    'font-heading': fontFamily.heading,
    'font-body': fontFamily.body,
    'font-mono': fontFamily.mono,
};
const defaultVariables = {
    light: Object.assign(Object.assign({}, lightTheme), dashboardLightExtensions),
    dark: Object.assign(Object.assign({}, darkTheme), dashboardDarkExtensions),
};
/**
 * Generates the `@theme inline` block from design-token JS exports,
 * mirroring the approach used by `@vendure-io/design-tokens/scripts/generate-css.ts`.
 * This avoids duplicating token values in CSS and keeps the dashboard in sync
 * with the design system automatically.
 */
function generateThemeInlineBlock() {
    // Semantic color mappings — every lightTheme key except 'radius' gets a --color-* alias
    const colorKeys = Object.keys(lightTheme).filter(k => k !== 'radius');
    const colorLines = colorKeys.map(key => `    --color-${key}: var(--${key});`);
    // Radius — direct values from token definitions (not calc-based)
    const radiusLines = Object.entries(radii).map(([key, value]) => `    --radius-${key}: ${value};`);
    // Shadows — direct values from token definitions
    const shadowLines = Object.entries(shadows).map(([key, value]) => `    --shadow-${key}: ${value};`);
    // Fonts — use var() indirection so user overrides via themeVariablesPlugin
    // options are picked up (the :root block sets --font-* from dashboardExtensions)
    const fontLines = Object.entries(fontFamily).map(([key]) => `    --font-${key}: var(--font-${key});`);
    // Dashboard-specific tokens not present in the base design-tokens
    const dashboardLines = [
        '    --color-dev-mode: var(--dev-mode);',
        '    --color-dev-mode-foreground: var(--dev-mode-foreground);',
        '    --color-brand: var(--brand);',
        '    --color-brand-lighter: var(--brand-lighter);',
        '    --color-brand-darker: var(--brand-darker);',
        '    --color-vendure-brand: #17c1ff;',
    ];
    const allLines = [...colorLines, ...radiusLines, ...shadowLines, ...fontLines, ...dashboardLines];
    return `@theme inline {\n${allLines.join('\n')}\n}`;
}
export function themeVariablesPlugin(options) {
    const virtualModuleId = 'virtual:admin-theme';
    const resolvedVirtualModuleId = `\0${virtualModuleId}`;
    return {
        name: 'vendure:admin-theme',
        enforce: 'pre', // This ensures our plugin runs before other CSS processors
        transform(code, id) {
            var _a, _b;
            // Only transform CSS files
            if (!id.endsWith('styles.css')) {
                return null;
            }
            let result = code;
            let modified = false;
            // Replace @import 'virtual:admin-theme' with :root / .dark CSS custom properties
            if (result.includes('@import "virtual:admin-theme";') ||
                result.includes("@import 'virtual:admin-theme';")) {
                const lightOverrides = ((_a = options.theme) === null || _a === void 0 ? void 0 : _a.light) || {};
                const darkOverrides = ((_b = options.theme) === null || _b === void 0 ? void 0 : _b.dark) || {};
                // Merge default themes with custom themes
                const mergedLightTheme = Object.assign(Object.assign({}, defaultVariables.light), lightOverrides);
                const mergedDarkTheme = Object.assign(Object.assign({}, defaultVariables.dark), darkOverrides);
                const themeCSS = `
                    :root {
                        ${Object.entries(mergedLightTheme)
                    .filter(([key, value]) => value !== undefined)
                    .map(([key, value]) => `--${key}: ${value};`)
                    .join('\n')}
                    }

                    .dark {
                        ${Object.entries(mergedDarkTheme)
                    .filter(([key, value]) => value !== undefined)
                    .map(([key, value]) => `--${key}: ${value};`)
                    .join('\n')}
                    }
                `;
                result = result.replace(/@import ['"]virtual:admin-theme['"];?/, themeCSS);
                modified = true;
            }
            // Replace @import 'virtual:admin-theme-inline' with the generated @theme inline block
            if (result.includes('@import "virtual:admin-theme-inline";') ||
                result.includes("@import 'virtual:admin-theme-inline';")) {
                result = result.replace(/@import ['"]virtual:admin-theme-inline['"];?/, generateThemeInlineBlock());
                modified = true;
            }
            return modified ? result : null;
        },
    };
}
