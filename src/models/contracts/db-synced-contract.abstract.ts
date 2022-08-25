import { ChainId } from '@infinityxyz/lib/types/core/ChainId';
import { firestoreConstants, trimLowerCase } from '@infinityxyz/lib/utils';
import { Firebase } from '../../database/Firebase';
import { ethers } from 'ethers';
import { ContractListener, ContractListenerEvent } from '../contract-listeners/contract-listener.abstract';
import { BlockProvider } from '../block-provider';
import { Contract } from './contract.abstract';

interface DbSyncedContractData {
  updatedAt: number;
  events: {
    [eventName: string]: DbSyncedContractEvent;
  };
}
export interface DbSyncedContractEvent {
  firstBlock: number;
  lastBlockUpdated: number;
  updatedAt: number;
}

export abstract class DbSyncedContract extends Contract {
  protected abstract _listeners: ContractListener<any, any>[];
  protected abstract registerListeners(event: ContractListenerEvent): () => void;

  constructor(
    address: string,
    provider: ethers.providers.StaticJsonRpcProvider,
    abi: ethers.ContractInterface,
    blockProvider: BlockProvider,
    chainId: ChainId,
    private firebase: Firebase,
    numBlocksToBackfill?: number
  ) {
    super(address, provider, abi, blockProvider, chainId, numBlocksToBackfill);
  }

  public async sync() {
    /**
     * start listening for events
     */
    const off = this.registerListeners(ContractListenerEvent.EventOccurred);
    this._listeners.map((item) => item.start());

    /**
     * start backfilling
     */
    await this._startBackfill();
    const intervalOff = await this._scheduleIntervalUpdates();

    this._off = () => {
      this._listeners.map((item) => item.stop());
      off();
      intervalOff();
    };
  }

  protected async _startBackfill() {
    const contractData = await this.getContractData();
    const events = contractData?.events ?? {};

    const results = await this.backfill(events);
    const updatedContractData = results.reduce(
      (acc, item) => {
        const event: DbSyncedContractEvent = {
          firstBlock: acc.events?.[item.name]?.firstBlock ?? item.fromBlock,
          lastBlockUpdated: item.highestBlockReached,
          updatedAt: Date.now()
        };
        return {
          ...acc,
          events: {
            ...acc.events,
            [item.name]: event
          }
        };
      },
      { updatedAt: Date.now(), events } as DbSyncedContractData
    );

    await this.updateContractData(updatedContractData);
  }

  protected async _scheduleIntervalUpdates() {
    const contractData = (await this.getContractData()) || {
      updatedAt: Date.now(),
      events: {}
    };
    const handler = (listener: ContractListener<any, any>, blockNumber: number) => {
      const firstBlock = contractData.events[listener.eventName]?.firstBlock ?? blockNumber;
      let lastBlockUpdated = contractData.events[listener.eventName]?.lastBlockUpdated;
      if (!lastBlockUpdated || lastBlockUpdated < blockNumber) {
        lastBlockUpdated = blockNumber;
      }

      const event: DbSyncedContractEvent = {
        firstBlock,
        lastBlockUpdated,
        updatedAt: Date.now()
      };
      contractData.events[listener.eventName] = event;
    };

    const offs = this._listeners.map((listener) => {
      const listenerHandler = (event: { blockNumber: number }) => {
        handler(listener, event.blockNumber);
      };
      const off = listener.on(ContractListenerEvent.EventOccurred, listenerHandler);
      return off;
    });

    const interval = setInterval(() => {
      contractData.updatedAt = Date.now();
      this.updateContractData(contractData).catch(console.error);
    }, 60 * 1000 * 3);

    return () => {
      offs.map((off) => off());
      clearInterval(interval);
    };
  }

  protected get contractRef() {
    const address = this.contract.address;
    const docId = trimLowerCase(`${this.chainId}:${address}`);
    const contractDocRef = this.firebase.db.collection(firestoreConstants.CONTRACT_EVENTS).doc(docId);
    return contractDocRef;
  }

  protected async getContractData() {
    const contractDoc = await this.contractRef.get();
    const dbSyncedContract = contractDoc.data() as DbSyncedContractData | undefined;
    return dbSyncedContract ?? null;
  }

  protected async updateContractData(data: Partial<DbSyncedContractData>) {
    await this.contractRef.set(data, { merge: true });
  }
}
