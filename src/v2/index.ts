

import { providers } from "container";
import { infinityExchangeMainnetDesc, wyvernExchangeMainnetDesc, seaportExchangeMainnetDesc } from "./config";
import { ContractFactory } from "./contracts/contract.factory";

function main() {
    const contractFactory = new ContractFactory(providers);

    const infinityExchangeMainnet = contractFactory.create(infinityExchangeMainnetDesc);
    const wyvernExchangeMainnet = contractFactory.create(wyvernExchangeMainnetDesc);
    const seaportExchangeMainnet = contractFactory.create(seaportExchangeMainnetDesc);

    infinityExchangeMainnet.start();
    wyvernExchangeMainnet.start();
    seaportExchangeMainnet.start();
}

main();