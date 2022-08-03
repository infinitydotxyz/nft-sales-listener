import { ethers } from 'ethers';
import { OpenSeaOrdersMatchedListener } from '../contract-listeners/opensea-orders-matched.listener';
import { BlockProvider } from 'models/block-provider';
import WyvernExchangeABI from '../../abi/wyvernExchange.json';
import { ContractListenerEvent } from '../contract-listeners/contract-listener.abstract';
import { EventHandler } from 'models/event-handlers/types';
import { DbSyncedContract } from './db-synced-contract.abstract';
import { ChainId } from '@infinityxyz/lib/types/core';
import Firebase from 'database/Firebase';
import { TransactionReceiptProvider } from 'models/transaction-receipt-provider';
import { Contracts } from './types';

export type OpenSeaListener = OpenSeaOrdersMatchedListener;
export type OpenSeaListenerConstructor = typeof OpenSeaOrdersMatchedListener;

export class OpenSeaContract extends DbSyncedContract {
  static readonly listenerConstructors = [OpenSeaOrdersMatchedListener];

  protected _listeners: OpenSeaListener[] = [];

  static discriminator: Contracts = Contracts.OpenSea;

  constructor(
    provider: ethers.providers.StaticJsonRpcProvider,
    address: string,
    blockProvider: BlockProvider,
    listeners: OpenSeaListenerConstructor[],
    chainId: ChainId,
    firebase: Firebase,
    txReceiptProvider: TransactionReceiptProvider,
    private _handler: EventHandler
  ) {
    super(address, provider, WyvernExchangeABI, blockProvider, chainId, firebase);

    for (const listener of listeners) {
      this._listeners.push(new listener(this.contract, this.blockProvider, chainId, txReceiptProvider));
    }
  }

  protected registerListeners(event: ContractListenerEvent) {
    const cancelers = this._listeners.map((contractListener) => {
      if (contractListener instanceof OpenSeaOrdersMatchedListener) {
        return contractListener.on(event, (ordersMatched) => {
          this._handler.nftSalesEvent(ordersMatched.events).catch((err) => {
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
