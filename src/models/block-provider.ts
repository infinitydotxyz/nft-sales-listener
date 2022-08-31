import { Block } from '@ethersproject/abstract-provider';
import { ethers } from 'ethers';
import QuickLRU from 'quick-lru';

export class BlockProvider {
  private blockCache: QuickLRU<number, Block>;

  constructor(maxSize: number, private provider: ethers.providers.StaticJsonRpcProvider) {
    this.blockCache = new QuickLRU({
      maxSize: maxSize
    });
  }

  public async getBlock(blockNumber: number): Promise<Block> {
    let block = this.blockCache.get(blockNumber);
    if (!block) {
      block = await this.provider.getBlock(blockNumber);
      this.blockCache.set(blockNumber, block);
    }
    return block;
  }
}
