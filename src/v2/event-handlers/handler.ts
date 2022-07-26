import { NftSale } from '@infinityxyz/lib/types/core';
import { FirestoreOrder, OBOrderStatus } from '@infinityxyz/lib/types/core/OBOrder';
import { trimLowerCase } from '@infinityxyz/lib/utils';
import { ETHEREUM_WETH_ADDRESS, firestoreConstants, NULL_ADDRESS } from '@infinityxyz/lib/utils/constants';
import Firebase from 'database/Firebase';
import FirestoreBatchHandler from 'database/FirestoreBatchHandler';
import { PreParsedInfinityNftSale, PreParsedNftSale } from 'types';
import { convertWeiToEther } from 'utils';
import { CancelAllOrdersEvent } from 'v2/contract-listeners/cancel-all-orders.listener';
import { CancelMultipleOrdersEvent } from 'v2/contract-listeners/cancel-multiple-orders.listener';
import { MatchEvent } from 'v2/contract-listeners/match.listener';
import { TakeEvent } from 'v2/contract-listeners/take.listener';
import { Order } from './order';
import { OrderItem } from './order-item';
import { EventHandler as IEventHandler } from './types';

export class EventHandler implements IEventHandler {
  constructor(private firebase: Firebase) {}

  async cancelAllOrders(event: CancelAllOrdersEvent): Promise<void> {
    const userDocRef = this.firebase.db.collection(firestoreConstants.USERS_COLL).doc(event.user);
    await userDocRef.set({ minOrderNonce: event.minOrderNonce }, { merge: true });
    try {
      const orders = await this.firebase.db
        .collection(firestoreConstants.ORDERS_COLL)
        .where('makerAddress', '==', event.user)
        .where('nonce', '<', event.minOrderNonce)
        .get();

      console.log(`Found: ${orders.size} orders to update for cancel all`);
      const batchHandler = new FirestoreBatchHandler();
      for (const order of orders.docs) {
        // update counters
        try {
          Order.updateOrderCounters(order.data() as FirestoreOrder);
        } catch (err) {
          console.error('Error updating order counters on cancel all orders', err);
        }

        // update order
        const orderRef = order.ref;
        batchHandler.add(orderRef, { orderStatus: OBOrderStatus.Invalid }, { merge: true });

        // update orderItems sub collection
        const orderItems = await orderRef.collection(firestoreConstants.ORDER_ITEMS_SUB_COLL).get();
        console.log(`Found: ${orderItems.size} order items to update for cancel all for this order`);
        for (const orderItem of orderItems.docs) {
          const orderItemRef = orderItem.ref;
          batchHandler.add(orderItemRef, { orderStatus: OBOrderStatus.Invalid }, { merge: true });
        }
      }
      // final flush
      await batchHandler.flush();
    } catch (err) {
      console.error(
        `Listener:[Infinity: CancelAllOrders] failed to update order statuses for cancel all: ${err as string}`
      );
    }
  }

  async cancelMultipleOrders(event: CancelMultipleOrdersEvent): Promise<void> {
    try {
      const batchHandler = new FirestoreBatchHandler();
      for (const nonce of event.nonces) {
        const orders = await this.firebase.db
          .collection(firestoreConstants.ORDERS_COLL)
          .where('makerAddress', '==', event.user)
          .where('nonce', '==', nonce)
          .get();

        for (const order of orders.docs) {
          // update counters
          try {
            Order.updateOrderCounters(order.data() as FirestoreOrder);
          } catch (err) {
            console.error('Error updating order counters on cancel multiple orders', err);
          }

          // update order
          const orderRef = order.ref;
          batchHandler.add(orderRef, { orderStatus: OBOrderStatus.Invalid }, { merge: true });

          // update orderItems sub collection
          const orderItems = await orderRef.collection(firestoreConstants.ORDER_ITEMS_SUB_COLL).get();
          console.log(`Found: ${orderItems.size} order items to update for cancel multiple for this order`);
          for (const orderItem of orderItems.docs) {
            const orderItemRef = orderItem.ref;
            batchHandler.add(orderItemRef, { orderStatus: OBOrderStatus.Invalid }, { merge: true });
          }
        }
      }

      // final flush
      await batchHandler.flush();
    } catch (err) {
      console.error(`Listener:[Infinity: CancelMultipleOrders] failed to update order statuses: ${err as string}`);
    }
  }

