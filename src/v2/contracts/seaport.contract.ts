import { ethers } from 'ethers';
import { BlockProvider } from 'v2/models/block-provider';
import { Contract } from './contract.abstract';
import SeaportABI from '../../abi/seaport.json';
import { ContractListenerEvent } from 'v2/contract-listeners/contract-listener.abstract';
import { SeaportOrderFulfilledListener } from 'v2/contract-listeners/seaport-order-fulfilled.listener';
import { EventHandler } from 'v2/event-handlers/types';

export type SeaportListener = SeaportOrderFulfilledListener;
export type SeaportListenerConstructor = typeof SeaportOrderFulfilledListener;

export class SeaportContract extends Contract {
  static readonly listenerConstructors = [SeaportOrderFulfilledListener];

  protected _listeners: SeaportListener[] = [];

  constructor(
    provider: ethers.providers.StaticJsonRpcProvider,
    address: string,
    blockProvider: BlockProvider,
    listeners: SeaportListenerConstructor[],
    protected _handler: EventHandler
  ) {
    super(address, provider, SeaportABI, blockProvider);

    for (const listener of listeners) {
      this._listeners.push(new listener(this.contract, this.blockProvider));
    }
  }

  protected registerListeners(event: ContractListenerEvent) {
    const cancelers = this._listeners.map((contractListener) => {
      if (contractListener instanceof SeaportOrderFulfilledListener) {
        return contractListener.on(event, (orderFulfilled) => {
          this._handler.nftSalesEvent(orderFulfilled).catch((err) => {
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
