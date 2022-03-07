/// <reference types="node" />
import firebaseAdmin from 'firebase-admin';
import { Bucket, File } from '@google-cloud/storage';
import { Readable } from 'stream';
export default class Firebase {
    db: FirebaseFirestore.Firestore;
    firebaseAdmin: firebaseAdmin.app.App;
    bucket: Bucket;
    constructor();
    getCollectionDocRef(chainId: string, address: string): FirebaseFirestore.DocumentReference<FirebaseFirestore.DocumentData>;
    getTokensCollectionRef(chainId: string, address: string): FirebaseFirestore.CollectionReference<FirebaseFirestore.DocumentData>;
    getTokenDocRef(chainId: string, address: string, tokenId: string): FirebaseFirestore.DocumentReference<FirebaseFirestore.DocumentData>;
    uploadReadable(readable: Readable, path: string, contentType: string): Promise<File>;
    uploadBuffer(buffer: Buffer, path: string, contentType: string): Promise<File>;
}
