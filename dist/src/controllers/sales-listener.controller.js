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
exports.execute = void 0;
const ethers_1 = require("ethers");
const constants_1 = require("../constants");
const wyvernExchange_json_1 = __importDefault(require("../../abi/wyvernExchange.json"));
const utils_1 = require("../utils");
const index_1 = require("../types/index");
const sales_parser_controller_1 = require("./sales-parser.controller");
const container_1 = require("../container");
const erc721Abi_json_1 = __importDefault(require("../../abi/erc721Abi.json"));
const erc1155Abi_json_1 = __importDefault(require("../../abi/erc1155Abi.json"));
const constants_2 = require("../constants");
const ETH_CHAIN_ID = '1';
const ethProvider = (0, utils_1.getProviderByChainId)(ETH_CHAIN_ID);
/**
 *
 * @param inputs inputs AtomicMatch call that triggered the handleAtomicMatch_ call handler.
 * @description This function is used to handle the case of a "bundle" sale made from OpenSea.
 *              A "bundle" sale is a sale that contains several assets embeded in the same, atomic, transaction.
 */
function handleBundleSale(inputs) {
    const calldataBuy = inputs.calldataBuy;
    const TRAILING_OX = 2;
    const METHOD_ID_LENGTH = 8;
    const UINT_256_LENGTH = 64;
    const indexStartNbToken = TRAILING_OX + METHOD_ID_LENGTH + UINT_256_LENGTH * 4;
    const indexStopNbToken = indexStartNbToken + UINT_256_LENGTH;
    const nbToken = ethers_1.ethers.BigNumber.from('0x' + calldataBuy.slice(indexStartNbToken, indexStopNbToken)).toNumber();
    const collectionAddrs = [];
    let offset = indexStopNbToken;
    for (let i = 0; i < nbToken; i++) {
        collectionAddrs.push(ethers_1.ethers.BigNumber.from('0x' + calldataBuy.slice(offset, offset + UINT_256_LENGTH)).toHexString());
        // Move forward in the call data
        offset += UINT_256_LENGTH;
    }
    /**
     * After reading the contract addresses involved in the bundle sale
     * there are 2 chunks of params of length nbToken * UINT_256_LENGTH.
     *
     * Those chunks are each preceded by a "chunk metadata" of length UINT_256_LENGTH
     * Finalluy a last "chunk metadata" is set of length UINT_256_LENGTH. (3 META_CHUNKS)
     *
     *
     * After that we are reading the abiencoded data representing the transferFrom calls
     */
    const LEFT_CHUNKS = 2;
    const NB_META_CHUNKS = 3;
    offset += nbToken * UINT_256_LENGTH * LEFT_CHUNKS + NB_META_CHUNKS * UINT_256_LENGTH;
    const TRANSFER_FROM_DATA_LENGTH = METHOD_ID_LENGTH + UINT_256_LENGTH * 3;
    const tokenIdsList = [];
    for (let i = 0; i < nbToken; i++) {
        const transferFromData = calldataBuy.substring(offset, offset + TRANSFER_FROM_DATA_LENGTH);
        const tokenIdstr = ethers_1.ethers.BigNumber.from('0x' + transferFromData.substring(METHOD_ID_LENGTH + UINT_256_LENGTH * 2)).toString();
        tokenIdsList.push(tokenIdstr);
        // Move forward in the call data
        offset += TRANSFER_FROM_DATA_LENGTH;
    }
    return collectionAddrs.map((val, index) => ({
        collectionAddr: collectionAddrs[index],
        tokenIdStr: tokenIdsList[index],
        quantity: 1,
        tokenType: 'ERC721'
    }));
}
/**
 *
 * @param inputs The AtomicMatch call that triggered the handleAtomicMatch_ call handler.
 * @description This function is used to handle the case of a "normal" sale made from OpenSea.
 *              A "normal" sale is a sale that is not a bundle (only contains one asset).
 */
