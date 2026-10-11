import { PermissionDefinition } from '@vendure/core';

export const DiyRead = new PermissionDefinition({
    name: 'DiyRead',
    description: 'Allows viewing DIY categories, materials, templates and plans',
});
export const DiyCreate = new PermissionDefinition({
    name: 'DiyCreate',
    description: 'Allows creating DIY categories, materials and templates',
});
export const DiyUpdate = new PermissionDefinition({
    name: 'DiyUpdate',
    description: 'Allows updating DIY categories, materials, templates and importing materials',
});
export const DiyDelete = new PermissionDefinition({
    name: 'DiyDelete',
    description: 'Allows deleting DIY categories, materials and templates',
});
