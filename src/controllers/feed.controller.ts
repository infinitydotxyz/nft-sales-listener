import { Collection, EtherscanLinkType, InfinityLinkType } from '@infinityxyz/lib/types/core';
import { FeedEventType, NftSaleEvent } from '@infinityxyz/lib/types/core/feed';
import { Token } from '@infinityxyz/lib/types/core/Token';
import {
  firestoreConstants,
  getCollectionDocId,
  getEtherscanLink,
  getInfinityLink,
  getUserDisplayName,
  trimLowerCase
} from '@infinityxyz/lib/utils';
import { firebase, providers } from 'container';
import { TransactionType } from 'types/Transaction';

export async function writeSalesToFeed(
  { sales }: TransactionType,
  collections: { [address: string]: Partial<Collection> }
) {
  try {
    await firebase.db.runTransaction(async (tx) => {
      const feedRef = firebase.db.collection(firestoreConstants.FEED_COLL);
      const query = feedRef.where('txHash', '==', sales[0]?.txHash).limit(1);
      const saleTx = await tx.get(query);

      if (!saleTx.empty) {
        throw new Error('transaction already saved');
      }

      const nftSnapshotPromises = sales.map((item) => {
        const nftRef = firebase.db
          .collection(firestoreConstants.COLLECTIONS_COLL)
          .doc(getCollectionDocId({ collectionAddress: item.collectionAddress, chainId: item.chainId }))
          .collection(firestoreConstants.COLLECTION_NFTS_COLL)
          .doc(item.tokenId);
        return nftRef.get(); // this doesn't impact the tx
      });

      const nftSnapshots = await Promise.all(nftSnapshotPromises);

      const chainId = sales[0].chainId;
      const provider = providers.getProviderByChainId(chainId);
      const buyer = sales[0].buyer;
      const seller = sales[0].seller;
      const [buyerDisplayName, sellerDisplayName] = await Promise.all(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        [buyer, seller].map((item) => getUserDisplayName(item, chainId, provider as any))
      );

      const events = sales
        .map((item, index) => {
          const nftSnapshot = nftSnapshots[index];
          const nft: Partial<Token> | undefined = nftSnapshot.data() as Partial<Token> | undefined;

          const collection = collections[trimLowerCase(item.collectionAddress)];
          const collectionSlug = collection?.slug;
          const collectionName = collection?.metadata?.name;

          const nftName = nft?.metadata?.name ?? nft?.tokenId ?? '';
          const nftSlug = nft?.slug ?? '';
          const image = nft?.image?.url ?? '';

          if (!collectionSlug || !collectionName || !nftName || !image) {
            return;
          }

          const nftSaleEvent: NftSaleEvent = {
            type: FeedEventType.NftSale,
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
              tokenId: item.tokenId
            }),
            externalUrl: getEtherscanLink({ type: EtherscanLinkType.Transaction, transactionHash: item.txHash }),
            collectionProfileImage: '',
            hasBlueCheck: false
          };
          return nftSaleEvent;
        })
        .filter((item) => !!item);

      for (const event of events) {
        const nftSaleDoc = feedRef.doc();
        tx.create(nftSaleDoc, event);
      }
    });
  } catch (err) {
    return;
  }
}
