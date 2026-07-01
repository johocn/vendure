import { Injector, RequestContext } from '@vendure/core';
import { LoadTemplateInput, Partial } from '../types';
import { TemplateLoader } from './template-loader';
/**
 * @description
 * Loads email templates from the local file system. This is the default
 * loader used by the EmailPlugin.
 *
 * @docsCategory core plugins/EmailPlugin
 * @docsPage TemplateLoader
 */
export declare class FileBasedTemplateLoader implements TemplateLoader {
    private templatePath;
    constructor(templatePath: string);
    loadTemplate(_injector: Injector, _ctx: RequestContext, { type, templateName }: LoadTemplateInput): Promise<string>;
    loadPartials(): Promise<Partial[]>;
}
