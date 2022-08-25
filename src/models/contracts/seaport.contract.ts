import { ethers } from 'ethers';
import { BlockProvider } from '../block-provider';
import SeaportABI from '../../abi/seaport.json';
import { ContractListenerEvent } from '../contract-listeners/contract-listener.abstract';
import { SeaportOrderFulfilledListener } from '../contract-listeners/seaport-order-fulfilled.listener';
import { EventHandler } from '../event-handlers/types';
import { ChainId } from '@infinityxyz/lib/types/core';
import { Firebase } from '../../database/Firebase';
import { DbSyncedContract } from './db-synced-contract.abstract';
import { TransactionReceiptProvider } from '../transaction-receipt-provider';
import { Contracts } from './types';

export type SeaportListener = SeaportOrderFulfilledListener;
export type SeaportListenerConstructor = typeof SeaportOrderFulfilledListener;

export class SeaportContract extends DbSyncedContract {
  static readonly listenerConstructors = [SeaportOrderFulfilledListener];

  protected _listeners: SeaportListener[] = [];

  static discriminator: Contracts = Contracts.Seaport;
  discriminator: Contracts = Contracts.Seaport;

  constructor(
    provider: ethers.providers.StaticJsonRpcProvider,
    address: string,
    blockProvider: BlockProvider,
    listeners: SeaportListenerConstructor[],
    chainId: ChainId,
    firebase: Firebase,
    txReceiptProvider: TransactionReceiptProvider,
    private _handler: EventHandler,
    numBlocksToBackfill?: number
  ) {
    super(address, provider, SeaportABI, blockProvider, chainId, firebase, numBlocksToBackfill);

    for (const listener of listeners) {
      this._listeners.push(new listener(this.contract, this.blockProvider, chainId, txReceiptProvider));
    }
  }

  protected registerListeners(event: ContractListenerEvent) {
    const cancelers = this._listeners.map((contractListener) => {
      if (contractListener instanceof SeaportOrderFulfilledListener) {
        return contractListener.on(event, (orderFulfilled) => {
          this._handler.nftSalesEvent(orderFulfilled.events).catch((err) => {
            console.error(err);
          });
        });
      } else {
        throw new Error('Unknown contract listener');
      }
    });

    return () => {
      cancelers.map((cancel) => cancel());
    };
  }
}
