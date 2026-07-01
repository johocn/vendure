"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodemailerEmailSender = void 0;
const normalize_string_1 = require("@vendure/common/lib/normalize-string");
const shared_utils_1 = require("@vendure/common/lib/shared-utils");
const core_1 = require("@vendure/core");
const fs_extra_1 = __importDefault(require("fs-extra"));
const nodemailer_1 = require("nodemailer");
const path_1 = __importDefault(require("path"));
const util_1 = require("util");
const constants_1 = require("../constants");
/**
 * @description
 * Uses the configured transport to send the generated email.
 *
 * @docsCategory core plugins/EmailPlugin
 * @docsPage EmailSender
 */
class NodemailerEmailSender {
    isNew(transport, options) {
        try {
            return JSON.stringify(transport === null || transport === void 0 ? void 0 : transport.options) !== JSON.stringify(options);
        }
        catch (error) {
            core_1.Logger.error((0, util_1.format)(error.message), constants_1.loggerCtx);
            return false;
        }
    }
    async send(email, options) {
        switch (options.type) {
            case 'none':
                return;
                break;
            case 'file':
                const fileName = (0, normalize_string_1.normalizeString)(`${new Date().toISOString()} ${email.recipient} ${email.subject}`, '_');
                const filePath = path_1.default.join(options.outputPath, fileName);
                if (options.raw) {
                    await this.sendFileRaw(email, filePath);
                }
                else {
                    await this.sendFileJson(email, filePath);
                }
                break;
            case 'sendmail':
                await this.sendMail(email, this.getSendMailTransport(options));
                break;
            case 'ses':
                await this.sendMail(email, this.getSesTransport(options));
                break;
            case 'smtp':
                await this.sendMail(email, this.getSmtpTransport(options));
                break;
            case 'testing':
                options.onSend(email);
                break;
            default:
                return (0, shared_utils_1.assertNever)(options);
        }
    }
    getSmtpTransport(options) {
        if (!this._smtpTransport || this.isNew(this._smtpTransport, options)) {
            options.logger = options.logging ? this.createLogger() : false;
            this._smtpTransport = (0, nodemailer_1.createTransport)(options);
        }
        return this._smtpTransport;
    }
    getSesTransport(options) {
        if (!this._sesTransport || this.isNew(this._sesTransport, options)) {
            this._sesTransport = (0, nodemailer_1.createTransport)(options);
        }
        return this._sesTransport;
    }
    getSendMailTransport(options) {
        if (!this._sendMailTransport ||
            this.isNew(this._sendMailTransport, Object.assign({ sendmail: true }, options))) {
            this._sendMailTransport = (0, nodemailer_1.createTransport)(Object.assign({ sendmail: true }, options));
        }
        return this._sendMailTransport;
    }
    async sendMail(email, transporter) {
        return transporter.sendMail({
            from: email.from,
            to: email.recipient,
            subject: email.subject,
            html: email.body,
            attachments: email.attachments,
            cc: email.cc,
            bcc: email.bcc,
            replyTo: email.replyTo,
        });
    }
    async sendFileJson(email, pathWithoutExt) {
        const output = {
            date: new Date().toLocaleString(),
            from: email.from,
            recipient: email.recipient,
            subject: email.subject,
            body: email.body,
            cc: email.cc,
            bcc: email.bcc,
            replyTo: email.replyTo,
        };
        await fs_extra_1.default.writeFile(pathWithoutExt + '.json', JSON.stringify(output, null, 2));
    }
    async sendFileRaw(email, pathWithoutExt) {
        const transporter = (0, nodemailer_1.createTransport)({
            streamTransport: true,
            buffer: true,
        });
        const result = await this.sendMail(email, transporter);
        await this.writeStreamToFile(pathWithoutExt + '.txt', result);
    }
    async writeStreamToFile(filePath, info) {
        const writeStream = fs_extra_1.default.createWriteStream(filePath);
        return new Promise((resolve, reject) => {
            writeStream.on('open', () => {
                info.message.pipe(writeStream);
                writeStream.on('close', resolve);
                writeStream.on('error', reject);
            });
        });
    }
    /**
     * Adapts the VendureLogger to work with the bunyan-compatible logger format
     * used by Nodemailer.
     */
    createLogger() {
        function formatError(args) {
            const [ctx, message, ...params] = args;
            return (0, util_1.format)(message, ...params);
        }
        return {
            level(level) {
                /* noop */
            },
            trace(...params) {
                core_1.Logger.debug(formatError(params), constants_1.loggerCtx);
            },
            debug(...params) {
                core_1.Logger.verbose(formatError(params), constants_1.loggerCtx);
            },
            info(...params) {
                core_1.Logger.info(formatError(params), constants_1.loggerCtx);
            },
            warn(...params) {
                core_1.Logger.warn(formatError(params), constants_1.loggerCtx);
            },
            error(...params) {
                core_1.Logger.error(formatError(params), constants_1.loggerCtx);
            },
            fatal(...params) {
                core_1.Logger.error(formatError(params), constants_1.loggerCtx);
            },
        };
    }
}
exports.NodemailerEmailSender = NodemailerEmailSender;
//# sourceMappingURL=nodemailer-email-sender.js.map