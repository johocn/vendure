"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GreeterComponent = void 0;
const core_1 = require("@angular/core");
const core_2 = require("@vendure/admin-ui/core");
let GreeterComponent = class GreeterComponent {
    constructor() {
        this.greeting = 'Hello!';
        this.title = 'Greeter Page';
        this.pageMetadataService = (0, core_1.inject)(core_2.PageMetadataService);
    }
    setTitle() {
        this.pageMetadataService.setTitle(this.title);
        this.pageMetadataService.setBreadcrumbs(this.title);
    }
};
exports.GreeterComponent = GreeterComponent;
exports.GreeterComponent = GreeterComponent = __decorate([
    (0, core_1.Component)({
        selector: 'greeter',
        template: `<vdr-page-block>
        <h1>{{ greeting }}</h1>
        <vdr-card>
            <input [(ngModel)]="title" />
            <button class="button secondary" (click)="setTitle()">Set title</button>
        </vdr-card>
    </vdr-page-block>`,
        standalone: true,
        imports: [core_2.SharedModule],
    })
], GreeterComponent);
exports.default = [
    (0, core_2.registerRouteComponent)({
        component: GreeterComponent,
        path: 'greet',
        title: 'Greeter Page',
    }),
];
//# sourceMappingURL=routes.js.map