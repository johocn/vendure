// e:\code\vendure\packages\cjk-plugin\dashboard\lib\map-graphql.ts
import { graphql } from '@vendure/dashboard';

export const getMapSdkConfig = graphql(`
    query GetMapSdkConfig {
        mapSdkConfig {
            provider
            sdkUrl
            hasConfigured
        }
    }
`);

export const getMapDistricts = graphql(`
    query GetMapDistricts($parentAdcode: String) {
        mapDistricts(parentAdcode: $parentAdcode) {
            adcode
            name
            level
            center {
                lat
                lng
            }
        }
    }
`);

export const reverseGeocode = graphql(`
    query ReverseGeocode($lat: Float!, $lng: Float!) {
        reverseGeocode(lat: $lat, lng: $lng) {
            province
            city
            district
            street
            formattedAddress
        }
    }
`);
