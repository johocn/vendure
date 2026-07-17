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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailProcessor = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const core_2 = require("@vendure/core");
const fs_extra_1 = __importDefault(require("fs-extra"));
const attachment_utils_1 = require("./attachment-utils");
const common_2 = require("./common");
const constants_1 = require("./constants");
const email_send_event_1 = require("./email-send-event");
const handlebars_mjml_generator_1 = require("./generator/handlebars-mjml-generator");
const nodemailer_email_sender_1 = require("./sender/nodemailer-email-sender");
/**
 * This class combines the template loading, generation, and email sending - the actual "work" of
 * the EmailPlugin. It is arranged this way primarily to accommodate easier testing, so that the
 * tests can be run without needing all the JobQueue stuff which would require a full e2e test.
 */
let EmailProcessor = class EmailProcessor {
    constructor(options, moduleRef, eventBus) {
        this.options = options;
        this.moduleRef = moduleRef;
        this.eventBus = eventBus;
    }
    async init() {
        this.emailSender = this.options.emailSender ? this.options.emailSender : new nodemailer_email_sender_1.NodemailerEmailSender();
        this.generator = this.options.emailGenerator
            ? this.options.emailGenerator
            : new handlebars_mjml_generator_1.HandlebarsMjmlGenerator();
        if (this.generator.onInit) {
            await this.generator.onInit.call(this.generator, this.options);
        }
        const transport = await this.getTransportSettings();
        if (transport.type === 'file') {
            // ensure the configured directory exists before
            // we attempt to write files to it
            const emailPath = transport.outputPath;
            await fs_extra_1.default.ensureDir(emailPath);
        }
    }
    async process(data) {
        const ctx = core_2.RequestContext.deserialize(data.ctx);
        let emailDetails = {};
        try {
            const bodySource = await this.options.templateLoader.loadTemplate(new core_2.Injector(this.moduleRef), ctx, {
                templateName: data.templateFile,
                type: data.type,
                templateVars: data.templateVars,
            });
            const generated = await this.generator.generate(data.from, data.subject, bodySource, data.templateVars);
            emailDetails = Object.assign(Object.assign({}, generated), { recipient: data.recipient, attachments: (0, attachment_utils_1.deserializeAttachments)(data.attachments), cc: data.cc, bcc: data.bcc, replyTo: data.replyTo });
            const transportSettings = await this.getTransportSettings(ctx);
            await this.emailSender.send(emailDetails, transportSettings);
            await this.eventBus.publish(new email_send_event_1.EmailSendEvent(ctx, emailDetails, true, undefined, data.metadata));
            return true;
        }
        catch (err) {
            if (err instanceof Error) {
                core_2.Logger.error(err.message, constants_1.loggerCtx, err.stack);
            }
            else {
                core_2.Logger.error(String(err), constants_1.loggerCtx);
            }
            await this.eventBus.publish(new email_send_event_1.EmailSendEvent(ctx, emailDetails, false, err, data.metadata));
            throw err;
        }
    }
    async getTransportSettings(ctx) {
        const transport = await (0, common_2.resolveTransportSettings)(this.options, new core_2.Injector(this.moduleRef), ctx);
        if ((0, common_2.isDevModeOptions)(this.options)) {
            if (transport && transport.type !== 'file') {
                core_2.Logger.warn(`The EmailPlugin is running in dev mode. The configured '${transport.type}' transport will be replaced by the 'file' transport.`, constants_1.loggerCtx);
            }
            return {
                type: 'file',
                raw: false,
                outputPath: this.options.outputPath,
            };
        }
        else {
            return transport;
        }
    }
};
exports.EmailProcessor = EmailProcessor;
exports.EmailProcessor = EmailProcessor = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(constants_1.EMAIL_PLUGIN_OPTIONS)),
    __metadata("design:paramtypes", [Object, core_1.ModuleRef,
        core_2.EventBus])
], EmailProcessor);
//# sourceMappingURL=email-processor.js.map