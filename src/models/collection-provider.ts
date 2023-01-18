import { ChainId } from '@infinityxyz/lib/types/core/ChainId';
import { Collection } from '@infinityxyz/lib/types/core/Collection';
import { firestoreConstants, getCollectionDocId, trimLowerCase } from '@infinityxyz/lib/utils';
import QuickLRU from 'quick-lru';
import { Firebase } from '../database/Firebase';

export class CollectionProvider {
  private collectionCache: QuickLRU<string, Promise<Partial<Collection>>>;

  constructor(maxSize: number, private firebase: Firebase, private attemptToIndexCollections = true) {
    this.collectionCache = new QuickLRU({
      maxSize: maxSize
    });
  }

  public getCollection(chainId: ChainId, collectionAddress: string): Promise<Partial<Collection>> {
    const address = trimLowerCase(collectionAddress);
    const existingCollection = this.collectionCache.get(address);
    if (existingCollection) {
      return existingCollection;
    }
    const promise = new Promise<Partial<Collection>>((resolve, reject) => {
      this.firebase.db
        .collection(firestoreConstants.COLLECTIONS_COLL)
        .doc(getCollectionDocId({ chainId, collectionAddress: address }))
        .get()
        .then((doc) => {
          const collection = (doc.data() || {}) as Partial<Collection>;
          resolve(collection);
        })
        .catch((err) => {
          reject(err);
        });
    });
    this.collectionCache.set(address, promise);
    return promise;
  }
}
