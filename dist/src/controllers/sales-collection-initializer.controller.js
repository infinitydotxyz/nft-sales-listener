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
exports.addCollectionToQueue = void 0;
const p_queue_1 = __importDefault(require("p-queue"));
const OpenSea_1 = __importDefault(require("../services/OpenSea"));
const collection_stats_model_1 = __importDefault(require("../models/collection-stats.model"));
const container_1 = require("../container");
const taskQueue = new p_queue_1.default({ concurrency: 1, interval: 2000, intervalCap: 2 });
const openseaClient = new OpenSea_1.default();
const initCollectionStatsFromOS = (collectionAddress, tokenId, chainId) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const cs = yield openseaClient.getCollectionStatsByTokenInfo(collectionAddress, tokenId, chainId);
        yield collection_stats_model_1.default.initStatsFromOS(cs, collectionAddress);
        container_1.logger.log(`--- Wrote CollectionStats from OpenSea: [${collectionAddress}]`);
    }
    catch (err) {
        container_1.logger.error('opensea-sales-listener: [initCollectionStatsFromOS]', { collectionAddress });
        throw err;
    }
});
const addCollectionToQueue = (collectionAddr, tokenId, chainId = '1') => __awaiter(void 0, void 0, void 0, function* () {
    yield taskQueue.add(() => __awaiter(void 0, void 0, void 0, function* () { return yield initCollectionStatsFromOS(collectionAddr, tokenId, chainId); }));
});
exports.addCollectionToQueue = addCollectionToQueue;
//# sourceMappingURL=sales-collection-initializer.controller.js.map