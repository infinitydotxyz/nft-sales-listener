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
Object.defineProperty(exports, "__esModule", { value: true });
const container_1 = require("../container");
const utils_1 = require("../utils");
const types_1 = require("../types");
const constants_1 = require("../constants");
const utils_2 = require("../utils");
const getNewStats = (prevStats, incomingStats) => {
    const totalVolume = prevStats.totalVolume + incomingStats.totalVolume;
    const totalNumSales = prevStats.totalNumSales + incomingStats.totalNumSales;
    return {
        floorPrice: Math.min(prevStats.floorPrice, incomingStats.floorPrice),
        ceilPrice: Math.max(prevStats.ceilPrice, incomingStats.ceilPrice),
        totalVolume,
        totalNumSales,
        avgPrice: totalVolume / totalNumSales,
        updateAt: incomingStats.updateAt
    };
};
/**
 * @description save the orders into <sales> collection
 */
const handleOrders = (orders, totalPrice, chainId = '1') => __awaiter(void 0, void 0, void 0, function* () {
    const db = container_1.firebase.db;
    const nftDocId = (0, utils_2.getHashByNftAddress)(chainId, orders[0].collectionAddress, orders[0].tokenId);
    const statsRef = db.collection(constants_1.DBN_NFT_STATS).doc(nftDocId);
    yield db.runTransaction((t) => __awaiter(void 0, void 0, void 0, function* () {
        const incomingStats = {
            floorPrice: orders[0].price,
            ceilPrice: orders[0].price,
            totalVolume: totalPrice,
            totalNumSales: orders.length,
            avgPrice: orders[0].price,
            updateAt: orders[0].blockTimestamp
        };
        const docRefArray = [];
        const promiseArray = [];
        docRefArray.push(statsRef);
        promiseArray.push(t.get(statsRef));
        Object.values(types_1.BASE_TIME).forEach((baseTime) => {
            const docId = (0, utils_1.getDocumentIdByTime)(orders[0].blockTimestamp, baseTime);
            const docRef = statsRef.collection(baseTime).doc(docId);
            promiseArray.push(t.get(docRef));
            docRefArray.push(docRef);
        });
        const dataArray = yield Promise.all(promiseArray);
        for (let i = 0; i < docRefArray.length; i++) {
            const prevStats = dataArray[i].data();
            const docRef = docRefArray[i];
            if (prevStats) {
                t.update(docRef, getNewStats(prevStats, incomingStats));
            }
            else {
                t.set(docRef, incomingStats);
            }
        }
    }));
});
const NftStatsModel = { handleOrders };
exports.default = NftStatsModel;
//# sourceMappingURL=nft-stats.model.js.map