  async matchEvent(event: MatchEvent): Promise<void> {      
    await this.updateOrderStatus(event, event.buyOrderHash);
    await this.updateOrderStatus(event, event.sellOrderHash);
    const { sales, totalPrice } = this.parseInfinitySaleOrder(event);
    await this.saveSales({ sales, totalPrice });
  }

  async takeEvent(event: TakeEvent): Promise<void> {
    await this.updateOrderStatus(event, event.orderHash);
    const { sales, totalPrice } = this.parseInfinitySaleOrder(event);   
    await this.saveSales({ sales, totalPrice });
  }

  async nftSalesEvent(sales: PreParsedNftSale[]): Promise<void> {
    const tx = this.parseSaleOrders(sales);
    await this.saveSales(tx);
  }

  async saveSales(tx: { sales: NftSale[], totalPrice: number }): Promise<void> {
    // TODO;
  }

  private async updateOrderStatus(infinitySale: PreParsedInfinityNftSale, orderHash: string): Promise<void> {
    const orderItemQueries = Object.values(OrderItem.getImpactedOrderItemsQueries(infinitySale, orderHash));
    const orderItemRefs = await Promise.all(orderItemQueries.map((query) => query.get()));

    const orderPromises = orderItemRefs
      .flatMap((item) => item.docs)
      .map((item) => {
        const order = item.ref.parent.parent;
        return new Promise<Order>((resolve, reject) => {
          order
            ?.get()
            .then((snap) => {
              const orderData = snap.data() as FirestoreOrder;
              if (orderData) {
                resolve(new Order(orderData));
              } else {
                reject(new Error('Order not found'));
              }
            })
            .catch((err) => {
              console.error(`Listener:[Infinity] failed to get order: ${order?.id}`, err);
              reject(err);
            });
        });
      });

    const orders = await Promise.all(orderPromises);

    console.log(`Found: ${orders.length} orders to update`);

    for (const order of orders) {
      await order.handleSale(infinitySale);
    }
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



 protected parseSaleOrders (sales: PreParsedNftSale[]): { sales: NftSale[]; totalPrice: number } {
  /**
   * Skip the transactions without eth or weth as the payment. ex: usd, matic ...
   * */
  if (
    sales[0].paymentToken !== NULL_ADDRESS &&
    trimLowerCase(sales[0].paymentToken) !== trimLowerCase(ETHEREUM_WETH_ADDRESS)
  ) {
    return { sales: [], totalPrice: 0 };
  }

  try {
    const totalPrice = convertWeiToEther(sales[0].price);
    const orders: NftSale[] = sales.map((tx: PreParsedNftSale) => {
      const order: NftSale = {
        chainId: tx.chainId,
        tokenStandard: tx.tokenStandard,
        txHash: trimLowerCase(tx.txHash),
        tokenId: tx.tokenId,
        collectionAddress: trimLowerCase(tx.collectionAddress),
        price: totalPrice / sales.length / tx.quantity,
        paymentToken: tx.paymentToken,
        quantity: tx.quantity,
        buyer: trimLowerCase(tx.buyer),
        seller: trimLowerCase(tx.seller),
        source: tx.source,
        blockNumber: tx.blockNumber,
        timestamp: tx.timestamp
      };
      return order;
    });

    return { sales: orders, totalPrice };
  } catch (err) {
    console.error('Failed parsing orders', err);
    return { sales: [], totalPrice: 0 };
  }
};

}
