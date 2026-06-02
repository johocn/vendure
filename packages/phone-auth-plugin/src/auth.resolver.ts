import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { Inject } from '@nestjs/common';
import { PHONE_AUTH_PLUGIN_OPTIONS } from './constants';
import { PhoneAuthPluginOptions } from './types';
import { SmsService } from './sms.service';

@Resolver()
export class PhoneAuthResolver {
    constructor(
        @Inject(PHONE_AUTH_PLUGIN_OPTIONS) private options: PhoneAuthPluginOptions,
        private smsService: SmsService,
    ) {}

    @Mutation()
    async sendPhoneVerificationCode(@Args('phoneNumber') phoneNumber: string): Promise<boolean> {
        return this.smsService.sendVerificationCode(phoneNumber);
    }
}
