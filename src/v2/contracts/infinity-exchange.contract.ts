/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable no-console */
import { ethers } from 'ethers';
import { InfinityExchangeABI } from '@infinityxyz/lib/abi/infinityExchange';
import { CancelAllOrdersEvent, CancelAllOrdersListener } from '../contract-listeners/cancel-all-orders.listener';
import {
  CancelMultipleOrdersEvent,
  CancelMultipleOrdersListener
} from '../contract-listeners/cancel-multiple-orders.listener';
import { BlockProvider } from '../models/block-provider';
import { MatchEvent, MatchListener } from '../contract-listeners/match.listener';
import { TakeEvent, TakeListener } from '../contract-listeners/take.listener';
import { ContractListenerEvent } from '../contract-listeners/contract-listener.abstract';
import { Contract } from './contract.abstract';
import { updateInfinityOrderStatus } from '../../controllers/sales-listener.controller';
import { PreParsedInfinityNftSale } from 'types';
import { NftSale } from '@infinityxyz/lib/types/core/NftSale';
import { trimLowerCase } from '@infinityxyz/lib/utils/formatters';
import { ETHEREUM_WETH_ADDRESS, firestoreConstants, NULL_ADDRESS } from '@infinityxyz/lib/utils';
import { convertWeiToEther } from 'utils';
import { firebase } from 'container';
import {
  updateInfinityOrderStatusesForCancelAll,
  updateInfinityOrderStatusesForMultipleCancel
} from '../../controllers/sales-listener.controller';

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

export class InfinityExchangeContract extends Contract {
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
          this.handleCancelAllOrdersEvent(cancelAll).catch((err) => {
            console.error(err);
          });
        });
      } else if (contractListener instanceof CancelMultipleOrdersListener) {
        return contractListener.on(event, (cancelMultiple) => {
          this.handleCancelMultipleOrdersEvent(cancelMultiple).catch((err) => {
            console.error(err);
          });
        });
      } else if (contractListener instanceof MatchListener) {
        return contractListener.on(event, (match) => {
          this.handleMatchEvent(match).catch((err) => {
            console.error(err);
          });
        });
      } else if (contractListener instanceof TakeListener) {
        return contractListener.on(event, (taker) => {
          this.handleTakeEvent(taker).catch((err) => {
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

  protected async handleMatchEvent(event: MatchEvent) {
    await updateInfinityOrderStatus(event, event.sellOrderHash);
    await updateInfinityOrderStatus(event, event.buyOrderHash);
    const { sales, totalPrice } = this.parseInfinitySaleOrder(event);
    // TODO save sales
  }

  protected async handleTakeEvent(event: TakeEvent) {
    await updateInfinityOrderStatus(event, event.orderHash);
    const { sales, totalPrice } = this.parseInfinitySaleOrder(event);
    // TODO save sales
  }

  protected async handleCancelAllOrdersEvent(event: CancelAllOrdersEvent) {
    const userDocRef = firebase.db.collection(firestoreConstants.USERS_COLL).doc(event.user);
    await userDocRef.set({ minOrderNonce: event.minOrderNonce }, { merge: true });

    // update order statuses
    await updateInfinityOrderStatusesForCancelAll(event.user, event.minOrderNonce);
  }

  protected async handleCancelMultipleOrdersEvent(event: CancelMultipleOrdersEvent) {
    await updateInfinityOrderStatusesForMultipleCancel(event.user, event.nonces);
  }

  protected parseInfinitySaleOrder = (sale: PreParsedInfinityNftSale): { sales: NftSale[]; totalPrice: number } => {
    /**
     * Skip the transactions without eth or weth as the payment. ex: usd, matic ...
     */
    if (
      sale.paymentToken !== NULL_ADDRESS &&
      trimLowerCase(sale.paymentToken) !== trimLowerCase(ETHEREUM_WETH_ADDRESS)
    ) {
      return { sales: [], totalPrice: 0 };
    }

    try {
      const totalPrice = convertWeiToEther(sale.price);
      const orders: NftSale[] = [];

      for (const orderItem of sale.orderItems) {
        const collectionAddress = orderItem.collection;
        for (const token of orderItem.tokens) {
          const order: NftSale = {
            chainId: sale.chainId,
            tokenStandard: sale.tokenStandard,
            txHash: trimLowerCase(sale.txHash),
            tokenId: token.tokenId,
            collectionAddress: trimLowerCase(collectionAddress),
            price: totalPrice / sale.quantity,
            paymentToken: sale.paymentToken,
            quantity: token.numTokens,
            buyer: trimLowerCase(sale.buyer),
            seller: trimLowerCase(sale.seller),
            source: sale.source,
            blockNumber: sale.blockNumber,
            timestamp: sale.timestamp
          };
          orders.push(order);
        }
      }

      return { sales: orders, totalPrice };
    } catch (err) {
      console.error('Failed parsing infinity sale orders', err);
      return { sales: [], totalPrice: 0 };
    }
  };
}
