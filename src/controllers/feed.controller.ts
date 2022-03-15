import { EtherscanLinkType, InfinityLinkType } from "@infinityxyz/lib/types/core";
import { FeedEventType, NftSaleEvent } from "@infinityxyz/lib/types/core/feed";
import { Token } from "@infinityxyz/lib/types/core/Token";
import { firestoreConstants, getCollectionDocId, getEtherscanLink, getInfinityLink } from "@infinityxyz/lib/utils";
import { firebase } from "container";
import { Transaction } from "models/debouncedSalesUpdater";

export async function writeSalesToFeed({ sales }: Transaction) {
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
  
        const events = sales.map((item, index) => {
          const nftSnapshot = nftSnapshots[index];
          const nft: Partial<Token> | undefined = nftSnapshot.data() as Partial<Token> | undefined;
  
          const name = nft?.metadata?.name ?? 'Unknown';
          const slug = nft?.slug ?? '';
          const image = nft?.image?.url ?? '';
  
          const nftSaleEvent: NftSaleEvent = {
            type: FeedEventType.NftSale,
            buyer: item.buyer,
            seller: item.seller,
            sellerDisplayName: '',
            buyerDisplayName: '',
            price: item.price,
            paymentToken: item.paymentToken,
            source: item.source,
            tokenStandard: item.tokenStandard,
            txHash: item.txHash,
            quantity: item.quantity,
            chainId: item.chainId,
            collectionAddress: item.collectionAddress,
            name,
            slug,
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
            externalUrl: getEtherscanLink({ type: EtherscanLinkType.Transaction, transactionHash: item.txHash })
          };
          return nftSaleEvent;
        });
  
        for (const event of events) {
          const randomDoc = feedRef.doc();
          const id = randomDoc.id;
          const chainId = sales[0].chainId;
          const idPrependedWithChainId = `${chainId}:${id}`;
          const feedDoc = feedRef.doc(idPrependedWithChainId);
          tx.create(feedDoc, event);
        }
      });
    } catch (err) {
        console.error(err);
      return;
    }
  }
  