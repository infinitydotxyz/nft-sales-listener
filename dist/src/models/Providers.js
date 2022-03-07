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
Object.defineProperty(exports, "__esModule", { value: true });
const providers_1 = require("@ethersproject/providers");
const tsyringe_1 = require("tsyringe");
const constants_1 = require("../constants");
const utils_1 = require("../utils");
let Providers = class Providers {
    constructor() {
        const mainnetProviders = constants_1.JSON_RPC_MAINNET_KEYS.map((item) => {
            return new providers_1.JsonRpcProvider(item);
        });
        this.providers = {
            '1': mainnetProviders
        };
    }
    getProviderByChainId(chainId) {
        const chainIdProviders = this.providers[chainId];
        if (!chainIdProviders || chainIdProviders.length === 0) {
            throw new Error(`Provider not available for chain id: ${chainId}`);
        }
        const provider = (0, utils_1.randomItem)(chainIdProviders);
        return provider;
    }
};
Providers = __decorate([
    (0, tsyringe_1.singleton)(),
    __metadata("design:paramtypes", [])
], Providers);
exports.default = Providers;
//# sourceMappingURL=Providers.js.map