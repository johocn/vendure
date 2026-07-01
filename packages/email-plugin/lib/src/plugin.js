"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var EmailPlugin_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailPlugin = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const core_2 = require("@vendure/core");
const common_2 = require("./common");
const constants_1 = require("./constants");
const dev_mailbox_1 = require("./dev-mailbox");
const email_processor_1 = require("./email-processor");
const file_based_template_loader_1 = require("./template-loader/file-based-template-loader");
/**
 * @description
 * The EmailPlugin creates and sends transactional emails based on Vendure events. By default, it uses an [MJML](https://mjml.io/)-based
 * email generator to generate the email body and [Nodemailer](https://nodemailer.com/about/) to send the emails.
 *
 * ## High-level description
 * Vendure has an internal events system (see {@link EventBus}) that allows plugins to subscribe to events. The EmailPlugin is configured with {@link EmailEventHandler}s
 * that listen for a specific event and when it is published, the handler defines which template to use to generate the resulting email.
 *
 * The plugin comes with a set of default handler for the following events:
 * - Order confirmation
 * - New customer email address verification
 * - Password reset request
 * - Email address change request
 *
 * You can also create your own handler and register them with the plugin - see the {@link EmailEventHandler} docs for more details.
 *
 * ## Installation
 *
 * `yarn add \@vendure/email-plugin`
 *
 * or
 *
 * `npm install \@vendure/email-plugin`
 *
 * @example
 * ```ts
 * import { defaultEmailHandlers, EmailPlugin, FileBasedTemplateLoader } from '\@vendure/email-plugin';
 *
 * const config: VendureConfig = {
 *   // Add an instance of the plugin to the plugins array
 *   plugins: [
 *     EmailPlugin.init({
 *       handler: defaultEmailHandlers,
 *       templateLoader: new FileBasedTemplateLoader(path.join(__dirname, '../static/email/templates')),
 *       transport: {
 *         type: 'smtp',
 *         host: 'smtp.example.com',
 *         port: 587,
 *         auth: {
 *           user: 'username',
 *           pass: 'password',
 *         }
 *       },
 *     }),
 *   ],
 * };
 * ```
 *
 * ## Email templates
 *
 * In the example above, the plugin has been configured to look in `<app-root>/static/email/templates`
 * for the email template files. If you used `\@vendure/create` to create your application, the templates will have
 * been copied to that location during setup.
 *
 * If you are installing the EmailPlugin separately, then you'll need to copy the templates manually from
 * `node_modules/\@vendure/email-plugin/templates` to a location of your choice, and then point the `templatePath` config
 * property at that directory.
 *
 * * ### Dynamic Email Templates
 * Instead of passing a static value to `templatePath`, use `templateLoader` to define a template path.
 * ```ts
 *   EmailPlugin.init({
 *    ...,
 *    templateLoader: new FileBasedTemplateLoader(my/order-confirmation/templates)
 *   })
 * ```
 * ## Customizing templates
 *
 * Emails are generated from templates which use [MJML](https://mjml.io/) syntax. MJML is an open-source HTML-like markup
 * language which makes the task of creating responsive email markup simple. By default, the templates are installed to
 * `<project root>/vendure/email/templates` and can be freely edited.
 *
 * Dynamic data such as the recipient's name or order items are specified using [Handlebars syntax](https://handlebarsjs.com/):
 *
 * ```html
 * <p>Dear {{ order.customer.firstName }} {{ order.customer.lastName }},</p>
 *
 * <p>Thank you for your order!</p>
 *
 * <mj-table cellpadding="6px">
 *   {{#each order.lines }}
 *     <tr class="order-row">
 *       <td>{{ quantity }} x {{ productVariant.name }}</td>
 *       <td>{{ productVariant.quantity }}</td>
 *       <td>{{ formatMoney totalPrice }}</td>
 *     </tr>
 *   {{/each}}
 * </mj-table>
 * ```
 *
 * ### Setting global variables using `globalTemplateVars`
 *
 * `globalTemplateVars` is an object that can be passed to the configuration of the Email Plugin with static object variables.
 * You can also pass an async function that will be called with the `RequestContext` and the `Injector` so you can access services
 * and e.g. load channel specific theme configurations.
 *
 * @example
 * ```ts
 * EmailPlugin.init({
 *    globalTemplateVars: {
 *      primaryColor: '#FF0000',
 *      fromAddress: 'no-reply@ourstore.com'
 *    }
 * })
 * ```
 * or
 * ```ts
 * EmailPlugin.init({
 *    globalTemplateVars: async (ctx, injector) => {
 *      const myAsyncService = injector.get(MyAsyncService);
 *      const asyncValue = await myAsyncService.get(ctx);
 *      const channel = ctx.channel;
 *      const { primaryColor } = channel.customFields.theme;
 *      const theme = {
 *         primaryColor,
 *         asyncValue,
 *      };
 *      return theme;
 *    }
 * })
 * ```
 *
 * ### Handlebars helpers
 *
 * The following helper functions are available for use in email templates:
 *
 * * `formatMoney`: Formats an amount of money (which are always stored as integers in Vendure) as a decimal, e.g. `123` => `1.23`
 * * `formatDate`: Formats a Date value with the [dateformat](https://www.npmjs.com/package/dateformat) package.
 *
 * ## Extending the default email handler
 *
 * The `defaultEmailHandlers` array defines the default handler such as for handling new account registration, order confirmation, password reset
 * etc. These defaults can be extended by adding custom templates for languages other than the default, or even completely new types of emails
 * which respond to any of the available [VendureEvents](/reference/typescript-api/events/).
 *
 * A good way to learn how to create your own email handler is to take a look at the
 * [source code of the default handler](https://github.com/vendurehq/vendure/blob/master/packages/email-plugin/src/handler/default-email-handlers.ts).
 * New handler are defined in exactly the same way.
 *
 * It is also possible to modify the default handler:
 *
 * ```ts
 * // Rather than importing `defaultEmailHandlers`, you can
 * // import the handler individually
 * import {
 *   orderConfirmationHandler,
 *   emailVerificationHandler,
 *   passwordResetHandler,
 *   emailAddressChangeHandler,
 * } from '\@vendure/email-plugin';
 * import { CustomerService } from '\@vendure/core';
 *
 * // This allows you to then customize each handler to your needs.
 * // For example, let's set a new subject line to the order confirmation:
 * const myOrderConfirmationHandler = orderConfirmationHandler
 *   .setSubject(`We received your order!`);
 *
 * // Another example: loading additional data and setting new
 * // template variables.
 * const myPasswordResetHandler = passwordResetHandler
 *   .loadData(async ({ event, injector }) => {
 *     const customerService = injector.get(CustomerService);
 *     const customer = await customerService.findOneByUserId(event.ctx, event.user.id);
 *     return { customer };
 *   })
 *   .setTemplateVars(event => ({
 *     passwordResetToken: event.user.getNativeAuthenticationMethod().passwordResetToken,
 *     customer: event.data.customer,
 *   }));
 *
 * // Then you pass the handler to the EmailPlugin init method
 * // individually
 * EmailPlugin.init({
 *   handler: [
 *     myOrderConfirmationHandler,
 *     myPasswordResetHandler,
 *     emailVerificationHandler,
 *     emailAddressChangeHandler,
 *   ],
 *   // ...
 * }),
 * ```
 *
 * For all available methods of extending a handler, see the {@link EmailEventHandler} documentation.
 *
 * ## Dynamic SMTP settings
 *
 * Instead of defining static transport settings, you can also provide a function that dynamically resolves
 * channel aware transport settings.
 *
 * @example
 * ```ts
 * import { defaultEmailHandlers, EmailPlugin, FileBasedTemplateLoader } from '\@vendure/email-plugin';
 * import { MyTransportService } from './transport.services.ts';
 * const config: VendureConfig = {
 *   plugins: [
 *     EmailPlugin.init({
 *       handler: defaultEmailHandlers,
 *       templateLoader: new FileBasedTemplateLoader(path.join(__dirname, '../static/email/templates')),
 *       transport: (injector, ctx) => {
 *         if (ctx) {
 *           return injector.get(MyTransportService).getSettings(ctx);
 *         } else {
 *           return {
 *             type: 'smtp',
 *             host: 'smtp.example.com',
 *             // ... etc.
 *           }
 *         }
 *       }
 *     }),
 *   ],
 * };
 * ```
 *
 * ## Dev mode
 *
 * For development, the `transport` option can be replaced by `devMode: true`. Doing so configures Vendure to use the
 * file transport (See {@link FileTransportOptions}) and outputs emails as rendered HTML files in the directory specified by the
 * `outputPath` property.
 *
 * ```ts
 * EmailPlugin.init({
 *   devMode: true,
 *   route: 'mailbox',
 *   handler: defaultEmailHandlers,
 *   templateLoader: new FileBasedTemplateLoader(path.join(__dirname, '../static/email/templates')),
 *   outputPath: path.join(__dirname, 'test-emails'),
 * })
 * ```
 *
 * ### Dev mailbox
 *
 * In dev mode, a webmail-like interface available at the `/mailbox` path, e.g.
 * http://localhost:3000/mailbox. This is a simple way to view the output of all emails generated by the EmailPlugin while in dev mode.
 *
 * ## Troubleshooting SMTP Connections
 *
 * If you are having trouble sending email over and SMTP connection, set the `logging` and `debug` options to `true`. This will
 * send detailed information from the SMTP transporter to the configured logger (defaults to console). For maximum detail combine
 * this with a detail log level in the configured VendureLogger:
 *
 * ```ts
 * const config: VendureConfig = {
 *   logger: new DefaultLogger({ level: LogLevel.Debug })
 *   // ...
 *   plugins: [
 *     EmailPlugin.init({
 *       // ...
 *       transport: {
 *         type: 'smtp',
 *         host: 'smtp.example.com',
 *         port: 587,
 *         auth: {
 *           user: 'username',
 *           pass: 'password',
 *         },
 *         logging: true,
 *         debug: true,
 *       },
 *     }),
 *   ],
 * };
 * ```
 *
 * @docsCategory core plugins/EmailPlugin
 */
