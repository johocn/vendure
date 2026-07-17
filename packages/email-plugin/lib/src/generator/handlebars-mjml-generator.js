"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HandlebarsMjmlGenerator = void 0;
const dateformat_1 = __importDefault(require("dateformat"));
const handlebars_1 = __importDefault(require("handlebars"));
const mjml_1 = __importDefault(require("mjml"));
/**
 * @description
 * Uses Handlebars (https://handlebarsjs.com/) to output MJML (https://mjml.io) which is then
 * compiled down to responsive email HTML.
 *
 * @docsCategory core plugins/EmailPlugin
 * @docsPage EmailGenerator
 */
class HandlebarsMjmlGenerator {
    async onInit(options) {
        if (options.templateLoader.loadPartials) {
            const partials = await options.templateLoader.loadPartials();
            partials.forEach(({ name, content }) => handlebars_1.default.registerPartial(name, content));
        }
        this.registerHelpers();
    }
    async generate(from, subject, template, templateVars) {
        const compiledFrom = handlebars_1.default.compile(from, { noEscape: true });
        const compiledSubject = handlebars_1.default.compile(subject);
        const compiledTemplate = handlebars_1.default.compile(template);
        // We enable prototype properties here, aware of the security implications
        // described here: https://handlebarsjs.com/api-reference/runtime-options.html#options-to-control-prototype-access
        // This is needed because some Vendure entities use getters on the entity
        // prototype (e.g. Order.total) which may need to be interpolated.
        const templateOptions = { allowProtoPropertiesByDefault: true };
        const fromResult = compiledFrom(templateVars, templateOptions);
        const subjectResult = compiledSubject(templateVars, templateOptions);
        const mjml = compiledTemplate(templateVars, templateOptions);
        const body = (await (0, mjml_1.default)(mjml)).html;
        return { from: fromResult, subject: subjectResult, body };
    }
    registerHelpers() {
        handlebars_1.default.registerHelper('formatDate', (date, format) => {
            if (!date) {
                return date;
            }
            if (typeof format !== 'string') {
                format = 'default';
            }
            return (0, dateformat_1.default)(date, format);
        });
        handlebars_1.default.registerHelper('formatMoney', (amount, currencyCode, locale) => {
            if (amount == null) {
                return amount;
            }
            // Last parameter is a generic "options" object which is not used here.
            // If it's supplied, it means the helper function did not receive the additional, optional parameters.
            // See https://handlebarsjs.com/api-reference/helpers.html#the-options-parameter
            if (!currencyCode || typeof currencyCode === 'object') {
                return new Intl.NumberFormat(typeof locale === 'object' ? undefined : locale, {
                    style: 'decimal',
                }).format(amount / 100);
            }
            // Same reasoning for `locale` as for `currencyCode` here.
            return new Intl.NumberFormat(typeof locale === 'object' ? undefined : locale, {
                style: 'currency',
                currency: currencyCode,
            }).format(amount / 100);
        });
    }
}
exports.HandlebarsMjmlGenerator = HandlebarsMjmlGenerator;
//# sourceMappingURL=handlebars-mjml-generator.js.map