import { Plugin } from 'vite';
/**
 * This Vite plugin transforms the `app/styles.css` file to include a `@source` directive
 * for each dashboard extension's source directory. This allows Tailwind CSS to
 * include styles from these extensions when processing the CSS.
 */
export declare function dashboardTailwindSourcePlugin(): Plugin;
