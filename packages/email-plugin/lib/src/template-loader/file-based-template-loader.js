"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileBasedTemplateLoader = void 0;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
/**
 * @description
 * Loads email templates from the local file system. This is the default
 * loader used by the EmailPlugin.
 *
 * @docsCategory core plugins/EmailPlugin
 * @docsPage TemplateLoader
 */
class FileBasedTemplateLoader {
    constructor(templatePath) {
        this.templatePath = templatePath;
    }
    async loadTemplate(_injector, _ctx, { type, templateName }) {
        const templatePath = path_1.default.join(this.templatePath, type, templateName);
        return promises_1.default.readFile(templatePath, 'utf-8');
    }
    async loadPartials() {
        const partialsPath = path_1.default.join(this.templatePath, 'partials');
        const partialsFiles = await promises_1.default.readdir(partialsPath);
        return Promise.all(partialsFiles.map(async (file) => {
            return {
                name: path_1.default.basename(file, '.hbs'),
                content: await promises_1.default.readFile(path_1.default.join(partialsPath, file), 'utf-8'),
            };
        }));
    }
}
exports.FileBasedTemplateLoader = FileBasedTemplateLoader;
//# sourceMappingURL=file-based-template-loader.js.map