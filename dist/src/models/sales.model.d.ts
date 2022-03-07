import { NftSalesRepository } from '../types';
declare const SalesModel: {
    handleOrders: (orders: NftSalesRepository[], chainId?: string) => Promise<FirebaseFirestore.WriteResult[]>;
};
export default SalesModel;
