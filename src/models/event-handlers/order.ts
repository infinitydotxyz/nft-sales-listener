import { FirestoreOrder, FirestoreOrderItem, OBOrderStatus } from '@infinityxyz/lib/types/core/OBOrder';
import { firestoreConstants } from '@infinityxyz/lib/utils';
import { Firebase } from '../../database/Firebase';
import { FirestoreDistributedCounter } from '../../database/FirestoreCounter';
import { PreParsedInfinityNftSale } from '../../types';
import { OrderItem } from './order-item';
import { OrderType } from './types';

export class Order {
  // order counters
  private ordersCounterDocRef = this.firebase.db
    .collection(firestoreConstants.ORDERS_COLL)
    .doc(firestoreConstants.COUNTER_DOC);
  // num items
  numBuyOrderItems = new FirestoreDistributedCounter(
    this.ordersCounterDocRef,
    firestoreConstants.NUM_BUY_ORDER_ITEMS_FIELD
  );

  numSellOrderItems = new FirestoreDistributedCounter(
    this.ordersCounterDocRef,
    firestoreConstants.NUM_SELL_ORDER_ITEMS_FIELD
  );
  // start prices
  openBuyInterest = new FirestoreDistributedCounter(
    this.ordersCounterDocRef,
    firestoreConstants.OPEN_BUY_INTEREST_FIELD
  );
  openSellInterest = new FirestoreDistributedCounter(
    this.ordersCounterDocRef,
    firestoreConstants.OPEN_SELL_INTEREST_FIELD
  );

  static getRef(orderId: string, firebase: Firebase): FirebaseFirestore.DocumentReference<FirestoreOrder> {
    return firebase.db
      .collection(firestoreConstants.ORDERS_COLL)
      .doc(orderId) as FirebaseFirestore.DocumentReference<FirestoreOrder>;
  }

  updateOrderCounters() {
    const numItems = this.order.numItems;
    if (this.order.signedOrder.isSellOrder) {
      this.numSellOrderItems.incrementBy(numItems * -1);
      this.openSellInterest.incrementBy(this.order.startPriceEth * -1);
    } else {
      this.numBuyOrderItems.incrementBy(numItems * -1);
      this.openBuyInterest.incrementBy(this.order.startPriceEth * -1);
    }
  }

  private orderItemsRef: FirebaseFirestore.CollectionReference<FirestoreOrderItem>;

  constructor(private order: FirestoreOrder, private firebase: Firebase) {
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
      this.updateOrderCounters();
    } catch (err) {
      console.error('Error updating order counters on order fulfillment', err);
    }

    await this.save();
    logger.log('Updated infinity order: ', this.order.id, 'to status', this.order.orderStatus);
    return this.order;
  }

  private async save(): Promise<FirebaseFirestore.WriteResult> {
    return await this.ref.update(this.order);
  }

  private async getOrderItems(): Promise<OrderItem[]> {
    const orderItems = await this.orderItemsRef.get();
    return orderItems.docs.map((doc) => new OrderItem(doc.data(), doc.ref, this.firebase));
  }

  public get type(): OrderType {
    return this.order.isSellOrder ? OrderType.Listing : OrderType.Offer;
  }

  private get ref(): FirebaseFirestore.DocumentReference<FirestoreOrder> {
    return Order.getRef(this.order.id, this.firebase);
  }
}
