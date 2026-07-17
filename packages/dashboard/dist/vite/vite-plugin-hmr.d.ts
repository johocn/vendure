import { Plugin } from 'vite';
/**
 * @description
 * This plugin enables kind-of HMR for when dashboard extension files change.
 * It is not true HMR because it triggers a page reload. Making real HMR work is very
 * tricky in this case due to the way we load extension files via virtual modules.
 */
export declare function hmrPlugin(): Plugin;