function handleSingleSale(inputs) {
    const TRAILING_OX = 2;
    const METHOD_ID_LENGTH = 8;
    const UINT_256_LENGTH = 64;
    const addrs = inputs.addrs;
    const nftAddrs = addrs[4];
    let collectionAddr;
    let tokenIdStr;
    let quantity = 1;
    let tokenType = 'ERC721';
    const calldataBuy = inputs.calldataBuy;
    let offset = TRAILING_OX + METHOD_ID_LENGTH + UINT_256_LENGTH * 2;
    if (nftAddrs.toLowerCase() === constants_1.MERKLE_VALIDATOR_ADDRESS) {
        collectionAddr = ethers_1.ethers.BigNumber.from('0x' + calldataBuy.slice(offset, offset + UINT_256_LENGTH)).toHexString();
        offset += UINT_256_LENGTH;
        tokenIdStr = ethers_1.ethers.BigNumber.from('0x' + calldataBuy.slice(offset, offset + UINT_256_LENGTH)).toString();
        offset += UINT_256_LENGTH;
        if (calldataBuy.length > 458) {
            quantity = ethers_1.ethers.BigNumber.from('0x' + calldataBuy.slice(offset, offset + UINT_256_LENGTH)).toNumber();
            tokenType = 'ERC1155';
        }
    }
    else {
        // Token minted on Opensea
        collectionAddr = nftAddrs.toLowerCase();
        tokenIdStr = ethers_1.ethers.BigNumber.from('0x' + calldataBuy.slice(offset, offset + UINT_256_LENGTH)).toString();
        offset += UINT_256_LENGTH;
        if (calldataBuy.length > 202) {
            quantity = ethers_1.ethers.BigNumber.from('0x' + calldataBuy.slice(offset, offset + UINT_256_LENGTH)).toNumber();
            tokenType = 'ERC1155';
        }
    }
    return {
        collectionAddr,
        tokenIdStr,
        quantity,
        tokenType
    };
}
/**
 *
 * @param call The AtomicMatch call that triggered this call handler.
 * @description When a sale is made on OpenSea an AtomicMatch_ call is invoked.
 *              This handler will create the associated OpenSeaSale entity
 */
