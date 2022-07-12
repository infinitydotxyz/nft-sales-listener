/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { ChainId, Collection, EtherscanLinkType, InfinityLinkType } from '@infinityxyz/lib/types/core';
import { EventType, NftSaleEvent } from '@infinityxyz/lib/types/core/feed';
import { Token } from '@infinityxyz/lib/types/core/Token';
import { firestoreConstants } from '@infinityxyz/lib/utils/constants';
import { getEtherscanLink } from '@infinityxyz/lib/utils/etherscan';
import { getCollectionDocId } from '@infinityxyz/lib/utils/firestore';
import { trimLowerCase } from '@infinityxyz/lib/utils/formatters';
import { getInfinityLink } from '@infinityxyz/lib/utils/links';
import { getUserDisplayName } from '@infinityxyz/lib/utils/user';
import { firebase, providers } from 'container';
import { TransactionType } from 'types/Transaction';
import { logger } from '../container';

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

          const nftName = (nft?.metadata as any)?.name ?? nft?.tokenId ?? item.tokenId;
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
          const nftSlug = nft?.slug ?? trimLowerCase(nftName) ?? '';
          const image =
            nft?.image?.url ||
            nft?.alchemyCachedImage ||
            nft?.image?.originalUrl ||
            collection?.metadata?.profileImage ||
            '';

          if (!collectionSlug || !collectionName || !nftName || !image) {
            logger.log(
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
