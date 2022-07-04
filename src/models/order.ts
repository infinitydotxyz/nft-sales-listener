import { FirestoreOrder, FirestoreOrderItem, OBOrderStatus } from '@infinityxyz/lib/types/core/OBOrder';
import { firestoreConstants } from '@infinityxyz/lib/utils/constants';
import { firebase } from 'container';
import { PreParsedInfinityNftSale } from 'types';
import { OrderItem } from './order-item';
import { OrderType } from './order.types';

export class Order {
  static getRef(orderId: string): FirebaseFirestore.DocumentReference<FirestoreOrder> {
    return firebase.db
      .collection(firestoreConstants.ORDERS_COLL)
      .doc(orderId) as FirebaseFirestore.DocumentReference<FirestoreOrder>;
  }

  private orderItemsRef: FirebaseFirestore.CollectionReference<FirestoreOrderItem>;

  constructor(private order: FirestoreOrder) {
    this.orderItemsRef = this.ref.collection(
      firestoreConstants.ORDER_ITEMS_SUB_COLL
    ) as FirebaseFirestore.CollectionReference<FirestoreOrderItem>;
  }

  public async handleSale(sale: PreParsedInfinityNftSale): Promise<FirestoreOrder> {
    const orderItems = await this.getOrderItems();
    for (const orderItem of orderItems) {
      await orderItem.handleOrderItemSale(sale);
      await orderItem.save();
    }

    this.order.orderStatus = OBOrderStatus.Invalid;

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
