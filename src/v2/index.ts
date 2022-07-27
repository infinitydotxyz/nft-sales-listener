import 'reflect-metadata'

import { firebase, providers } from "container";
import { infinityExchangeMainnetDesc, wyvernExchangeMainnetDesc, seaportExchangeMainnetDesc } from "./config";
import { ContractFactory } from "./contracts/contract.factory";
import { EventHandler } from "./event-handlers/handler";
import { CollectionProvider } from "./models/collection-provider";
import { trimLowerCase } from '@infinityxyz/lib/utils';
import { TransactionReceiptProvider } from './models/transaction-receipt-provider';
import { ChainId } from '@infinityxyz/lib/types/core';

function main() {
    const contractFactory = new ContractFactory(providers, firebase);
    const collectionProvider = new CollectionProvider(50, firebase);
    const handler = new EventHandler(firebase, providers, collectionProvider);
    const mainnetTxReceiptProvider = new TransactionReceiptProvider(500, providers.getProviderByChainId(ChainId.Mainnet))
    const infinityExchangeMainnet = contractFactory.create(infinityExchangeMainnetDesc, handler, mainnetTxReceiptProvider);
    const wyvernExchangeMainnet = contractFactory.create(wyvernExchangeMainnetDesc, handler, mainnetTxReceiptProvider);
    const seaportExchangeMainnet = contractFactory.create(seaportExchangeMainnetDesc, handler, mainnetTxReceiptProvider);


    infinityExchangeMainnet.sync().then(() => {
        console.log("Infinity Exchange Mainnet backfilled");
    }).catch((err) => {
        console.error(err);
    })
    wyvernExchangeMainnet.sync().then(() => {
        console.log("Wyvern Exchange Mainnet backfilled");
    }).catch((err) => {
        console.error(err);
    });
    seaportExchangeMainnet.sync().then(() => {
        console.log("Seaport Exchange Mainnet backfilled");
    }).catch((err) => {
        console.error(err);
    });
}

async function getSaleByTx() {
    const hash = trimLowerCase('0xf5e6acc34f6f3dafbc938a847fba613f832c40dab35810218c475624a6f45018');

    const snaps = await firebase.db.collection('sales').where('txHash', '==', hash).get();
    snaps.docs.forEach((doc) => {
        const id = doc.id;
        const sale = doc.data();

        console.log(`Found sale with hash: ${hash} Id: ${id}`);
        console.log(JSON.stringify(sale, null, 2));
    });
}

void main();