let EmailPlugin = EmailPlugin_1 = class EmailPlugin {
    /** @internal */
    constructor(eventBus, moduleRef, emailProcessor, jobQueueService, processContext, options) {
        this.eventBus = eventBus;
        this.moduleRef = moduleRef;
        this.emailProcessor = emailProcessor;
        this.jobQueueService = jobQueueService;
        this.processContext = processContext;
        this.options = options;
    }
    /**
     * Set the plugin options.
     */
    static init(options) {
        if (options.templateLoader) {
            // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
            core_2.Logger.info(`Using custom template loader '${options.templateLoader.constructor.name}'`);
        }
        else if (!options.templateLoader && options.templatePath) {
            // TODO: this else-if can be removed when deprecated templatePath is removed,
            // because we will either have a custom template loader, or the default loader with a default path
            options.templateLoader = new file_based_template_loader_1.FileBasedTemplateLoader(options.templatePath);
        }
        else {
            throw new Error('You must either supply a templatePath or provide a custom templateLoader');
        }
        this.options = options;
        return EmailPlugin_1;
    }
    /** @internal */
    async onApplicationBootstrap() {
        await this.initInjectableStrategies();
        await this.setupEventSubscribers();
        const transport = await (0, common_2.resolveTransportSettings)(this.options, new core_2.Injector(this.moduleRef));
        if (!(0, common_2.isDevModeOptions)(this.options) && transport.type === 'testing') {
            // When running tests, we don't want to go through the JobQueue system,
            // so we just call the email sending logic directly.
            this.testingProcessor = new email_processor_1.EmailProcessor(this.options, this.moduleRef, this.eventBus);
            await this.testingProcessor.init();
        }
        else {
            await this.emailProcessor.init();
            this.jobQueue = await this.jobQueueService.createQueue({
                name: 'send-email',
                process: job => {
                    return this.emailProcessor.process(job.data);
                },
            });
        }
    }
    async onApplicationShutdown() {
        await this.destroyInjectableStrategies();
    }
    configure(consumer) {
        if ((0, common_2.isDevModeOptions)(this.options) && this.processContext.isServer) {
            core_2.Logger.info('Creating dev mailbox middleware', constants_1.loggerCtx);
            this.devMailbox = new dev_mailbox_1.DevMailbox();
            consumer.apply(this.devMailbox.serve(this.options)).forRoutes(this.options.route);
            this.devMailbox.handleMockEvent((handler, event) => this.handleEvent(handler, event));
            (0, core_2.registerPluginStartupMessage)('Dev mailbox', this.options.route);
        }
    }
    async initInjectableStrategies() {
        var _a, _b;
        const injector = new core_2.Injector(this.moduleRef);
        if (typeof ((_a = this.options.emailGenerator) === null || _a === void 0 ? void 0 : _a.init) === 'function') {
            await this.options.emailGenerator.init(injector);
        }
        if (typeof ((_b = this.options.emailSender) === null || _b === void 0 ? void 0 : _b.init) === 'function') {
            await this.options.emailSender.init(injector);
        }
    }
    async destroyInjectableStrategies() {
        var _a, _b;
        if (typeof ((_a = this.options.emailGenerator) === null || _a === void 0 ? void 0 : _a.destroy) === 'function') {
            await this.options.emailGenerator.destroy();
        }
        if (typeof ((_b = this.options.emailSender) === null || _b === void 0 ? void 0 : _b.destroy) === 'function') {
            await this.options.emailSender.destroy();
        }
    }
    async setupEventSubscribers() {
        for (const handler of EmailPlugin_1.options.handlers) {
            this.eventBus.ofType(handler.event).subscribe(event => {
                return this.handleEvent(handler, event);
            });
        }
    }
    async handleEvent(handler, event) {
        core_2.Logger.debug(`Handling event "${handler.type}"`, constants_1.loggerCtx);
        try {
            const injector = new core_2.Injector(this.moduleRef);
            let globalTemplateVars = this.options.globalTemplateVars;
            if (typeof globalTemplateVars === 'function') {
                globalTemplateVars = await globalTemplateVars(event.ctx, injector);
            }
            const result = await handler.handle(event, globalTemplateVars, injector);
            if (!result) {
                return;
            }
            if (this.jobQueue) {
                await this.jobQueue.add(result, { retries: 5 });
            }
            else if (this.testingProcessor) {
                await this.testingProcessor.process(result);
            }
        }
        catch (e) {
            core_2.Logger.error(e.message, constants_1.loggerCtx, e.stack);
        }
    }
};
exports.EmailPlugin = EmailPlugin;
exports.EmailPlugin = EmailPlugin = EmailPlugin_1 = __decorate([
    (0, core_2.VendurePlugin)({
        imports: [core_2.PluginCommonModule],
        providers: [{ provide: constants_1.EMAIL_PLUGIN_OPTIONS, useFactory: () => EmailPlugin.options }, email_processor_1.EmailProcessor],
        compatibility: '^3.0.0',
    }),
    __param(5, (0, common_1.Inject)(constants_1.EMAIL_PLUGIN_OPTIONS)),
    __metadata("design:paramtypes", [core_2.EventBus,
        core_1.ModuleRef,
        email_processor_1.EmailProcessor,
        core_2.JobQueueService,
        core_2.ProcessContext, Object])
], EmailPlugin);
//# sourceMappingURL=plugin.js.map