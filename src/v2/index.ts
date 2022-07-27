import 'reflect-metadata'

import { firebase, providers } from "container";
import { infinityExchangeMainnetDesc, wyvernExchangeMainnetDesc, seaportExchangeMainnetDesc } from "./config";
import { ContractFactory } from "./contracts/contract.factory";
import { EventHandler } from "./event-handlers/handler";
import { CollectionProvider } from "./models/collection-provider";

function main() {
    const contractFactory = new ContractFactory(providers, firebase);
    const collectionProvider = new CollectionProvider(50, firebase);
    const handler = new EventHandler(firebase, providers, collectionProvider);
    const infinityExchangeMainnet = contractFactory.create(infinityExchangeMainnetDesc, handler);
    const wyvernExchangeMainnet = contractFactory.create(wyvernExchangeMainnetDesc, handler);
    const seaportExchangeMainnet = contractFactory.create(seaportExchangeMainnetDesc, handler);


    infinityExchangeMainnet.start().then(() => {
        console.log("Infinity Exchange Mainnet backfilled");
    }).catch((err) => {
        console.error(err);
    })
    wyvernExchangeMainnet.start().then(() => {
        console.log("Wyvern Exchange Mainnet backfilled");
    }).catch((err) => {
        console.error(err);
    });
    seaportExchangeMainnet.start().then(() => {
        console.log("Seaport Exchange Mainnet backfilled");
    }).catch((err) => {
        console.error(err);
    });
}

void main();