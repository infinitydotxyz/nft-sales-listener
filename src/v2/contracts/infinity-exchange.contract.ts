import { ethers } from 'ethers';
import { InfinityExchangeABI } from '@infinityxyz/lib/abi/infinityExchange';
import { CancelAllOrdersListener } from '../contract-listeners/cancel-all-orders.listener';
import { CancelMultipleOrdersListener } from '../contract-listeners/cancel-multiple-orders.listener';
import { BlockProvider } from '../models/block-provider';
import { MatchListener } from '../contract-listeners/match.listener';
import { TakeListener } from '../contract-listeners/take.listener';
import { ContractListenerEvent } from '../contract-listeners/contract-listener.abstract';
import { EventHandler } from 'v2/event-handlers/types';
import { DbSyncedContract } from './db-synced-contract.abstract';
import { ChainId } from '@infinityxyz/lib/types/core';
import Firebase from 'database/Firebase';

export type InfinityExchangeEventListener =
  | CancelAllOrdersListener
  | CancelMultipleOrdersListener
  | MatchListener
  | TakeListener;
export type InfinityExchangeEventListenerConstructor =
  | typeof CancelAllOrdersListener
  | typeof CancelMultipleOrdersListener
  | typeof MatchListener
  | typeof TakeListener;

export class InfinityExchangeContract extends DbSyncedContract {
  static readonly listenerConstructors = [
    CancelAllOrdersListener,
    CancelMultipleOrdersListener,
    MatchListener,
    TakeListener
  ];

  protected _listeners: InfinityExchangeEventListener[] = [];

  constructor(
    provider: ethers.providers.StaticJsonRpcProvider,
    address: string,
    blockProvider: BlockProvider,
    listeners: InfinityExchangeEventListenerConstructor[],
    chainId: ChainId,
    firebase: Firebase,
    private _handler: EventHandler,
  ) {
    super(address, provider, InfinityExchangeABI, blockProvider, chainId, firebase);

    for (const listener of listeners) {
      this._listeners.push(new listener(this.contract, this.blockProvider));
    }
  }

  protected registerListeners(event: ContractListenerEvent) {
    const cancelers = this._listeners.map((contractListener) => {
      if (contractListener instanceof CancelAllOrdersListener) {
        return contractListener.on(event, (cancelAll) => {
          this._handler.cancelAllOrders(cancelAll).catch((err) => {
            console.error(err);
          });
        });
      } else if (contractListener instanceof CancelMultipleOrdersListener) {
        return contractListener.on(event, (cancelMultiple) => {
          this._handler.cancelMultipleOrders(cancelMultiple).catch((err) => {
            console.error(err);
          });
        });
      } else if (contractListener instanceof MatchListener) {
        return contractListener.on(event, (match) => {
          this._handler.matchEvent(match).catch((err) => {
            console.error(err);
          });
        });
      } else if (contractListener instanceof TakeListener) {
        return contractListener.on(event, (taker) => {
          this._handler.takeEvent(taker).catch((err) => {
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
