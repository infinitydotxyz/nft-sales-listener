"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
var __await = (this && this.__await) || function (v) { return this instanceof __await ? (this.v = v, this) : new __await(v); }
var __asyncGenerator = (this && this.__asyncGenerator) || function (thisArg, _arguments, generator) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var g = generator.apply(thisArg, _arguments || []), i, q = [];
    return i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i;
    function verb(n) { if (g[n]) i[n] = function (v) { return new Promise(function (a, b) { q.push([n, v, a, b]) > 1 || resume(n, v); }); }; }
    function resume(n, v) { try { step(g[n](v)); } catch (e) { settle(q[0][3], e); } }
    function step(r) { r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r); }
    function fulfill(value) { resume("next", value); }
    function reject(value) { resume("throw", value); }
    function settle(f, v) { if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const got_1 = __importDefault(require("got"));
const utils_1 = require("../utils");
const constants_1 = require("../constants");
const got_2 = require("../utils/got");
const p_queue_1 = __importDefault(require("p-queue"));
const tsyringe_1 = require("tsyringe");
const container_1 = require("../container");
let Moralis = class Moralis {
    constructor() {
        this.client = got_1.default.extend({
            /**
             * requires us to check status code
             */
            throwHttpErrors: false,
            cache: false,
            timeout: 10000,
            headers: {
                'X-API-KEY': constants_1.MORALIS_API_KEY
            }
        });
        this.queue = new p_queue_1.default({
            concurrency: 10,
            intervalCap: 17,
            interval: 3000
        });
    }
    /**
     * getTokens returns a single page of tokens (up to 500)
     */
    getTokens(address, chainId, cursor) {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield this.errorHandler(() => this.client.get({
                url: `https://deep-index.moralis.io/api/v2/nft/${address}`,
                searchParams: {
                    chain: this.getChain(chainId),
                    cursor
                },
                responseType: 'json'
            }));
            return res;
        });
    }
    /**
     * getAllTokens gets all tokens for a contract
     */
    getAllTokens(address, chainId) {
        return __awaiter(this, void 0, void 0, function* () {
            const thunkedRequest = (cursor) => __awaiter(this, void 0, void 0, function* () { return yield this.getTokens(address, chainId, cursor); });
            const res = yield this.paginate(thunkedRequest);
            return res;
        });
    }
    /**
     * getTokenMetadata gets the token metadata for a specific tokenId
     */
    getTokenMetadata(address, chainId, tokenId) {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield this.errorHandler(() => this.client.get({
                url: `https://deep-index.moralis.io/api/v2/nft/${address}/${tokenId}`,
                searchParams: {
                    chain: this.getChain(chainId)
                },
                responseType: 'json'
            }));
            const token = res.body;
            if (token.metadata === null) {
                throw new Error("Moralis doesn't have metadata");
            }
            const metadata = JSON.parse(token.metadata);
            if (!metadata) {
                throw new Error('Failed to get metadata from moralis');
            }
            return metadata;
        });
    }
    /**
     * getChain returns the moralis chain parameter given the base 10 chain id
     */
    getChain(chainId) {
        const int = parseInt(chainId, 10);
        if (Number.isNaN(int)) {
            throw new Error(`invalid chainId: ${chainId}`);
        }
        const hex = int.toString(16);
        return `0x${hex}`;
    }
    errorHandler(request, maxAttempts = 3) {
        return __awaiter(this, void 0, void 0, function* () {
            let attempt = 0;
            while (true) {
                attempt += 1;
                try {
                    const res = yield this.queue.add(() => __awaiter(this, void 0, void 0, function* () {
                        return yield request();
                    }));
                    switch (res.statusCode) {
                        case 200:
                            return res;
                        case 429:
                            throw new Error('Rate limited');
                        default:
                            throw new Error(`Moralis client received unknown status code ${res.statusCode}`);
                    }
                }
                catch (err) {
                    container_1.logger.error('Failed moralis request', err);
                    const handlerRes = (0, got_2.gotErrorHandler)(err);
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
    paginate(thunkedRequest) {
        var e_1, _a;
        return __awaiter(this, void 0, void 0, function* () {
            let results = [];
            try {
                for (var _b = __asyncValues(this.paginateHelper(thunkedRequest)), _c; _c = yield _b.next(), !_c.done;) {
                    const chunk = _c.value;
                    results = [...results, ...chunk];
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (_c && !_c.done && (_a = _b.return)) yield _a.call(_b);
                }
                finally { if (e_1) throw e_1.error; }
            }
            return results;
        });
    }
    paginateHelper(thunkedRequest) {
        return __asyncGenerator(this, arguments, function* paginateHelper_1() {
            let hasNextPage = true;
            let cursor = '';
            let numResults = 0;
            while (hasNextPage) {
                const res = yield __await(thunkedRequest(cursor));
                let body = res.body;
                if (typeof body === 'string') {
                    body = JSON.parse(body);
                }
                numResults += body.page_size;
                hasNextPage = !!body.cursor && body.total > numResults;
                cursor = body.cursor;
                if (body.result && body.result.length > 0 && Array.isArray(body.result)) {
                    yield yield __await(body.result);
                }
                else {
                    throw new Error('Failed to get page');
                }
            }
        });
    }
};
Moralis = __decorate([
    (0, tsyringe_1.singleton)(),
    __metadata("design:paramtypes", [])
], Moralis);
exports.default = Moralis;
//# sourceMappingURL=Moralis.js.map