import { StakeDuration } from '@infinityxyz/lib/types/core';
import { ChainId } from '@infinityxyz/lib/types/core/ChainId';
import { StakeInfo } from '@infinityxyz/lib/types/core/StakerEvents';
import { BigNumber, BigNumberish, ethers } from 'ethers';
import { BlockProvider } from '../block-provider';
import { ContractListener, Events } from './contract-listener.abstract';

export abstract class InfinityStakerListener<T extends { blockNumber: number }> extends ContractListener<T, Events<T>> {
  public abstract readonly eventName: string;
  protected abstract _eventFilter: ethers.EventFilter;

  constructor(contract: ethers.Contract, blockProvider: BlockProvider, chainId: ChainId) {
    super(contract, blockProvider, chainId);
  }

  public abstract decodeLog(args: ethers.Event[]): T | Promise<T | null> | null;

  async getUserStakePower(user: string, blockNumber: number): Promise<number> {
    const [userStakePower] = (await this._contract.functions.getUserStakePower(user, {
      blockTag: blockNumber
    })) as [BigNumberish];
    return BigNumber.from(userStakePower).toNumber();
  }

  async getUserStakeInfo(user: string, blockNumber: number): Promise<StakeInfo> {
    const [res] = await this._contract.functions.getStakingInfo(user, { blockTag: blockNumber });
    const [x0, x3, x6, x12] = res;
    const [x0Amount, x0Timestamp] = x0;
    const [x3Amount, x3Timestamp] = x3;
    const [x6Amount, x6Timestamp] = x6;
    const [x12Amount, x12Timestamp] = x12;

    const stakeInfo: StakeInfo = {
      [StakeDuration.X0]: {
        amount: BigNumber.from(x0Amount).toString(),
        timestamp: BigNumber.from(x0Timestamp).toNumber() * 1000
      },
      [StakeDuration.X3]: {
        amount: BigNumber.from(x3Amount).toString(),
        timestamp: BigNumber.from(x3Timestamp).toNumber() * 1000
      },
      [StakeDuration.X6]: {
        amount: BigNumber.from(x6Amount).toString(),
        timestamp: BigNumber.from(x6Timestamp).toNumber() * 1000
      },
      [StakeDuration.X12]: {
        amount: BigNumber.from(x12Amount).toString(),
        timestamp: BigNumber.from(x12Timestamp).toNumber() * 1000
      }
    };
    return stakeInfo;
  }
}
