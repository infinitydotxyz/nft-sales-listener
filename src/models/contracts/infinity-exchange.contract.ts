import { ethers } from 'ethers';
import { InfinityExchangeABI } from '@infinityxyz/lib/abi/infinityExchange';
import { CancelAllOrdersListener } from '../contract-listeners/cancel-all-orders.listener';
import { CancelMultipleOrdersListener } from '../contract-listeners/cancel-multiple-orders.listener';
import { BlockProvider } from '../block-provider';
import { MatchOrderListener } from '../contract-listeners/match-order.listener';
import { TakeOrderListener } from '../contract-listeners/take-order.listener';
import { ContractListenerEvent } from '../contract-listeners/contract-listener.abstract';
import { EventHandler } from '../event-handlers/types';
import { DbSyncedContract } from './db-synced-contract.abstract';
import { ChainId } from '@infinityxyz/lib/types/core';
import { Firebase } from '../../database/Firebase';
import { TransactionReceiptProvider } from '../transaction-receipt-provider';
import { ProtocolFeeUpdatedListener } from '../contract-listeners/protocol-fee-updated.listener';
import { ProtocolFeeProvider } from '../protocol-fee-provider';
import { Contracts } from './types';

export type InfinityExchangeEventListener =
  | CancelAllOrdersListener
  | CancelMultipleOrdersListener
  | MatchOrderListener
  | TakeOrderListener
  | ProtocolFeeUpdatedListener;
export type InfinityExchangeEventListenerConstructor =
  | typeof CancelAllOrdersListener
  | typeof CancelMultipleOrdersListener
  | typeof MatchOrderListener
  | typeof TakeOrderListener
  | typeof ProtocolFeeUpdatedListener;

export class InfinityExchangeContract extends DbSyncedContract {
  static readonly listenerConstructors = [
    CancelAllOrdersListener,
    CancelMultipleOrdersListener,
    MatchOrderListener,
    TakeOrderListener,
    ProtocolFeeUpdatedListener
  ];

  static discriminator: Contracts = Contracts.InfinityExchange;
  discriminator: Contracts = Contracts.InfinityExchange;

  protected _listeners: InfinityExchangeEventListener[] = [];

  constructor(
    provider: ethers.providers.StaticJsonRpcProvider,
    address: string,
    blockProvider: BlockProvider,
    listeners: InfinityExchangeEventListenerConstructor[],
    chainId: ChainId,
    firebase: Firebase,
    txReceiptProvider: TransactionReceiptProvider,
    protocolFeeProvider: ProtocolFeeProvider,
    private _handler: EventHandler,
    numBlocksToBackfill?: number
  ) {
    super(address, provider, InfinityExchangeABI, blockProvider, chainId, firebase, numBlocksToBackfill);

    for (const listener of listeners) {
      this._listeners.push(
        new listener(this.contract, this.blockProvider, chainId, txReceiptProvider, protocolFeeProvider)
      );
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
      } else if (contractListener instanceof MatchOrderListener) {
        return contractListener.on(event, (match) => {
          this._handler.matchOrderEvent(match).catch((err) => {
            console.error(err);
          });
        });
      } else if (contractListener instanceof TakeOrderListener) {
        return contractListener.on(event, (taker) => {
          this._handler.takeOrderEvent(taker).catch((err) => {
            console.error(err);
          });
        });
      } else if (contractListener instanceof ProtocolFeeUpdatedListener) {
        return contractListener.on(event, (protocolFeeUpdated) => {
          this._handler.protocolFeeUpdatedEvent(protocolFeeUpdated).catch((err) => {
            console.error(err);
          });
        });
      } else {
        throw new Error('Unknown contract listener');
      }
    });

    return () => {
      cancelers.forEach((cancel) => cancel());
    };
  }
}
