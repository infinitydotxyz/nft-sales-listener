import { Collection, NftSale } from '@infinityxyz/lib/types/core';
import { firebase, logger } from 'container';
import { TransactionType } from 'types/Transaction';

export default class Transaction {
  constructor(public tx: TransactionType) {}

  get salesByCollection(): { [address: string]: NftSale[] } {
    return this.tx.sales.reduce(
      (acc: { [address: string]: NftSale[] }, sale: NftSale) => ({
        ...acc,
        [sale.collectionAddress]: [...(acc[sale.collectionAddress] ?? []), sale]
      }),
      {}
    );
  }

  async getCollectionsFromSales(): Promise<{
    [address: string]: Partial<Collection>;
  }> {
    try {
      const collectionAddresses = new Map(
        this.tx.sales.map((sale) => [
          sale.collectionAddress,
          { address: sale.collectionAddress, chainId: sale.chainId }
        ])
      );

      const collectionPromises: Promise<FirebaseFirestore.DocumentSnapshot>[] = [];

      for (const [, collection] of collectionAddresses) {
        const collectionPromise = firebase.getCollectionDocRef(collection.chainId, collection.address).get();
        collectionPromises.push(collectionPromise);
      }

      const collectionData = (await Promise.all(collectionPromises)).reduce(
        (acc: { [address: string]: Partial<Collection> }, snapShot) => {
          const collection = snapShot.data();
          if (collection?.address && typeof collection.address === 'string') {
            acc[collection.address] = collection as Partial<Collection>;
          }
          return acc;
        },
        {}
      );

      return collectionData;
    } catch (err) {
      logger.error(`Failed to get collection data`);
      logger.error(err);
      return {};
    }
  }
}
