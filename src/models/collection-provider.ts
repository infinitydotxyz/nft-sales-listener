import { ChainId } from '@infinityxyz/lib/types/core/ChainId';
import { Collection } from '@infinityxyz/lib/types/core/Collection';
import { firestoreConstants, getCollectionDocId, trimLowerCase } from '@infinityxyz/lib/utils';
import { COLLECTION_INDEXING_SERVICE_URL } from '../constants';
import { Firebase } from '../database/Firebase';
import QuickLRU from 'quick-lru';
import { enqueueCollection, ResponseType } from '../services/CollectionIndexingService';
import { isCollectionIndexed } from '../utils';

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
          if (!isCollectionIndexed(collection) && this.attemptToIndexCollections) {
            void this.attemptToIndex({ address: collectionAddress, chainId });
          }
          resolve(collection);
        })
        .catch((err) => {
          reject(err);
        });
    });
    this.collectionCache.set(address, promise);
    return promise;
  }

  /**
   * enqueues a collection for indexing
   */
  private async attemptToIndex(collection: { address: string; chainId: string }) {
    try {
      const res = await enqueueCollection(collection, COLLECTION_INDEXING_SERVICE_URL);
      if (res !== ResponseType.AlreadyQueued && res !== ResponseType.IndexingInitiated) {
        console.error(`Failed to enqueue collection:${collection.chainId}:${collection.address}. Reason: ${res}`);
      }
    } catch (err) {
      console.error(`Failed to enqueue collection. ${collection.chainId}:${collection.address}`);
      console.error(err);
    }
  }
}
