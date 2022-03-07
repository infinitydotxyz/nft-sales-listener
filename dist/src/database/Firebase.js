"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const tsyringe_1 = require("tsyringe");
const firebase_admin_1 = __importDefault(require("firebase-admin"));
const constants_1 = require("../constants");
const stream_1 = require("stream");
const fs_1 = require("fs");
const path_1 = require("path");
let Firebase = class Firebase {
    constructor() {
        const serviceAccountFile = (0, path_1.resolve)(`./creds/${constants_1.FIREBASE_SERVICE_ACCOUNT}`);
        const serviceAccount = JSON.parse((0, fs_1.readFileSync)(serviceAccountFile, 'utf-8'));
        const app = firebase_admin_1.default.initializeApp({
            credential: firebase_admin_1.default.credential.cert(serviceAccount),
            storageBucket: constants_1.FB_STORAGE_BUCKET
        });
        this.firebaseAdmin = app;
        this.db = firebase_admin_1.default.firestore();
        this.db.settings({ ignoreUndefinedProperties: true });
        this.bucket = firebase_admin_1.default.storage().bucket();
    }
    getCollectionDocRef(chainId, address) {
        const collectionDoc = this.db.collection('collections').doc(`${chainId}:${address.toLowerCase()}`);
        return collectionDoc;
    }
    getTokensCollectionRef(chainId, address) {
        const collectionDoc = this.getCollectionDocRef(chainId, address);
        const nftsCollection = collectionDoc.collection('nfts');
        return nftsCollection;
    }
    getTokenDocRef(chainId, address, tokenId) {
        const tokensCollectionRef = this.getTokensCollectionRef(chainId, address);
        return tokensCollectionRef.doc(tokenId);
    }
    uploadReadable(readable, path, contentType) {
        return __awaiter(this, void 0, void 0, function* () {
            let attempts = 0;
            while (true) {
                attempts += 1;
                try {
                    let remoteFile = this.bucket.file(path);
                    const existsArray = yield remoteFile.exists();
                    if (existsArray && existsArray.length > 0 && !existsArray[0]) {
                        remoteFile = yield new Promise((resolve, reject) => {
                            readable.pipe(remoteFile
                                .createWriteStream({
                                metadata: {
                                    contentType
                                }
                            })
                                .on('error', (err) => {
                                reject(err);
                            })
                                .on('finish', () => {
                                // logger.log(`uploaded: ${remoteFile.name}`);
                                resolve(remoteFile);
                            }));
                        });
                        return remoteFile;
                    }
                    return remoteFile;
                }
                catch (err) {
                    if (attempts > 3) {
                        throw err;
                    }
                }
            }
        });
    }
    uploadBuffer(buffer, path, contentType) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.uploadReadable(stream_1.Readable.from(buffer), path, contentType);
        });
    }
};
Firebase = __decorate([
    (0, tsyringe_1.singleton)(),
    __metadata("design:paramtypes", [])
], Firebase);
exports.default = Firebase;
//# sourceMappingURL=Firebase.js.map