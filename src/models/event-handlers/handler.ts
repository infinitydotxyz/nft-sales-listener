/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  ChainId,
  EtherscanLinkType,
  ExternalNftSale,
  InfinityLinkType,
  InfinityNftSale,
  NftSale,
  RageQuitEvent,
  SaleSource,
  StakerEvents,
  Token,
  TokensStakedEvent,
  TokensUnStakedEvent
} from '@infinityxyz/lib/types/core';
import { EventType, NftSaleEvent } from '@infinityxyz/lib/types/core/feed';
import { FirestoreOrder, OBOrderStatus } from '@infinityxyz/lib/types/core/OBOrder';
import {
  getCollectionDocId,
  getEtherscanLink,
  getInfinityLink,
  getUserDisplayName,
  trimLowerCase
} from '@infinityxyz/lib/utils';
import { ETHEREUM_WETH_ADDRESS, firestoreConstants, NULL_ADDRESS } from '@infinityxyz/lib/utils/constants';
import FirestoreBatchHandler from '../../database/FirestoreBatchHandler';
import { BigNumber } from 'ethers';
import { PreParsedInfinityNftSale, PreParsedMultipleNftSale, PreParseInfinityMultipleNftSale } from '../../types';
import { convertWeiToEther } from '../../utils';
import { CancelAllOrdersEvent } from '../contract-listeners/cancel-all-orders.listener';
import { CancelMultipleOrdersEvent } from '../contract-listeners/cancel-multiple-orders.listener';
import { MatchOrderBundleEvent } from '../contract-listeners/match-order.listener';
import { ProtocolFeeUpdatedEvent } from '../contract-listeners/protocol-fee-updated.listener';
import { TakeOrderBundleEvent } from '../contract-listeners/take-order.listener';
import { CollectionProvider } from '../../models/collection-provider';
import { Order } from './order';
import { OrderItem } from './order-item';
import { EventHandler as IEventHandler } from './types';
import { Providers } from '../Providers';
import { Firebase } from '../../database/Firebase';

export class EventHandler implements IEventHandler {
  constructor(
    private firebase: Firebase,
    private providers: Providers,
    private collectionProvider: CollectionProvider
  ) {}

  async tokensStakedEvent(event: TokensStakedEvent): Promise<void> {
    console.log(`User: ${event.user} staked ${event.amount} tokens`);
    await this._saveStakerEvent(event);
  }

  async tokensUnStakedEvent(event: TokensUnStakedEvent): Promise<void> {
    console.log(`User: ${event.user} un-staked ${event.amount} tokens`);
    await this._saveStakerEvent(event);
  }

  async tokensRageQuitEvent(event: RageQuitEvent): Promise<void> {
    console.log(
      `User: ${event.user} rage quit. User received ${event.amount} tokens, and lost ${event.penaltyAmount} tokens`
    );
    await this._saveStakerEvent(event);
  }

