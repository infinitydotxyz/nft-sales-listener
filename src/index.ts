import {
  infinityExchangeMainnetDesc,
  wyvernExchangeMainnetDesc,
  seaportExchangeMainnetDesc,
  infinityStakerMainnetDesc
} from './config';
import { ContractFactory } from './models/contracts/contract.factory';
import { EventHandler } from './models/event-handlers/handler';
import { CollectionProvider } from './models/collection-provider';
import { TransactionReceiptProvider } from './models/transaction-receipt-provider';
import { ChainId } from '@infinityxyz/lib/types/core';
import { ProtocolFeeProvider } from './models/protocol-fee-provider';
import { Providers } from './models/Providers';
import { Firebase } from './database/Firebase';
import { ContractType } from './models/contracts/types';

async function main() {
  const providers = new Providers();
  const firebase = new Firebase();
  const contractFactory = new ContractFactory(providers, firebase);
  const attemptToIndexMissingCollections = false; // set based on env
  const collectionProvider = new CollectionProvider(50, firebase, attemptToIndexMissingCollections);
  const handler = new EventHandler(firebase, providers, collectionProvider);
  const protocolFeeProvider = new ProtocolFeeProvider(firebase, providers);
  const mainnetTxReceiptProvider = new TransactionReceiptProvider(500, providers.getProviderByChainId(ChainId.Mainnet));
  const infinityExchangeMainnet = contractFactory.create(
    infinityExchangeMainnetDesc,
    handler,
    mainnetTxReceiptProvider,
    protocolFeeProvider
  );
  const wyvernExchangeMainnet = contractFactory.create(
    wyvernExchangeMainnetDesc,
    handler,
    mainnetTxReceiptProvider,
    protocolFeeProvider
  );
  const seaportExchangeMainnet = contractFactory.create(
    seaportExchangeMainnetDesc,
    handler,
    mainnetTxReceiptProvider,
    protocolFeeProvider
  );
  // const infinityStakerMainnet = contractFactory.create(
  //   infinityStakerMainnetDesc,
  //   handler,
  //   mainnetTxReceiptProvider,
  //   protocolFeeProvider
  // );

  const contracts = [
    infinityExchangeMainnet,
    wyvernExchangeMainnet,
    seaportExchangeMainnet
    // infinityStakerMainnet // TODO uncomment this when staker is deployed to mainnet
  ];
  await syncContracts(contracts);
  console.log(`All contracts synced`);
}

function syncContracts(contracts: ContractType[]) {
  return Promise.all(
    contracts.map((contract) => {
      return new Promise<void>((resolve) => {
        const contractName = `${contract.discriminator} ChainId: ${contract.chainId}`;
        contract
          .sync()
          .then(() => {
            console.log(`${contractName} backfilled`);
          })
          .catch((err) => {
            console.error(contractName, err);
          })
          .finally(() => {
            resolve();
          });
      });
    })
  );
}

void main();