function handleAtomicMatch_(inputs, txHash, block) {
    try {
        const addrs = inputs.addrs;
        const saleAddress = addrs[11];
        const uints = inputs.uints;
        // TODO: The price should be retrieved from the calculateMatchPrice_ method of OpenSea Smart Contract
        const price = uints[4];
        const buyerAddress = addrs[1]; // Buyer.maker
        const sellerAddress = addrs[8]; // Seller.maker
        const paymentTokenErc20Address = addrs[6];
        const res = {
            txHash,
            blockNumber: block.number,
            blockTimestamp: block.timestamp * 1000,
            price,
            paymentToken: paymentTokenErc20Address,
            buyerAddress,
            sellerAddress,
            collectionAddr: '',
            tokenIdStr: '',
            quantity: 0,
            source: index_1.SCRAPER_SOURCE.OPENSEA,
            tokenType: index_1.TOKEN_TYPE.ERC721
        };
        if (saleAddress.toLowerCase() !== constants_1.WYVERN_ATOMICIZER_ADDRESS) {
            const token = handleSingleSale(inputs);
            res.collectionAddr = token.collectionAddr;
            res.tokenIdStr = token.tokenIdStr;
            res.tokenType = token.tokenType === 'ERC721' ? index_1.TOKEN_TYPE.ERC721 : index_1.TOKEN_TYPE.ERC1155;
            res.quantity = token.quantity;
            return [res];
        }
        else {
            const tokens = handleBundleSale(inputs);
            const response = tokens.map((token) => {
                res.collectionAddr = token.collectionAddr;
                res.tokenIdStr = token.tokenIdStr;
                res.tokenType = index_1.TOKEN_TYPE.ERC721;
                res.quantity = token.quantity;
                return res;
            });
            return response;
        }
    }
    catch (err) {
        container_1.logger.error(`Failed to parse open sales transaction: ${txHash}`);
    }
}
const getTransactionByHash = (txHash) => __awaiter(void 0, void 0, void 0, function* () {
    return (yield ethProvider.getTransaction(txHash)).data;
});
const sleep = (ms) => __awaiter(void 0, void 0, void 0, function* () {
    return yield new Promise((resolve) => setTimeout(resolve, ms));
});
// todo: check firestore collections
const pruneERC721 = (id, address) => __awaiter(void 0, void 0, void 0, function* () {
    console.log('Pruning ERC721', id, address);
    const query = yield container_1.firebase.db
        .collectionGroup('listings')
        .where('metadata.asset.id', '==', id)
        .where('metadata.asset.address', '==', address)
        .limit(100)
        .get();
    const contract = new ethers_1.ethers.Contract(address, erc721Abi_json_1.default, ethProvider);
    try {
        for (let i = 0; i < query.docs.length; i++) {
            const doc = query.docs[i];
            const ref = doc.ref;
            const data = doc.data();
            const maker = data.maker;
            let owner = yield contract.ownerOf(id);
            owner = owner.trim().toLowerCase();
            if (owner !== constants_2.NULL_ADDR && owner !== maker) {
                console.log('stale', maker, owner, address, id);
                ref
                    .delete()
                    .then((res) => {
                    console.log('pruned', doc.id, maker, owner, address, id);
                })
                    .catch((err) => {
                    console.error('Error deleting', doc.id, maker, err);
                });
            }
        }
    }
    catch (err) {
        console.error('Error pruning listing', err);
    }
});
// todo: check firestore collections
const pruneERC1155 = (id, address, seller) => __awaiter(void 0, void 0, void 0, function* () {
    console.log('Pruning ERC1155', id, address);
    const query = yield container_1.firebase.db
        .collectionGroup('listings')
        .where('metadata.asset.id', '==', id)
        .where('metadata.asset.address', '==', address)
        .limit(100)
        .get();
    const contract = new ethers_1.ethers.Contract(address, erc1155Abi_json_1.default, ethProvider);
    try {
        for (let i = 0; i < query.docs.length; i++) {
            const doc = query.docs[i];
            const ref = doc.ref;
            const data = doc.data();
            const maker = data.maker;
            const balance = yield contract.balanceOf(seller, id);
            if (seller !== constants_2.NULL_ADDR && seller === maker && balance === 0) {
                console.log('stale', maker, seller, address, id);
                ref
                    .delete()
                    .then((res) => {
                    console.log('pruned', doc.id, maker, seller, address, id);
                })
                    .catch((err) => {
                    console.error('Error deleting', doc.id, maker, err);
                });
            }
        }
    }
    catch (err) {
        console.error('Error pruning listing', err);
    }
});
const execute = () => {
    /*
      --- Listen Opensea Sales event
    */
    const OpenseaContract = new ethers_1.ethers.Contract(constants_1.WYVERN_EXCHANGE_ADDRESS, wyvernExchange_json_1.default, ethProvider);
    const openseaIface = new ethers_1.ethers.utils.Interface(wyvernExchange_json_1.default);
    OpenseaContract.on('OrdersMatched', (...args) => __awaiter(void 0, void 0, void 0, function* () {
        const event = args[args.length - 1];
        const txHash = event.transactionHash;
        let response;
        let maxAttempts = 10;
        while (maxAttempts > 0) {
            try {
                response = yield getTransactionByHash(txHash);
            }
            catch (err) {
                yield sleep(2000);
                maxAttempts--;
                continue;
            }
            break;
        }
        try {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            const block = yield event.getBlock();
            const decodedResponse = openseaIface.decodeFunctionData('atomicMatch_', response);
            const transactions = handleAtomicMatch_(decodedResponse, txHash, block);
            if (transactions) {
                container_1.logger.log(`Scraper:[Opensea] fetched new order successfully: ${txHash}`);
                yield (0, sales_parser_controller_1.handleNftTransactions)(transactions);
            }
        }
        catch (err) {
            container_1.logger.error(`Failed to decode handleAtomicMatch function from tx: ${txHash}`);
        }
    }));
};
exports.execute = execute;
//# sourceMappingURL=sales-listener.controller.js.map