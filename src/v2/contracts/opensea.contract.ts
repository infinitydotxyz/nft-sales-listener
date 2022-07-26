import { ethers } from 'ethers';
import { OpenSeaOrdersMatchedListener } from 'v2/contract-listeners/opensea-orders-matched.listener';
import { BlockProvider } from 'v2/models/block-provider';
import { Contract } from './contract.abstract';
import * as WyvernExchangeABI from '../../abi/wyvernExchange.json';
import { ContractListenerEvent } from 'v2/contract-listeners/contract-listener.abstract';
import { EventHandler } from 'v2/event-handlers/types';

export type OpenSeaListener = OpenSeaOrdersMatchedListener;
export type OpenSeaListenerConstructor = typeof OpenSeaOrdersMatchedListener;

export class OpenSeaContract extends Contract {
  static readonly listenerConstructors = [OpenSeaOrdersMatchedListener];

  protected _listeners: OpenSeaListener[] = [];

  constructor(
    provider: ethers.providers.StaticJsonRpcProvider,
    address: string,
    blockProvider: BlockProvider,
    listeners: OpenSeaListenerConstructor[],
    protected _handler: EventHandler
  ) {
    super(address, provider, WyvernExchangeABI, blockProvider);

    for (const listener of listeners) {
      this._listeners.push(new listener(this.contract, this.blockProvider));
    }
  }

  protected registerListeners(event: ContractListenerEvent) {
    const cancelers = this._listeners.map((contractListener) => {
      if (contractListener instanceof OpenSeaOrdersMatchedListener) {
        return contractListener.on(event, (ordersMatched) => {
            this._handler.nftSalesEvent(ordersMatched).catch((err) => {
                console.error(err);
            })
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
