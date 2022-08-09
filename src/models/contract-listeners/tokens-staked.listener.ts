import { ChainId } from '@infinityxyz/lib/types/core/ChainId';
import { trimLowerCase } from '@infinityxyz/lib/utils';
import { BigNumber, ethers } from 'ethers';
import { StakeDuration, StakerEventType, TokensStakedEvent } from '../../types';
import { BlockProvider } from '../block-provider';
import { ContractListener, Events } from './contract-listener.abstract';

const contractStakeDurationToEnum: Record<number, StakeDuration> = {
  [0]: StakeDuration.None,
  [1]: StakeDuration.ThreeMonths,
  [2]: StakeDuration.SixMonths,
  [3]: StakeDuration.TwelveMonths
};

export class TokensStakedListener extends ContractListener<TokensStakedEvent, Events<TokensStakedEvent>> {
  public readonly eventName = 'Staked';
  protected _eventFilter: ethers.EventFilter;

  constructor(contract: ethers.Contract, blockProvider: BlockProvider, chainId: ChainId) {
    super(contract, blockProvider, chainId);
    this._eventFilter = contract.filters.Staked();
  }

  decodeLog(args: ethers.Event[]): TokensStakedEvent | null {
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
    return {
      discriminator: StakerEventType.Staked,
      user,
      amount,
      duration,
      stakerContractAddress: this._contract.address,
      chainId: this.chainId,
      blockNumber: event.blockNumber,
      txHash: event.transactionHash
    };
  }
}
