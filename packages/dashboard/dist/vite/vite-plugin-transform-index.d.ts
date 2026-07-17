import { Plugin } from 'vite';
/**
 * @description
 * This Vite plugin handles the scenario where the `base` path is set in the Vite config.
 * The default Vite behavior is to prepend the `base` path to all `href` and `src` attributes in the HTML,
 * but this causes the Vendure Dashboard not to load its assets correctly.
 *
 * This plugin removes the `base` path from all `href` and `src` attributes in the HTML,
 * and adds a `<base>` tag to the `<head>` of the HTML document.
 */
export declare function transformIndexHtmlPlugin(): Plugin;
