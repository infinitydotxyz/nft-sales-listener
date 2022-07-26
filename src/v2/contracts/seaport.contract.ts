/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable no-console */
import { ethers } from 'ethers';
import { BlockProvider } from 'v2/models/block-provider';
import { Contract } from './contract.abstract';
import * as WyvernExchangeABI from '../../abi/wyvernExchange.json';
import { ContractListenerEvent } from 'v2/contract-listeners/contract-listener.abstract';
import { SeaportOrderFulfilledListener } from 'v2/contract-listeners/seaport-order-fulfilled.listener';

export type SeaportListener = SeaportOrderFulfilledListener;
export type SeaportListenerConstructor = typeof SeaportOrderFulfilledListener;

export class OpenSeaContract extends Contract {
  protected _listeners: SeaportListener[] = [];

  constructor(
    provider: ethers.providers.StaticJsonRpcProvider,
    address: string,
    blockProvider: BlockProvider,
    listeners: SeaportListenerConstructor[]
  ) {
    super(address, provider, WyvernExchangeABI, blockProvider);

    for (const listener of listeners) {
      this._listeners.push(new listener(this.contract, this.blockProvider));
    }
  }

  protected registerListeners(event: ContractListenerEvent) {
    const cancelers = this._listeners.map((contractListener) => {
      if (contractListener instanceof SeaportOrderFulfilledListener) {
        return contractListener.on(event, (cancelAll) => {
          console.log(cancelAll);
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
