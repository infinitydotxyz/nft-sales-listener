/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable no-console */
import { ethers } from 'ethers';
import { InfinityExchangeABI } from '@infinityxyz/lib/abi/infinityExchange';
import { CancelAllOrdersListener } from '../contract-listeners/cancel-all-orders.listener';
import { CancelMultipleOrdersListener } from '../contract-listeners/cancel-multiple-orders.listener';
import { BlockProvider } from '../models/block-provider';
import { MatchListener } from '../contract-listeners/match.listener';
import { TakeListener } from '../contract-listeners/take.listener';
import { ContractListenerEvent } from '../contract-listeners/contract-listener.abstract';
import { Contract } from './contract.abstract';

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

export class InfinityExchange extends Contract {
  protected _listeners: InfinityExchangeEventListener[] = [];

  constructor(
    provider: ethers.providers.StaticJsonRpcProvider,
    address: string,
    blockProvider: BlockProvider,
    listeners: InfinityExchangeEventListenerConstructor[]
  ) {
    super(address, provider, InfinityExchangeABI, blockProvider);

    for (const listener of listeners) {
      this._listeners.push(new listener(this.contract, this.blockProvider));
    }
  }

  protected registerListeners(event: ContractListenerEvent) {
    const cancelers = this._listeners.map((contractListener) => {
      if (contractListener instanceof CancelAllOrdersListener) {
        return contractListener.on(event, (cancelAll) => {
          console.log(cancelAll);
        });
      } else if (contractListener instanceof CancelMultipleOrdersListener) {
        return contractListener.on(event, (cancelMultiple) => {
          console.log(cancelMultiple);
        });
      } else if (contractListener instanceof MatchListener) {
        return contractListener.on(event, (match) => {
          console.log(match);
        });
      } else if (contractListener instanceof TakeListener) {
        return contractListener.on(event, (taker) => {
          console.log(taker);
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
