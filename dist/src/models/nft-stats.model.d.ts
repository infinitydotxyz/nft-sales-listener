import { NftSalesRepository } from '../types';
declare const NftStatsModel: {
    handleOrders: (orders: NftSalesRepository[], totalPrice: number, chainId?: string) => Promise<void>;
};
export default NftStatsModel;