  protected async _saveStakerEvent(event: StakerEvents): Promise<void> {
    const stakingContractDocId = `${event.stakerContractChainId}:${event.stakerContractAddress}`;
    const stakingContractRef = this.firebase.db
      .collection(firestoreConstants.STAKING_CONTRACTS_COLL)
      .doc(stakingContractDocId);
    const stakingLedgerRef = stakingContractRef.collection(firestoreConstants.STAKING_LEDGER_COLL).doc(event.txHash);
    try {
      await stakingLedgerRef.create(event);
    } catch (err) {
      if ((err as any)?.code === 6) {
        console.log(`Staker event already exists: ${event.txHash}`);
      } else {
        console.error(err);
      }
    }
  }

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
      const batchHandler = new FirestoreBatchHandler(this.firebase);
      for (const orderDoc of orders.docs) {
        // update counters
        try {
          const order = new Order(orderDoc.data() as FirestoreOrder, this.firebase);
          order.updateOrderCounters();
        } catch (err) {
          console.error('Error updating order counters on cancel all orders', err);
        }

        // update order
        const orderRef = orderDoc.ref;
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
      const batchHandler = new FirestoreBatchHandler(this.firebase);
      for (const nonce of event.nonces) {
        const orders = await this.firebase.db
          .collection(firestoreConstants.ORDERS_COLL)
          .where('makerAddress', '==', event.user)
          .where('nonce', '==', nonce)
          .get();

        for (const orderDoc of orders.docs) {
          // update counters
          try {
            const order = new Order(orderDoc.data() as FirestoreOrder, this.firebase);
            order.updateOrderCounters();
          } catch (err) {
            console.error('Error updating order counters on cancel multiple orders', err);
          }

          // update order
          const orderRef = orderDoc.ref;
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

  async matchOrderEvent({ events }: MatchOrderBundleEvent): Promise<void> {
    for (const sale of events.sales) {
      await this.updateOrderStatus(sale, sale.buyOrderHash);
      await this.updateOrderStatus(sale, sale.sellOrderHash);
    }
    const sales = this.parseInfinityMultipleSaleOrder(events);
    await this.saveSales(sales);
  }

  async takeOrderEvent({ events }: TakeOrderBundleEvent): Promise<void> {
    for (const sale of events.sales) {
      await this.updateOrderStatus(sale, sale.orderHash);
    }
    const sales = this.parseInfinityMultipleSaleOrder(events);
    await this.saveSales(sales);
  }

  async nftSalesEvent(preParsedSale: PreParsedMultipleNftSale): Promise<void> {
    const parsedOrder = this.parseSaleOrder(preParsedSale);
    await this.saveSales(parsedOrder);
  }

  async protocolFeeUpdatedEvent(protocolFeeUpdated: ProtocolFeeUpdatedEvent): Promise<void> {
    await this.firebase.db
      .collection(firestoreConstants.PROTOCOL_FEE_EVENTS_COLL)
      .doc(protocolFeeUpdated.txHash)
      .set(protocolFeeUpdated);
  }

  private async saveSales(sales: NftSale[]): Promise<void> {
    if (!sales.length || !sales[0]) {
      return;
    }
    const events = await this.getFeedSaleEvents(sales);
    const txHash = sales[0]?.txHash;
    try {
      await this.firebase.db.runTransaction(async (tx) => {
        const snap = this.firebase.db
          .collection(firestoreConstants.SALES_COLL)
          .where('txHash', '==', trimLowerCase(txHash))
          .limit(1);
        const data = await tx.get(snap);
        if (!data.empty) {
          throw new Error(`Sale already exists for txHash: ${txHash}. Skipping`);
        }

        const salesCollectionRef = this.firebase.db.collection(firestoreConstants.SALES_COLL);
        const feedCollectionRef = this.firebase.db.collection(firestoreConstants.FEED_COLL);

        for (const { sale, feedEvent } of events) {
          if (feedEvent) {
            const feedDocRef = feedCollectionRef.doc();
            tx.create(feedDocRef, feedEvent);
            sale.isFeedUpdated = true;
          }
          const saleDocRef = salesCollectionRef.doc();
          tx.create(saleDocRef, sale);
        }
      });
    } catch (err: any) {
      if (err?.toString?.()?.includes('Sale already exists for txHash')) {
        console.log(`Sale already exists for txHash: ${txHash}`);
        return;
      } else {
        console.error(err);
      }
    }
  }

  private async getFeedSaleEvents(sales: NftSale[]): Promise<{ sale: NftSale; feedEvent: NftSaleEvent | undefined }[]> {
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

    const promiseSettledResult = await Promise.allSettled(
      sales.map(async (item, index) => {
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
          console.log('Not writing sale to feed as some data is empty', collectionSlug, collectionName, nftName, image);
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
      })
    );

    const results = promiseSettledResult.map((item, index) => {
      const sale = sales[index];
      const feedEvent = item.status === 'fulfilled' ? item.value : undefined;
      return {
        sale,
        feedEvent
      };
    });

    return results;
  }

  private async updateOrderStatus(
    infinitySale: Pick<PreParsedInfinityNftSale, 'buyer' | 'seller' | 'orderItems'>,
    orderHash: string
  ): Promise<void> {
    const orderItemQueries = Object.values(
      OrderItem.getImpactedOrderItemsQueries(infinitySale, orderHash, this.firebase)
    );
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
                resolve(new Order(orderData, this.firebase));
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

  protected parseInfinityMultipleSaleOrder(preParsedSales: PreParseInfinityMultipleNftSale): InfinityNftSale[] {
    const sales: InfinityNftSale[] = [];
    for (const preParsedSale of preParsedSales.sales) {
      if (
        preParsedSale.paymentToken === NULL_ADDRESS ||
        trimLowerCase(preParsedSale.paymentToken) === ETHEREUM_WETH_ADDRESS
      ) {
        const partialSale: Omit<
          InfinityNftSale,
          'tokenId' | 'collectionAddress' | 'price' | 'quantity' | 'protocolFeeBPS' | 'protocolFee' | 'protocolFeeWei'
        > = {
          chainId: preParsedSales.chainId,
          txHash: trimLowerCase(preParsedSales.txHash),
          blockNumber: preParsedSales.blockNumber,
          timestamp: preParsedSales.timestamp,
          paymentToken: preParsedSale.paymentToken,
          buyer: trimLowerCase(preParsedSale.buyer),
          seller: trimLowerCase(preParsedSale.seller),
          source: preParsedSales.source as SaleSource.Infinity,
          tokenStandard: preParsedSale.tokenStandard,
          isAggregated: false,
          isDeleted: false,
          isFeedUpdated: false
        };

        const totalPrice = convertWeiToEther(preParsedSale.price);
        const orderItemPrice = totalPrice / preParsedSale.orderItems.length;
        const orderItemProtocolFee =
          convertWeiToEther(BigInt(preParsedSale.protocolFeeWei)) / preParsedSale.orderItems.length;
        const orderItemProtocolFeeWei = BigNumber.from(preParsedSale.protocolFeeWei).div(
          preParsedSale.orderItems.length
        );
        for (const orderItem of preParsedSale.orderItems) {
          const collectionAddress = trimLowerCase(orderItem.collection);
          for (const token of orderItem.tokens) {
            const sale: InfinityNftSale = {
              ...partialSale,
              tokenId: token.tokenId,
              collectionAddress: collectionAddress,
              price: orderItemPrice,
              quantity: token.numTokens,
              protocolFeeBPS: preParsedSale.protocolFeeBPS,
              protocolFee: orderItemProtocolFee,
              protocolFeeWei: orderItemProtocolFeeWei.toString(),
              isAggregated: false,
              isDeleted: false
            };
            sales.push(sale);
          }
        }
      }
    }
    return sales;
  }

  protected parseSaleOrder(preParsedSale: PreParsedMultipleNftSale): NftSale[] {
    if (
      preParsedSale.paymentToken !== NULL_ADDRESS &&
      trimLowerCase(preParsedSale.paymentToken) !== ETHEREUM_WETH_ADDRESS
    ) {
      return [];
    }
    const sales: NftSale[] = [];
    for (const sale of preParsedSale.sales) {
      const totalPrice = convertWeiToEther(sale.price);
      const nftSale: ExternalNftSale = {
        chainId: preParsedSale.chainId,
        txHash: trimLowerCase(preParsedSale.txHash),
        blockNumber: preParsedSale.blockNumber,
        timestamp: preParsedSale.timestamp,
        collectionAddress: trimLowerCase(sale.collectionAddress),
        tokenId: sale.tokenId,
        price: totalPrice / sale.quantity,
        paymentToken: trimLowerCase(preParsedSale.paymentToken),
        buyer: trimLowerCase(sale.buyer),
        seller: trimLowerCase(sale.seller),
        quantity: sale.quantity,
        source: preParsedSale.source as SaleSource.OpenSea | SaleSource.Seaport,
        tokenStandard: sale.tokenStandard,
        isAggregated: false,
        isDeleted: false,
        isFeedUpdated: false
      };
      sales.push(nftSale);
    }

    return sales;
  }
}
