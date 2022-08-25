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
    receiptPromise = this._getReceipt(txHash);
    this._cache.set(txHash, receiptPromise);
    return receiptPromise;
  }

  private async _getReceipt(txHash: string): Promise<ethers.providers.TransactionReceipt> {
    for (let attempt = 0; ; attempt += 1) {
      try {
        const result = await this.provider.getTransactionReceipt(txHash);
        if (!result) {
          throw new Error('No receipt found');
        }
        return result;
      } catch (err) {
        if (attempt > 3) {
          throw err;
        }
      }
    }
  }
}
