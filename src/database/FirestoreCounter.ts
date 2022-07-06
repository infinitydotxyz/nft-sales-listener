import { logger } from 'container';
import * as uuid from 'uuid';
import firebaseAdmin from 'firebase-admin';

export class FirestoreDistributedCounter {
  private shardsRef: FirebaseFirestore.CollectionReference<FirebaseFirestore.DocumentData>;
  private readonly SHARD_COLLECTION_ID = '_counter_shards_';

  /**
   * Constructs a sharded counter object that references to a field
   * in a document that is a counter.
   * @param doc A reference to a document with a counter field.
   * @param field A path to a counter field in the above document.
   */
  constructor(
    private doc: FirebaseFirestore.DocumentReference,
    private field: string
  ) {
    this.shardsRef = this.doc.collection(this.SHARD_COLLECTION_ID);
  }

  public incrementBy(val: number) {
    const increment: any = firebaseAdmin.firestore.FieldValue.increment(val);
    const update: { [key: string]: any } = this.field
      .split('.')
      .reverse()
      .reduce((value, name) => ({ [name]: value }), increment);

    const shardId = uuid.v4();
    this.shardsRef
      .doc(shardId)
      .set(update, { merge: true })
      .catch((err) => {
        logger.error('Error updating firestore distributed counter shard', err);
      });
  }
}
