"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GreeterSharedModule = void 0;
const core_1 = require("@angular/core");
const core_2 = require("@vendure/admin-ui/core");
let GreeterSharedModule = class GreeterSharedModule {
};
exports.GreeterSharedModule = GreeterSharedModule;
exports.GreeterSharedModule = GreeterSharedModule = __decorate([
    (0, core_1.NgModule)({
        imports: [core_2.SharedModule],
        providers: [
            (0, core_2.addNavMenuSection)({
                id: 'greeter',
                label: 'My Extensions',
                items: [
                    {
                        id: 'greeter',
                        label: 'Greeter',
                        routerLink: ['/extensions/greet'],
                        // Icon can be any of https://clarity.design/icons
                        icon: 'cursor-hand-open',
                    },
                ],
            }, 
            // Add this section before the "settings" section
            'settings'),
        ],
    })
], GreeterSharedModule);
//# sourceMappingURL=greeter-shared.module.js.map