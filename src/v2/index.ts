

import { firebase, providers } from "container";
import { infinityExchangeMainnetDesc, wyvernExchangeMainnetDesc, seaportExchangeMainnetDesc } from "./config";
import { ContractFactory } from "./contracts/contract.factory";
import { EventHandler } from "./event-handlers/handler";

function main() {
    const contractFactory = new ContractFactory(providers);
    const handler = new EventHandler(firebase);
    const infinityExchangeMainnet = contractFactory.create(infinityExchangeMainnetDesc, handler);
    const wyvernExchangeMainnet = contractFactory.create(wyvernExchangeMainnetDesc, handler);
    const seaportExchangeMainnet = contractFactory.create(seaportExchangeMainnetDesc, handler);

    infinityExchangeMainnet.start();
    wyvernExchangeMainnet.start();
    seaportExchangeMainnet.start();
}

main();