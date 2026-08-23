import { PermissionDefinition } from '@vendure/core';

export const SetGlobalPickupLocation = new PermissionDefinition({
    name: 'SetGlobalPickupLocation',
    description: '允许创建/提升/编辑全局自提点（超管专用）',
});

export const pickupLocationPermissionDefinitions = [SetGlobalPickupLocation];