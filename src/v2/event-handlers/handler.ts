import { ChainId, EtherscanLinkType, InfinityLinkType, NftSale, Token } from '@infinityxyz/lib/types/core';
import { EventType, NftSaleEvent } from '@infinityxyz/lib/types/core/feed';
import { FirestoreOrder, OBOrderStatus } from '@infinityxyz/lib/types/core/OBOrder';
import { getCollectionDocId, getEtherscanLink, getInfinityLink, getUserDisplayName, trimLowerCase } from '@infinityxyz/lib/utils';
import { ETHEREUM_WETH_ADDRESS, firestoreConstants, NULL_ADDRESS } from '@infinityxyz/lib/utils/constants';
import Firebase from 'database/Firebase';
import FirestoreBatchHandler from 'database/FirestoreBatchHandler';
import Providers from 'models/Providers';
import { PreParsedInfinityNftSale, PreParsedNftSale } from 'types';
import { convertWeiToEther } from 'utils';
import { CancelAllOrdersEvent } from 'v2/contract-listeners/cancel-all-orders.listener';
import { CancelMultipleOrdersEvent } from 'v2/contract-listeners/cancel-multiple-orders.listener';
import { MatchEvent } from 'v2/contract-listeners/match.listener';
import { TakeEvent } from 'v2/contract-listeners/take.listener';
import { CollectionProvider } from 'v2/models/collection-provider';
import { Order } from './order';
import { OrderItem } from './order-item';
import { EventHandler as IEventHandler } from './types';

export class EventHandler implements IEventHandler {
  constructor(private firebase: Firebase, private providers: Providers, private collectionProvider: CollectionProvider) {}

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
    const { sales } = this.parseInfinitySaleOrder(event);
    await this.saveSales(sales);
  }

  async takeEvent(event: TakeEvent): Promise<void> {
    await this.updateOrderStatus(event, event.orderHash);
    const { sales } = this.parseInfinitySaleOrder(event);
    await this.saveSales(sales);
  }

  async nftSalesEvent(sales: PreParsedNftSale[]): Promise<void> {
    const tx = this.parseSaleOrders(sales);
    await this.saveSales(tx.sales);
  }

  private async saveSales(sales: NftSale[]): Promise<void> {
    if (!sales.length || !sales[0]) {
      return;
    }
    const feedEvents = await this.getFeedSaleEvents(sales);
    const txHash = sales[0]?.txHash;
    await this.firebase.db.runTransaction(async (tx) => {
      const snap = this.firebase.db
        .collection(firestoreConstants.SALES_COLL)
        .where('txHash', '==', trimLowerCase(txHash))
        .limit(1);
      const data = await tx.get(snap);
      if (!data.empty) {
        console.log(`Tx: ${txHash} already saved, skipping`);
        return;
      }

      const salesCollectionRef = this.firebase.db.collection(firestoreConstants.SALES_COLL);
      for (const sale of sales) {
        const docRef = salesCollectionRef.doc();
        tx.create(docRef, sale);
      }

      const feedCollectionRef = this.firebase.db.collection(firestoreConstants.FEED_COLL);
      for(const feedEvent of feedEvents) {
        const docRef = feedCollectionRef.doc();
        tx.create(docRef, feedEvent);
      }
    });
  }

  private async getFeedSaleEvents(sales: NftSale[]): Promise<NftSaleEvent[]> {
    const nftRefs = sales.map((sale) => {
      const nftRef = this.firebase.db
      .collection(firestoreConstants.COLLECTIONS_COLL)
      .doc(getCollectionDocId({ collectionAddress: sale.collectionAddress, chainId: sale.chainId }))
      .collection(firestoreConstants.COLLECTION_NFTS_COLL)
      .doc(sale.tokenId);
      return nftRef;
    });
    const nftSnapshots = await this.firebase.db.getAll(...nftRefs);


    const chainId = sales[0].chainId as ChainId;
    const provider = this.providers.getProviderByChainId(chainId);
    const buyer = sales[0].buyer;
    const seller = sales[0].seller;
    const [buyerDisplayName, sellerDisplayName] = await Promise.all(
      [buyer, seller].map((item) => getUserDisplayName(item, chainId, provider))
    );

    const result = await Promise.allSettled(sales
    .map(async (item, index) => {
      const nftSnapshot = nftSnapshots[index];
      const nft: Partial<Token> = (nftSnapshot.data() ?? {}) as Partial<Token>;

      const collection = await this.collectionProvider.getCollection(chainId, item.collectionAddress);
      const collectionSlug = collection?.slug;
      const collectionName = collection?.metadata?.name;

      const nftName = nft?.metadata?.name ?? nft?.tokenId ?? item.tokenId;
      const nftSlug = nft?.slug ?? trimLowerCase(nftName) ?? '';
      const image =
        nft?.image?.url ||
        nft?.alchemyCachedImage ||
        nft?.image?.originalUrl ||
        collection?.metadata?.profileImage ||
        '';

      if (!collectionSlug || !collectionName || !nftName || !image) {
        console.log(
          'Not writing sale to feed as some data is empty',
          collectionSlug,
          collectionName,
          nftName,
          image
        );
        return;
      }

      const nftSaleEvent: NftSaleEvent = {
        usersInvolved: [item.buyer, item.seller],
        type: EventType.NftSale,
        collectionProfileImage: collection?.metadata?.profileImage ?? '',
        hasBlueCheck: collection?.hasBlueCheck ?? false,
        buyer: item.buyer,
        seller: item.seller,
        sellerDisplayName: sellerDisplayName,
        buyerDisplayName: buyerDisplayName,
        price: item.price,
        paymentToken: item.paymentToken,
        source: item.source,
        tokenStandard: item.tokenStandard,
        txHash: item.txHash,
        quantity: item.quantity,
        chainId: item.chainId,
        collectionAddress: item.collectionAddress,
        collectionName: collectionName,
        collectionSlug: collectionSlug,
        nftName,
        nftSlug,
        likes: 0,
        comments: 0,
        tokenId: item.tokenId,
        image,
        timestamp: item.timestamp,
        internalUrl: getInfinityLink({
          type: InfinityLinkType.Asset,
          collectionAddress: item.collectionAddress,
          tokenId: item.tokenId,
          chainId: item.chainId as ChainId
        }),
        externalUrl: getEtherscanLink({ type: EtherscanLinkType.Transaction, transactionHash: item.txHash })
      };
      return nftSaleEvent;
    }));

    const eventsResolved = (result.filter((event) => event.status === 'fulfilled') as PromiseFulfilledResult<NftSaleEvent>[]).map((event) => event.value);
    const saleEvents = eventsResolved.filter((event) => !!event);

    return saleEvents;
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

  protected parseSaleOrders(sales: PreParsedNftSale[]): { sales: NftSale[]; totalPrice: number } {
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
  }
}
