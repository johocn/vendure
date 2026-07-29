"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@angular/core");
const core_2 = require("@vendure/admin-ui/core");
const operators_1 = require("rxjs/operators");
let MyService = class MyService {
    greet() {
        console.log('Hello!');
    }
};
MyService = __decorate([
    (0, core_1.Injectable)()
], MyService);
exports.default = [
    MyService,
    (0, core_2.addNavMenuSection)({
        id: 'greeter',
        label: 'My Extensions',
        items: [
            {
                id: 'greeter',
                label: 'Greeter',
                routerLink: ['/extensions/example/greet'],
                // Icon can be any of https://clarity.design/icons
                icon: 'cursor-hand-open',
            },
        ],
    }, 
    // Add this section before the "settings" section
    'settings'),
    (0, core_2.addActionBarItem)({
        id: 'test',
        icon: 'cursor-hand-open',
        label: 'Test',
        locationId: 'order-detail',
        buttonState: context => {
            return context.route.data.pipe((0, operators_1.switchMap)(data => data.detail.entity), (0, operators_1.map)((order) => {
                context.injector.get(MyService).greet();
                console.log(order);
                return {
                    disabled: order.state === 'AddingItems',
                    visible: true,
                };
            }));
            // return interval(1000).pipe(
            //     map(t => {
            //         console.log(t);
            //         return {
            //             disabled: t % 2 === 0,
            //             visible: t % 5 !== 0,
            //         };
            //     }),
            // );
        },
    }),
];
//# sourceMappingURL=providers.js.map