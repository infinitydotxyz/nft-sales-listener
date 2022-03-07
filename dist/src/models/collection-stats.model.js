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
const sales_collection_initializer_controller_1 = require("../controllers/sales-collection-initializer.controller");
const utils_1 = require("../utils");
const types_1 = require("../types");
const constants_1 = require("../constants");
const getNewStats = (prevStats, incomingStats) => {
    const totalVolume = prevStats.totalVolume + incomingStats.totalVolume;
    const totalNumSales = prevStats.totalNumSales + incomingStats.totalNumSales;
    return {
        floorPrice: prevStats.floorPrice === 0
            ? Math.min(incomingStats.floorPrice, prevStats.avgPrice)
            : Math.min(prevStats.floorPrice, prevStats.avgPrice, incomingStats.floorPrice),
        ceilPrice: prevStats.floorPrice === 0
            ? Math.max(incomingStats.ceilPrice, prevStats.avgPrice)
            : Math.max(prevStats.ceilPrice, prevStats.avgPrice, incomingStats.ceilPrice),
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
    const statsRef = db.collection(constants_1.DBN_COLLECTION_STATS).doc(`${chainId}:${orders[0].collectionAddress}`);
    let isEmpty = false;
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
                isEmpty = true;
                t.set(docRef, incomingStats);
            }
        }
    }));
    if (isEmpty) {
        yield (0, sales_collection_initializer_controller_1.addCollectionToQueue)(orders[0].collectionAddress, orders[0].tokenId);
    }
});
const initStatsFromOS = (cs, collectionAddress, chainId = '1') => __awaiter(void 0, void 0, void 0, function* () {
    const firestore = container_1.firebase.db;
    const batch = firestore.batch();
    const timestamp = Date.now();
    const statsRef = firestore.collection(constants_1.DBN_COLLECTION_STATS).doc(`${chainId}:${collectionAddress}`);
    const totalInfo = {
        floorPrice: cs.floor_price,
        ceilPrice: 0,
        totalVolume: cs.total_volume,
        totalNumSales: cs.total_sales,
        avgPrice: cs.average_price,
        updateAt: timestamp
    };
    batch.set(statsRef, totalInfo, { merge: true });
    // --- Daily ---
    const DailyRef = statsRef.collection(types_1.BASE_TIME.DAILY).doc((0, utils_1.getDocumentIdByTime)(timestamp, types_1.BASE_TIME.DAILY));
    batch.set(DailyRef, {
        floorPrice: 0,
        ceilPrice: 0,
        totalVolume: cs.one_day_volume,
        totalNumSales: cs.one_day_sales,
        avgPrice: cs.one_day_average_price,
        updateAt: timestamp
    }, { merge: true });
    // --- Weekly ---
    const weekRef = statsRef.collection(types_1.BASE_TIME.WEEKLY).doc((0, utils_1.getDocumentIdByTime)(timestamp, types_1.BASE_TIME.WEEKLY));
    batch.set(weekRef, {
        floorPrice: 0,
        ceilPrice: 0,
        totalVolume: cs.seven_day_volume,
        totalNumSales: cs.seven_day_sales,
        avgPrice: cs.seven_day_average_price,
        updateAt: timestamp
    }, { merge: true });
    // --- Monthly ---
    const monthlyRef = statsRef.collection(types_1.BASE_TIME.MONTHLY).doc((0, utils_1.getDocumentIdByTime)(timestamp, types_1.BASE_TIME.MONTHLY));
    batch.set(monthlyRef, {
        floorPrice: 0,
        ceilPrice: 0,
        totalVolume: cs.thirty_day_volume,
        totalNumSales: cs.thirty_day_sales,
        avgPrice: cs.thirty_day_average_price,
        updateAt: timestamp
    }, { merge: true });
    const res = yield batch.commit();
    return res;
});
const CollectionStatsModel = { handleOrders, initStatsFromOS };
exports.default = CollectionStatsModel;
//# sourceMappingURL=collection-stats.model.js.map