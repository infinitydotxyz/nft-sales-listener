import axios, { AxiosError } from 'axios';

export const DEV_COLLECTION_SERVICE_URL = 'https://nft-collection-service-dot-nftc-dev.ue.r.appspot.com/collection';
export const PROD_COLLECTION_SERVICE_URL = ''; // TODO adi add this once deployed to prod

export enum ResponseType {
  IndexingInitiated = 'INDEXING_INITIATED',
  AlreadyQueued = 'INDEXING_ALREADY_INITIATED',
  BadRequest = 'BAD_REQUEST',
  ServerError = 'SERVER_ERROR',
  UnknownError = 'UNKNOWN_ERROR'
}

function getResponseType(status: number): ResponseType {
  switch (status) {
    case 202:
      return ResponseType.IndexingInitiated;
    case 200:
      return ResponseType.AlreadyQueued;
    case 400:
      return ResponseType.BadRequest;
    case 500:
      return ResponseType.ServerError;
    default:
      return ResponseType.UnknownError;
  }
}

export async function enqueueCollection(
  collection: { chainId: string; address: string; indexInitiator?: string },
  queue: { env: 'prod' | 'dev' } | { url: string }
): Promise<ResponseType> {
  let url = '';
  if ('env' in queue) {
    url = queue.env === 'dev' ? DEV_COLLECTION_SERVICE_URL : PROD_COLLECTION_SERVICE_URL;
  } else {
    url = queue.url;
  }

  try {
    url = 'http://localhost:8080/collection';
    const res = await axios.post(
      url,
      {
        chainId: collection.chainId,
        address: collection.address,
        indexInitiator: collection.indexInitiator
      },
      {
        headers: {
          'content-type': 'application/json'
        }
      }
    );

    const response = getResponseType(res.status);

    return response;
  } catch (err: AxiosError | any) {
    if (axios.isAxiosError(err)) {
      if (err.response?.status && typeof err.response.status === 'number') {
        const response = getResponseType(err.response.status);
        return response;
      } else {
        throw err;
      }
    }
    throw err;
  }
}
