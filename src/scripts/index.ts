import { Firebase } from '../database/Firebase';

async function main() {
  const firebase = new Firebase();
  const db = firebase.db;
  const query = db.collection('sales').where('source', '==', 'INFINITY').limit(500);

  await deleteQueryBatch(db, query);
}

async function deleteQueryBatch(
  db: FirebaseFirestore.Firestore,
  query: FirebaseFirestore.Query<FirebaseFirestore.DocumentData>
) {
  const snapshot = await query.get();

  const batchSize = snapshot.size;
  if (batchSize === 0) {
    // When there are no documents left, we are done
    return;
  }

  // Delete documents in a batch
  const batch = db.batch();
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });
  await batch.commit();

  // Recurse on the next process tick, to avoid
  // exploding the stack.
  process.nextTick(async () => {
    await deleteQueryBatch(db, query);
  });
}

void main();
