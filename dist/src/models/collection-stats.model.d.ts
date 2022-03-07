import { NftSalesRepository } from '../types';
import { CollectionStats } from '../services/OpenSea';
declare const CollectionStatsModel: {
    handleOrders: (orders: NftSalesRepository[], totalPrice: number, chainId?: string) => Promise<void>;
    initStatsFromOS: (cs: CollectionStats, collectionAddress: string, chainId?: string) => Promise<FirebaseFirestore.WriteResult[]>;
};
export default CollectionStatsModel;
