import { CacheError, CancelError, MaxRedirectsError, ParseError, ReadError, RequestError, TimeoutError, UploadError } from 'got';
export declare type GotError = RequestError | CacheError | ReadError | ParseError | UploadError | MaxRedirectsError | TimeoutError | CancelError;
export declare function isGotError(error: GotError | unknown): boolean;
export declare function gotErrorHandler(error: GotError | unknown): {
    retry: true;
    delay: number;
} | {
    fatal: boolean;
};
