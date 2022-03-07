"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ethers_1 = require("ethers");
const utils_1 = require("../utils");
const constants_1 = require("../constants");
const source_1 = __importDefault(require("got/dist/source"));
const got_1 = require("../utils/got");
/**
 * formatName takes a name from opensea and adds spaces before capital letters
 * (e.g. BoredApeYachtClub => Bored Ape Yacht Club)
 */
function formatName(name) {
    let formattedName = '';
    for (const char of name) {
        const isUpperCase = /^[A-Z]$/.test(char);
        const prevCharIsSpace = formattedName[formattedName.length - 1] === ' ';
        const isFirstChar = formattedName.length === 0;
        if (isUpperCase && !prevCharIsSpace && !isFirstChar) {
            formattedName = `${formattedName} ${char}`;
        }
        else {
            formattedName = `${formattedName}${char}`;
        }
    }
    return formattedName;
}
/**
 * we try not to use OpenSea more than we have to
 * prefer other methods of getting data if possible
 */
class OpenSeaClient {
    constructor() {
        this.client = source_1.default.extend({
            prefixUrl: 'https://api.opensea.io/api/v1/',
            headers: {
                'x-api-key': constants_1.OPENSEA_API_KEY
            },
            /**
             * requires us to check status code
             */
            throwHttpErrors: false,
            cache: false,
            timeout: 20000
        });
    }
    /**
     * getCollectionMetadata gets basic info about a collection: name, description, links, images
     *
     * it seems like rate limits are not an issue on this endpoint - at this time
     * (it handles ~500 requests at once using the default api key and none get rate limited)
     *
     * etherscan has a similar endpoint that seems decent if this begins to fail
     */
    getCollectionMetadata(address) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
        return __awaiter(this, void 0, void 0, function* () {
            if (!ethers_1.ethers.utils.isAddress(address)) {
                throw new Error('Invalid address');
            }
            const response = yield this.errorHandler(() => {
                return this.client.get(`asset_contract/${address}`, {
                    responseType: 'json'
                });
            });
            const data = response.body;
            const collection = data.collection;
            /**
             * not sure why opensea formats names like (BoredApeYachtClub)
             */
            const name = formatName((_a = data.name) !== null && _a !== void 0 ? _a : '');
            const dataInInfinityFormat = {
                name,
                description: (_b = data.description) !== null && _b !== void 0 ? _b : '',
                symbol: (_c = data.symbol) !== null && _c !== void 0 ? _c : '',
                profileImage: (_d = collection.image_url) !== null && _d !== void 0 ? _d : '',
                bannerImage: (_e = collection.banner_image_url) !== null && _e !== void 0 ? _e : '',
                links: {
                    timestamp: new Date().getTime(),
                    discord: (_f = collection.discord_url) !== null && _f !== void 0 ? _f : '',
                    external: (_g = collection.external_url) !== null && _g !== void 0 ? _g : '',
                    medium: typeof (collection === null || collection === void 0 ? void 0 : collection.medium_username) === 'string' ? `https://medium.com/${collection.medium_username}` : '',
                    slug: (_h = collection === null || collection === void 0 ? void 0 : collection.slug) !== null && _h !== void 0 ? _h : '',
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                    telegram: (_j = collection === null || collection === void 0 ? void 0 : collection.telegram_url) !== null && _j !== void 0 ? _j : '',
                    twitter: typeof (collection === null || collection === void 0 ? void 0 : collection.twitter_username) === 'string' ? `https://twitter.com/${collection.twitter_username}` : '',
                    instagram: typeof (collection === null || collection === void 0 ? void 0 : collection.instagram_username) === 'string' ? `https://instagram.com/${collection.instagram_username}` : '',
                    wiki: (_k = collection === null || collection === void 0 ? void 0 : collection.wiki_url) !== null && _k !== void 0 ? _k : ''
                }
            };
            return dataInInfinityFormat;
        });
    }
    /**
     * getCollectionStats using the opensea slug (not the same as the infinity slug)
     */
    getCollectionStats(slug) {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield this.errorHandler(() => {
                return this.client.get(`collection/${slug}/stats`, {
                    responseType: 'json'
                });
            });
            const stats = res.body;
            return stats;
        });
    }
    getCollections(offset = 0, limit = 300) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield this.errorHandler(() => {
                return this.client.get(`collections`, {
                    searchParams: {
                        offset,
                        limit
                    },
                    responseType: 'json'
                });
            });
            const collections = (_b = (_a = res === null || res === void 0 ? void 0 : res.body) === null || _a === void 0 ? void 0 : _a.collections) !== null && _b !== void 0 ? _b : [];
            return collections;
        });
    }
    getCollection(slug) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield this.errorHandler(() => {
                return this.client.get(`collection/${slug}`, {
                    responseType: 'json'
                });
            });
            const collection = (_b = (_a = res === null || res === void 0 ? void 0 : res.body) === null || _a === void 0 ? void 0 : _a.collection) !== null && _b !== void 0 ? _b : {};
            return collection;
        });
    }
    getCollectionStatsByTokenInfo(collectionAddr, tokenId, chainId) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield this.errorHandler(() => {
                return this.client.get(`asset/${collectionAddr}/${tokenId}`, {
                    responseType: 'json'
                });
            });
            const collectionStats = (_b = (_a = res === null || res === void 0 ? void 0 : res.body) === null || _a === void 0 ? void 0 : _a.collection.stats) !== null && _b !== void 0 ? _b : {};
            return collectionStats;
        });
    }
    errorHandler(request, maxAttempts = 3) {
        return __awaiter(this, void 0, void 0, function* () {
            let attempt = 0;
            while (true) {
                attempt += 1;
                try {
                    const res = yield request();
                    switch (res.statusCode) {
                        case 200:
                            return res;
                        case 404:
                            throw new Error('Not found');
                        case 429:
                            yield (0, utils_1.sleep)(5000);
                            throw new Error('Rate limited');
                        case 500:
                            throw new Error('Internal server error');
                        case 504:
                            yield (0, utils_1.sleep)(5000);
                            throw new Error('OpenSea down');
                        default:
                            yield (0, utils_1.sleep)(2000);
                            throw new Error(`Unknown status code: ${res.statusCode}`);
                    }
                }
                catch (err) {
                    const handlerRes = (0, got_1.gotErrorHandler)(err);
                    if ('retry' in handlerRes) {
                        yield (0, utils_1.sleep)(handlerRes.delay);
                    }
                    else if (!handlerRes.fatal) {
                        // unknown error
                        if (attempt >= maxAttempts) {
                            throw err;
                        }
                    }
                    else {
                        throw err;
                    }
                }
            }
        });
    }
}
exports.default = OpenSeaClient;
//# sourceMappingURL=OpenSea.js.map