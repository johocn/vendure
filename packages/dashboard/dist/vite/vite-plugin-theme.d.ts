import { Plugin } from 'vite';
type ThemeColors = Record<string, string | undefined>;
export interface ThemeVariables {
    light?: ThemeColors;
    dark?: ThemeColors;
}
export type ThemeVariablesPluginOptions = {
    theme?: ThemeVariables;
};
export declare function themeVariablesPlugin(options: ThemeVariablesPluginOptions): Plugin;
export {};
