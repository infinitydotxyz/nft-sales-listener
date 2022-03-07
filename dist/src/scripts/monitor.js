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
const { ethers } = require('ethers');
const OpenSeaABI = require('../OpenSeaABI.json');
const ERC721ABI = require('../erc721Abi.json');
const ERC1155ABI = require('../erc1155Abi.json');
const OPENSEA_ADDRESS = '0x7be8076f4ea4a4ad08075c2508e481d6c946d12b';
const iface = new ethers.utils.Interface(OpenSeaABI);
const provider = new ethers.providers.JsonRpcProvider(process.env.MAINNET_URL);
const nullAddress = '0x0000000000000000000000000000000000000000';
const firebaseAdmin = require('firebase-admin');
const serviceAccount = require('../../creds/nftc-infinity-firebase-creds.json');
firebaseAdmin.initializeApp({
    // @ts-ignore
    credential: firebaseAdmin.credential.cert(serviceAccount)
});
const db = firebaseAdmin.firestore();
main();
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('==== OpenSea Sale Monitor ====');
        const contract = new ethers.Contract(OPENSEA_ADDRESS, OpenSeaABI, provider);
        contract.on('OrdersMatched', (...args) => __awaiter(this, void 0, void 0, function* () {
            try {
                const event = args[args.length - 1];
                const response = (yield provider.getTransaction(event.transactionHash)).data;
                const decodedResponse = iface.decodeFunctionData('atomicMatch_', response);
                const collectionAddress = decodedResponse.addrs[4];
                const seller = decodedResponse.addrs[8];
                const buyer = decodedResponse.addrs[1];
                const buyData = decodedResponse.calldataBuy;
                let tokenId, quantity;
                if (response.length > 4810) {
                    // ERC-1155
                    tokenId = ethers.BigNumber.from('0x' + decodedResponse.calldataBuy.slice(138, 202)).toString();
                    quantity = ethers.BigNumber.from('0x' + decodedResponse.calldataBuy.slice(202, 266)).toString();
                }
                else {
                    // ERC-721
                    tokenId = ethers.BigNumber.from('0x' + buyData.slice(buyData.length - 32)).toString();
                }
                if (response.length > 4810) {
                    pruneERC1155(tokenId, collectionAddress, seller.trim().toLowerCase());
                }
                else {
                    pruneERC721(tokenId, collectionAddress);
                }
            }
            catch (err) {
                console.error(err.message);
            }
        }));
    });
}
function pruneERC721(id, address) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('Pruning ERC721', id, address);
        const query = yield db
            .collectionGroup('listings')
            .where('metadata.asset.id', '==', id)
            .where('metadata.asset.address', '==', address)
            .limit(100)
            .get();
        const contract = new ethers.Contract(address, ERC721ABI, provider);
        try {
            for (let i = 0; i < query.docs.length; i++) {
                const doc = query.docs[i];
                const ref = doc.ref;
                const data = doc.data();
                const maker = data.maker;
                let owner = yield contract.ownerOf(id);
                owner = owner.trim().toLowerCase();
                if (owner !== nullAddress && owner !== maker) {
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
}
function pruneERC1155(id, address, seller) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('Pruning ERC1155', id, address);
        const query = yield db
            .collectionGroup('listings')
            .where('metadata.asset.id', '==', id)
            .where('metadata.asset.address', '==', address)
            .limit(100)
            .get();
        const contract = new ethers.Contract(address, ERC1155ABI, provider);
        try {
            for (let i = 0; i < query.docs.length; i++) {
                const doc = query.docs[i];
                const ref = doc.ref;
                const data = doc.data();
                const maker = data.maker;
                const balance = yield contract.balanceOf(seller, id);
                if (seller !== nullAddress && seller === maker && balance === 0) {
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
}
//# sourceMappingURL=monitor.js.map