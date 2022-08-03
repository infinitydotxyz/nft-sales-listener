import { FirestoreOrder, FirestoreOrderItem, OBOrderStatus } from '@infinityxyz/lib/types/core/OBOrder';
import { firestoreConstants } from '@infinityxyz/lib/utils';
import { firebase } from 'container';
import { FirestoreDistributedCounter } from 'database/FirestoreCounter';
import { PreParsedInfinityNftSale } from 'types';
import { OrderItem } from './order-item';
import { OrderType } from './types';

export class Order {
  // order counters
  private static ordersCounterDocRef = firebase.db
    .collection(firestoreConstants.ORDERS_COLL)
    .doc(firestoreConstants.COUNTER_DOC);
  // num items
  static numBuyOrderItems = new FirestoreDistributedCounter(
    Order.ordersCounterDocRef,
    firestoreConstants.NUM_BUY_ORDER_ITEMS_FIELD
  );
  static numSellOrderItems = new FirestoreDistributedCounter(
    Order.ordersCounterDocRef,
    firestoreConstants.NUM_SELL_ORDER_ITEMS_FIELD
  );
  // start prices
  static openBuyInterest = new FirestoreDistributedCounter(
    Order.ordersCounterDocRef,
    firestoreConstants.OPEN_BUY_INTEREST_FIELD
  );
  static openSellInterest = new FirestoreDistributedCounter(
    Order.ordersCounterDocRef,
    firestoreConstants.OPEN_SELL_INTEREST_FIELD
  );

  static getRef(orderId: string): FirebaseFirestore.DocumentReference<FirestoreOrder> {
    return firebase.db
      .collection(firestoreConstants.ORDERS_COLL)
      .doc(orderId) as FirebaseFirestore.DocumentReference<FirestoreOrder>;
  }

  static updateOrderCounters(order: FirestoreOrder) {
    const numItems = order.numItems;
    if (order.signedOrder.isSellOrder) {
      Order.numSellOrderItems.incrementBy(numItems * -1);
      Order.openSellInterest.incrementBy(order.startPriceEth * -1);
    } else {
      Order.numBuyOrderItems.incrementBy(numItems * -1);
      Order.openBuyInterest.incrementBy(order.startPriceEth * -1);
    }
  }

  private orderItemsRef: FirebaseFirestore.CollectionReference<FirestoreOrderItem>;

  constructor(private order: FirestoreOrder) {
    this.orderItemsRef = this.ref.collection(
      firestoreConstants.ORDER_ITEMS_SUB_COLL
    ) as FirebaseFirestore.CollectionReference<FirestoreOrderItem>;
  }

  public async handleSale(
    sale: Pick<PreParsedInfinityNftSale, 'buyer' | 'seller' | 'orderItems'>
  ): Promise<FirestoreOrder> {
    const orderItems = await this.getOrderItems();
    for (const orderItem of orderItems) {
      await orderItem.handleOrderItemSale(sale);
      await orderItem.save();
    }

    this.order.orderStatus = OBOrderStatus.Invalid;

    try {
      Order.updateOrderCounters(this.order);
    } catch (err) {
      console.error('Error updating order counters on order fulfillment', err);
    }

    await this.save();
    return this.order;
  }

  private async save(): Promise<FirebaseFirestore.WriteResult> {
    return await this.ref.update(this.order);
  }

  private async getOrderItems(): Promise<OrderItem[]> {
    const orderItems = await this.orderItemsRef.get();
    return orderItems.docs.map((doc) => new OrderItem(doc.data(), doc.ref));
  }

  public get type(): OrderType {
    return this.order.isSellOrder ? OrderType.Listing : OrderType.Offer;
  }

  private get ref(): FirebaseFirestore.DocumentReference<FirestoreOrder> {
    return Order.getRef(this.order.id);
  }
}
