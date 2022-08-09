import { ChainId } from '@infinityxyz/lib/types/core/ChainId';
import { ethers } from 'ethers';
import { Firebase } from '../../database/Firebase';
import { BlockProvider } from '../block-provider';
import { RageQuitListener } from '../contract-listeners/tokens-rage-quit.listener';
import { TokensStakedListener } from '../contract-listeners/tokens-staked.listener';
import { TokensUnStakedListener } from '../contract-listeners/tokens-unstaked.listener';
import { EventHandler } from '../event-handlers/types';
import { DbSyncedContract } from './db-synced-contract.abstract';
import { Contracts } from './types';
import { InfinityStakerABI } from '@infinityxyz/lib/abi/infinityStaker';
import { ContractListenerEvent } from '../contract-listeners/contract-listener.abstract';

export type InfinityStakerEventListener = TokensStakedListener | TokensUnStakedListener | RageQuitListener;

export type InfinityStakerEventListenerConstructor =
  | typeof TokensStakedListener
  | typeof TokensUnStakedListener
  | typeof RageQuitListener;

export class InfinityStakerContract extends DbSyncedContract {
  static readonly listenerConstructors = [TokensUnStakedListener, TokensStakedListener];

  static discriminator: Contracts = Contracts.InfinityStaker;

  protected _listeners: InfinityStakerEventListener[] = [];

  constructor(
    provider: ethers.providers.StaticJsonRpcProvider,
    address: string,
    blockProvider: BlockProvider,
    listeners: InfinityStakerEventListenerConstructor[],
    chainId: ChainId,
    firebase: Firebase,
    private _handler: EventHandler
  ) {
    super(address, provider, InfinityStakerABI, blockProvider, chainId, firebase);

    for (const listener of listeners) {
      this._listeners.push(new listener(this.contract, this.blockProvider, chainId));
    }
  }

  protected registerListeners(event: ContractListenerEvent) {
    const cancelers = this._listeners.map((contractListener) => {
      if (contractListener instanceof TokensStakedListener) {
        return contractListener.on(event, (stakedEvent) => {
          this._handler.tokensStakedEvent(stakedEvent).catch((err) => {
            console.error(err);
          });
        });
      } else if (contractListener instanceof TokensUnStakedListener) {
        return contractListener.on(event, (unStakedEvent) => {
          this._handler.tokensUnStakedEvent(unStakedEvent).catch((err) => {
            console.error(err);
          });
        });
      } else if (contractListener instanceof RageQuitListener) {
        return contractListener.on(event, (rageQuitEvent) => {
          this._handler.tokensRageQuitEvent(rageQuitEvent).catch((err) => {
            console.error(err);
          });
        });
      } else {
        throw new Error('Unknown contract listener');
      }
    });

    return () => {
      cancelers.forEach((cancel) => cancel());
    };
  }
}
