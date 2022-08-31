import { ChainId } from '@infinityxyz/lib/types/core/ChainId';
import { StakeDuration } from '@infinityxyz/lib/types/core/StakeDuration';
import { StakerEventType, TokensStakedEvent } from '@infinityxyz/lib/types/core/StakerEvents';
import { getStakePowerPerToken, getTokenAddressByStakerAddress, trimLowerCase } from '@infinityxyz/lib/utils';
import { BigNumber, ethers } from 'ethers';
import { BlockProvider } from '../block-provider';
import { InfinityStakerListener } from './infinity-staker.listener.abstract';

const contractStakeDurationToEnum: Record<number, StakeDuration> = {
  [0]: StakeDuration.None,
  [1]: StakeDuration.ThreeMonths,
  [2]: StakeDuration.SixMonths,
  [3]: StakeDuration.TwelveMonths
};

export class TokensStakedListener extends InfinityStakerListener<TokensStakedEvent> {
  public readonly eventName = 'Staked';
  protected _eventFilter: ethers.EventFilter;

  constructor(contract: ethers.Contract, blockProvider: BlockProvider, chainId: ChainId) {
    super(contract, blockProvider, chainId);
    this._eventFilter = contract.filters.Staked();
  }

  async decodeLog(args: ethers.Event[]): Promise<TokensStakedEvent | null> {
    if (!args?.length || !Array.isArray(args) || !args[args.length - 1]) {
      return null;
    }
    const event: ethers.Event = args[args.length - 1];
    const eventData = event.args;
    if (eventData?.length !== 3) {
      return null;
    }

    const user = trimLowerCase(String(eventData[0]));
    const amount = BigNumber.from(String(eventData[1])).toString();
    const eventDuration = parseInt(String(eventData[2]));
    const duration = contractStakeDurationToEnum[eventDuration] ?? null;
    if (duration == null) {
      console.warn(`Unknown duration: ${eventDuration}`);
      return null;
    }
    const block = await this._blockProvider.getBlock(event.blockNumber);
    const userPower = await this.getUserStakePower(user, event.blockNumber);
    const userStake = await this.getUserStakeInfo(user, event.blockNumber);
    const { tokenContractAddress, tokenContractChainId } = getTokenAddressByStakerAddress(
      this.chainId,
      this._contract.address
    );
    return {
      discriminator: StakerEventType.Staked,
      user,
      amount,
      duration,
      stakerContractAddress: this._contract.address,
      stakerContractChainId: this.chainId,
      blockNumber: event.blockNumber,
      txHash: event.transactionHash,
      timestamp: block.timestamp * 1000,
      stakeInfo: userStake,
      stakePower: userPower,
      processed: false,
      updatedAt: Date.now(),
      tokenContractAddress,
      tokenContractChainId,
      stakePowerPerToken: getStakePowerPerToken(userStake, userPower)
    };
  }
}
