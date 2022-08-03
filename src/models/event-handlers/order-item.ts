import { FirestoreOrderItem, OBOrderStatus } from '@infinityxyz/lib/types/core';
import { firestoreConstants } from '@infinityxyz/lib/utils';
import { firebase } from 'container';
import { PreParsedInfinityNftSale } from 'types';
import { getUsername } from 'utils';
import { OrderType } from './types';

export class OrderItem {
  static readonly OWNER_INHERITS_OFFERS = true;

  static getImpactedOrderItemsQueries(
    order: Pick<PreParsedInfinityNftSale, 'buyer' | 'seller'>,
    orderHash: string
  ): Record<string, FirebaseFirestore.Query<FirestoreOrderItem>> {
    const tokenQuery = firebase.db
      .collectionGroup(firestoreConstants.ORDER_ITEMS_SUB_COLL)
      .where('id', '==', orderHash) as FirebaseFirestore.Query<FirestoreOrderItem>;

    const offers = tokenQuery.where('isSellOrder', '==', false);
    const listings = tokenQuery.where('isSellOrder', '==', true);

    const impactedListings = listings.where('makerAddress', 'in', [order.seller, order.buyer]);

    let impactedOffers = offers;
    if (!OrderItem.OWNER_INHERITS_OFFERS) {
      impactedOffers = offers.where('takerAddress', '==', order.seller);
    }

    return {
      offers: impactedOffers,
      listings: impactedListings
    };
  }

  private initialOwner: string;
  private currentOwner: string;

  constructor(
    private orderItem: FirestoreOrderItem,
    private ref: FirebaseFirestore.DocumentReference<FirestoreOrderItem>
  ) {
    this.initialOwner = this._ownerFromOrder;
    this.currentOwner = this.initialOwner;
  }

  get orderStatus(): OBOrderStatus {
    return this.orderItem.orderStatus;
  }

  get type(): OrderType {
    return this.orderItem.isSellOrder ? OrderType.Listing : OrderType.Offer;
  }

  get taker(): string {
    return this.orderItem.takerAddress;
  }

  orderItemMatches(sale: Pick<PreParsedInfinityNftSale, 'orderItems' | 'seller' | 'buyer'>): boolean {
    let correctToken = false;
    for (const orderItem of sale.orderItems) {
      if (orderItem.collection === this.orderItem.collectionAddress) {
        for (const token of orderItem.tokens) {
          if (token.tokenId === this.orderItem.tokenId && token.numTokens === this.orderItem.numTokens) {
            correctToken = true;
            break;
          }
        }
      }
    }

    /**
     * if the order is a listing, then the order matches if
     * 1. the sale is to the maker
     * 2. the sale is from the maker
     */
    if (this.type === OrderType.Listing) {
      return (
        correctToken && (sale.seller === this.orderItem.makerAddress || sale.buyer === this.orderItem.makerAddress)
      );
    }

    /**
     * the order is an offer
     *
     * if the order is an offer then the order matches if
     * 1. the sale is to the taker
     * 2. the new owner inherits the offers on the token
     */
    const newOwnerWillBecomeTaker = OrderItem.OWNER_INHERITS_OFFERS;
    const takerIsGainingTokens = sale.buyer === this.orderItem.takerAddress;
    // const takerIsLosingTokens = transfer.from === this.orderItem.takerAddress; // TODO erc1155
    const takerShouldBeUpdated = newOwnerWillBecomeTaker || takerIsGainingTokens;
    return correctToken && takerShouldBeUpdated;
  }

  async handleOrderItemSale(
    sale: Pick<PreParsedInfinityNftSale, 'buyer' | 'seller' | 'orderItems'>
  ): Promise<FirestoreOrderItem> {
    this.orderItem.orderStatus = OBOrderStatus.Invalid;

    if (!this.orderItemMatches(sale)) {
      return this.orderItem;
    }

    if (this.type === OrderType.Offer && OrderItem.OWNER_INHERITS_OFFERS) {
      this.orderItem.takerAddress = sale.buyer;
      const takerUsername = await getUsername(sale.buyer);
      this.orderItem.takerUsername = takerUsername;
    }
    this.currentOwner = sale.buyer;
    return this.orderItem;
  }

  save(): Promise<FirebaseFirestore.WriteResult> {
    return this.ref.update(this.orderItem);
  }

  saveViaBatch(batch: FirebaseFirestore.WriteBatch): void {
    batch.update(this.ref, this.orderItem);
  }

  private get _ownerFromOrder(): string {
    if (this.type === OrderType.Offer) {
      return this.orderItem.takerAddress;
    }
    return this.orderItem.makerAddress;
  }
}
