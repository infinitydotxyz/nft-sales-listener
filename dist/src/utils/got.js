"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.gotErrorHandler = exports.isGotError = void 0;
const got_1 = require("got");
function isGotError(error) {
    return (error instanceof got_1.CacheError ||
        error instanceof got_1.ReadError ||
        error instanceof got_1.RequestError ||
        error instanceof got_1.ParseError ||
        error instanceof got_1.UploadError ||
        error instanceof got_1.MaxRedirectsError ||
        error instanceof got_1.TimeoutError ||
        error instanceof got_1.CancelError);
}
exports.isGotError = isGotError;
const fatal = [got_1.CancelError];
function gotErrorHandler(error) {
    if (isGotError(error)) {
        for (const fatalErrorType of fatal) {
            if (error instanceof fatalErrorType) {
                return { fatal: true };
            }
        }
        return { retry: true, delay: 1000 };
    }
    return { fatal: false };
}
exports.gotErrorHandler = gotErrorHandler;
//# sourceMappingURL=got.js.map