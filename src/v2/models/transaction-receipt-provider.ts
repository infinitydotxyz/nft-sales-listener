import { ethers } from 'ethers';
import QuickLRU from 'quick-lru';

export class TransactionReceiptProvider {
  private _cache: QuickLRU<string, Promise<ethers.providers.TransactionReceipt>>;

  constructor(maxSize: number, private provider: ethers.providers.StaticJsonRpcProvider) {
    this._cache = new QuickLRU({
      maxSize: maxSize
    });
  }

  public async getReceipt(txHash: string): Promise<ethers.providers.TransactionReceipt> {
    let receiptPromise = this._cache.get(txHash);
    if (receiptPromise) {
      return await receiptPromise;
    }
    receiptPromise = this.provider.getTransactionReceipt(txHash);
    this._cache.set(txHash, receiptPromise);
    return receiptPromise;
  }
}
