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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ERROR_LOG = exports.INFO_LOG = exports.NULL_ADDR = exports.JSON_RPC_MAINNET_KEYS = exports.FIREBASE_SERVICE_ACCOUNT = exports.FB_STORAGE_BUCKET = exports.MORALIS_API_KEY = exports.OPENSEA_API_KEY = exports.DBN_SALES = exports.DBN_HISTORY = exports.DBN_NFT_STATS = exports.DBN_ALL_TIME = exports.DBN_COLLECTION_STATS = void 0;
__exportStar(require("./wyvern-constants"), exports);
exports.DBN_COLLECTION_STATS = 'collection-stats';
exports.DBN_ALL_TIME = 'all-time';
exports.DBN_NFT_STATS = 'nft-stats';
exports.DBN_HISTORY = 'history';
exports.DBN_SALES = 'sales';
function getEnvironmentVariable(name, required = true) {
    var _a;
    const variable = (_a = process.env[name]) !== null && _a !== void 0 ? _a : '';
    if (required && !variable) {
        throw new Error(`Missing environment variable ${name}`);
    }
    return variable;
}
exports.OPENSEA_API_KEY = getEnvironmentVariable('OPENSEA_API_KEY');
exports.MORALIS_API_KEY = getEnvironmentVariable('MORALIS_API_KEY');
exports.FB_STORAGE_BUCKET = 'nftc-dev.appspot.com';
exports.FIREBASE_SERVICE_ACCOUNT = 'firebase-dev.json';
exports.JSON_RPC_MAINNET_KEYS = (() => {
    const apiKeys = [];
    let i = 0;
    while (true) {
        try {
            const apiKey = getEnvironmentVariable(`JSON_RPC_MAINNET${i}`);
            apiKeys.push(apiKey);
            i += 1;
        }
        catch (err) {
            break;
        }
    }
    return apiKeys;
})();
exports.NULL_ADDR = '0x0000000000000000000000000000000000000000';
/**
 *
 * Logger Config
 *
 */
exports.INFO_LOG = process.env.INFO_LOG !== 'false'; // explicity set to false to disable logs
exports.ERROR_LOG = process.env.ERROR_LOG !== 'false'; // explicitly set to false to disable logs
//# sourceMappingURL=index.js.map