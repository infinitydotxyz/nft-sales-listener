import { FirestoreOrder, FirestoreOrderItem, OBOrderStatus } from '@infinityxyz/lib/types/core/OBOrder';
import { firestoreConstants } from '@infinityxyz/lib/utils';
import { Firebase } from '../../database/Firebase';
import { PreParsedInfinityNftSale } from '../../types';
import { OrderItem } from './order-item';
import { OrderType } from './types';

export class Order {
  static getRef(orderId: string, firebase: Firebase): FirebaseFirestore.DocumentReference<FirestoreOrder> {
    return firebase.db
      .collection(firestoreConstants.ORDERS_COLL)
      .doc(orderId) as FirebaseFirestore.DocumentReference<FirestoreOrder>;
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
      orderItem.handleOrderItemSale(sale);
      await orderItem.save();
    }

    this.order.orderStatus = OBOrderStatus.Invalid;

    await this.save();
    console.log('Updated infinity order: ', this.order.id, 'to status', this.order.orderStatus);
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
