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
exports.handleNftTransactions = void 0;
const container_1 = require("../container");
const utils_1 = require("../utils");
const constants_1 = require("../constants");
const sales_model_1 = __importDefault(require("../models/sales.model"));
const nft_stats_model_1 = __importDefault(require("../models/nft-stats.model"));
const collection_stats_model_1 = __importDefault(require("../models/collection-stats.model"));
const handleNftTransactions = (transactions, chainId = '1') => __awaiter(void 0, void 0, void 0, function* () {
    /**
     * Skip the transactions without ether as the payment. ex: usd, matic ...
     * */
    if (transactions[0].paymentToken !== constants_1.NULL_ADDR) {
        return;
    }
    try {
        const totalPrice = (0, utils_1.convertWeiToEther)(transactions[0].price);
        const orders = transactions.map((tx) => {
            const order = {
                txHash: tx.txHash.trim().toLowerCase(),
                tokenId: tx.tokenIdStr,
                collectionAddress: tx.collectionAddr.trim().toLowerCase(),
                price: totalPrice / transactions.length,
                paymentTokenType: tx.paymentToken,
                quantity: tx.quantity,
                buyer: tx.buyerAddress.trim().toLowerCase(),
                seller: tx.sellerAddress.trim().toLowerCase(),
                source: tx.source,
                blockNumber: tx.blockNumber,
                blockTimestamp: tx.blockTimestamp
            };
            return order;
        });
        yield sales_model_1.default.handleOrders(orders);
        yield nft_stats_model_1.default.handleOrders(orders, totalPrice);
        yield collection_stats_model_1.default.handleOrders(orders, totalPrice);
    }
    catch (err) {
        container_1.logger.error('Sales-scraper:updateCollectionSalesInfo', err);
    }
});
exports.handleNftTransactions = handleNftTransactions;
//# sourceMappingURL=sales-parser.controller.js.map