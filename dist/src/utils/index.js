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
exports.getHashByNftAddress = exports.randomItem = exports.randomInt = exports.isDev = exports.sleep = exports.filterDuplicates = exports.getProviderByChainId = exports.convertWeiToEther = exports.getDocumentIdByTime = void 0;
const crypto_1 = __importDefault(require("crypto"));
const container_1 = require("../container");
const types_1 = require("../types");
const ethers_1 = require("ethers");
const moment_1 = __importDefault(require("moment"));
/**
 *
 * @param date
 * @param baseTime
 * @returns Firestore historical document id ( sales info ) based on date and basetime
 *
 */
const getDocumentIdByTime = (timestamp, baseTime) => {
    const date = new Date(timestamp);
    const firstDayOfWeek = date.getDate() - date.getDay();
    switch (baseTime) {
        case types_1.BASE_TIME.HOURLY:
            return (0, moment_1.default)(date).format('YYYY-MM-DD-HH');
        case types_1.BASE_TIME.DAILY:
            return (0, moment_1.default)(date).format('YYYY-MM-DD');
        case types_1.BASE_TIME.WEEKLY:
            return (0, moment_1.default)(date.setDate(firstDayOfWeek)).format('YYYY-MM-DD');
        case types_1.BASE_TIME.MONTHLY:
            return (0, moment_1.default)(date).format('YYYY-MM');
        case types_1.BASE_TIME.YEARLY:
            return (0, moment_1.default)(date).format('YYYY');
    }
};
exports.getDocumentIdByTime = getDocumentIdByTime;
const convertWeiToEther = (price) => {
    return parseFloat(ethers_1.ethers.utils.formatEther(price.toString()));
};
exports.convertWeiToEther = convertWeiToEther;
function getProviderByChainId(chainId) {
    return container_1.providers.getProviderByChainId(chainId);
}
exports.getProviderByChainId = getProviderByChainId;
function filterDuplicates(items, propertySelector) {
    const hashes = new Set();
    return items.filter((item) => {
        const property = propertySelector(item);
        if (!hashes.has(property)) {
            hashes.add(property);
            return true;
        }
        return false;
    });
}
exports.filterDuplicates = filterDuplicates;
function sleep(duration) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield new Promise((resolve) => {
            setTimeout(() => {
                resolve();
            }, duration);
        });
    });
}
exports.sleep = sleep;
function isDev() {
    return !!process.env.NODE_ENV;
}
exports.isDev = isDev;
/**
 * returns a random int between min (inclusive) and max (inclusive)
 */
function randomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
exports.randomInt = randomInt;
function randomItem(array) {
    const index = randomInt(0, array.length - 1);
    return array[index];
}
exports.randomItem = randomItem;
/**
 *
 * @description  tokenIds can be big in some cases and we might run into firestore doc name length limit
 *
 */
const getHashByNftAddress = (chainId, collectionAddress, tokenId) => {
    const data = chainId + collectionAddress.trim() + tokenId.trim();
    return crypto_1.default.createHash('sha256').update(data).digest('hex').trim().toLowerCase();
};
exports.getHashByNftAddress = getHashByNftAddress;
//# sourceMappingURL=index.js.map