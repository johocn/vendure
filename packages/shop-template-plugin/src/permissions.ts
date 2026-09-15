import { PermissionDefinition } from '@vendure/core';

export const shopTemplatesRead = new PermissionDefinition({
    name: 'ShopTemplatesRead',
    description: 'Allows viewing the shop template library and global config',
});
export const shopTemplatesCreate = new PermissionDefinition({
    name: 'ShopTemplatesCreate',
    description: 'Allows creating and copying shop templates',
});
export const shopTemplatesUpdate = new PermissionDefinition({
    name: 'ShopTemplatesUpdate',
    description: 'Allows updating shop templates and global config',
});
export const shopTemplatesDelete = new PermissionDefinition({
    name: 'ShopTemplatesDelete',
    description: 'Allows deleting shop templates',
});
