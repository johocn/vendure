"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocationMap = LocationMap;
const jsx_runtime_1 = require("react/jsx-runtime");
const api_1 = require("@react-google-maps/api");
const react_1 = require("@vendure/admin-ui/react");
const react_2 = __importStar(require("react"));
const containerStyle = {
    width: '100%',
    height: '400px',
};
const center = {
    lat: 48.212616,
    lng: 16.3230408,
};
function LocationMap() {
    const { isLoaded } = (0, api_1.useJsApiLoader)({
        id: 'google-map-script',
        googleMapsApiKey: 'AIzaSyCKxhBHUymQG7L57NeRhJRdzlvO4kcymXU',
    });
    const [map, setMap] = react_2.default.useState(null);
    const onLoad = react_2.default.useCallback(function callback(map) {
        // This is just an example of getting and using the map instance!!! don't just blindly copy!
        const bounds = new window.google.maps.LatLngBounds(center);
        map.fitBounds(bounds);
        setMap(map);
        new window.google.maps.Marker({
            position: center,
            map,
            title: 'Hello World!',
        });
    }, []);
    (0, react_2.useEffect)(() => {
        setTimeout(() => {
            map === null || map === void 0 ? void 0 : map.setZoom(9);
        }, 1000);
    }, [map]);
    const onUnmount = react_2.default.useCallback(function callback(map) {
        setMap(null);
    }, []);
    return isLoaded ? ((0, jsx_runtime_1.jsx)("div", { className: "mb-4", children: (0, jsx_runtime_1.jsx)(react_1.Card, { title: "Location", children: (0, jsx_runtime_1.jsx)(api_1.GoogleMap, { mapContainerStyle: containerStyle, center: center, onLoad: onLoad, onUnmount: onUnmount, options: {
                    zoom: 20,
                    minZoom: 10,
                    fullscreenControl: false,
                    streetViewControl: false,
                    zoomControl: false,
                    mapTypeControl: false,
                }, children: (0, jsx_runtime_1.jsx)(jsx_runtime_1.Fragment, {}) }) }) })) : ((0, jsx_runtime_1.jsx)(jsx_runtime_1.Fragment, {}));
}
//# sourceMappingURL=LocationMap.js.map