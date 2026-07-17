import { InitializedEmailPluginOptions } from '../types';
import { EmailGenerator } from './email-generator';
/**
 * @description
 * Uses Handlebars (https://handlebarsjs.com/) to output MJML (https://mjml.io) which is then
 * compiled down to responsive email HTML.
 *
 * @docsCategory core plugins/EmailPlugin
 * @docsPage EmailGenerator
 */
export declare class HandlebarsMjmlGenerator implements EmailGenerator {
    onInit(options: InitializedEmailPluginOptions): Promise<void>;
    generate(from: string, subject: string, template: string, templateVars: any): Promise<{
        from: string;
        subject: string;
        body: string;
    }>;
    private registerHelpers;
}
