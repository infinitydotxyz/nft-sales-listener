import { ChainId } from '@infinityxyz/lib/types/core/ChainId';
import { StakerEventType, TokensUnStakedEvent } from '@infinityxyz/lib/types/core/StakerEvents';
import { trimLowerCase } from '@infinityxyz/lib/utils/formatters';
import { BigNumber, ethers } from 'ethers';
import { BlockProvider } from '../block-provider';
import { InfinityStakerListener } from './infinity-staker.listener.abstract';

export class TokensUnStakedListener extends InfinityStakerListener<TokensUnStakedEvent> {
  public readonly eventName = 'UnStaked';
  protected _eventFilter: ethers.EventFilter;

  constructor(contract: ethers.Contract, blockProvider: BlockProvider, chainId: ChainId) {
    super(contract, blockProvider, chainId);
    this._eventFilter = contract.filters.UnStaked();
  }

  async decodeLog(args: ethers.Event[]): Promise<TokensUnStakedEvent | null> {
    if (!args?.length || !Array.isArray(args) || !args[args.length - 1]) {
      return null;
    }
    const event: ethers.Event = args[args.length - 1];
    const eventData = event.args;
    if (eventData?.length !== 2) {
      return null;
    }

    const user = trimLowerCase(String(eventData[0]));
    const amount = BigNumber.from(String(eventData[1])).toString();
    const block = await this._blockProvider.getBlock(event.blockNumber);
    const userPower = await this.getUserStakePower(user, event.blockNumber);
    const userStake = await this.getUserStakeInfo(user, event.blockNumber);
    return {
      discriminator: StakerEventType.UnStaked,
      user,
      amount,
      stakerContractAddress: this._contract.address,
      chainId: this.chainId,
      blockNumber: event.blockNumber,
      txHash: event.transactionHash,
      timestamp: block.timestamp * 1000,
      stakeInfo: userStake,
      stakePower: userPower,
      isAggregated: false
    };
  }
}
