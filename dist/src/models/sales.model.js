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
const constants_1 = require("../constants");
/**
 * @description save the orders into <sales> collection
 */
const handleOrders = (orders, chainId = '1') => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const firestore = container_1.firebase.db;
        const batch = firestore.batch();
        const SalesCollectionRef = firestore.collection(constants_1.DBN_SALES);
        orders.forEach((order) => {
            const docRef = SalesCollectionRef.doc();
            batch.create(docRef, order);
        });
        const res = yield batch.commit();
        return res;
    }
    catch (err) {
        container_1.logger.error('SalesModel:[handleOrders]', err);
        throw err;
    }
});
const SalesModel = { handleOrders };
exports.default = SalesModel;
//# sourceMappingURL=sales.model.js.map