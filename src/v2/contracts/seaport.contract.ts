import { ethers } from 'ethers';
import { BlockProvider } from 'v2/models/block-provider';
import SeaportABI from '../../abi/seaport.json';
import { ContractListenerEvent } from 'v2/contract-listeners/contract-listener.abstract';
import { SeaportOrderFulfilledListener } from 'v2/contract-listeners/seaport-order-fulfilled.listener';
import { EventHandler } from 'v2/event-handlers/types';
import { ChainId } from '@infinityxyz/lib/types/core';
import Firebase from 'database/Firebase';
import { DbSyncedContract } from './db-synced-contract.abstract';
import { TransactionReceiptProvider } from 'v2/models/transaction-receipt-provider';
import { Contracts } from './types';

export type SeaportListener = SeaportOrderFulfilledListener;
export type SeaportListenerConstructor = typeof SeaportOrderFulfilledListener;

export class SeaportContract extends DbSyncedContract {
  static readonly listenerConstructors = [SeaportOrderFulfilledListener];

  protected _listeners: SeaportListener[] = [];

  static discriminator: Contracts = Contracts.Seaport;

  constructor(
    provider: ethers.providers.StaticJsonRpcProvider,
    address: string,
    blockProvider: BlockProvider,
    listeners: SeaportListenerConstructor[],
    chainId: ChainId,
    firebase: Firebase,
    txReceiptProvider: TransactionReceiptProvider,
    private _handler: EventHandler,
  ) {
    super(address, provider, SeaportABI, blockProvider, chainId, firebase);

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
