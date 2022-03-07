"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
/* eslint-disable no-console */
const constants_1 = require("../constants");
const tsyringe_1 = require("tsyringe");
const worker_threads_1 = require("worker_threads");
let Logger = class Logger {
    constructor() {
        this.registerProcessListeners();
    }
    log(message, ...optionalParams) {
        if (constants_1.INFO_LOG) {
            if (optionalParams.length > 0) {
                console.log(message, optionalParams);
            }
            else {
                console.log(message);
            }
        }
    }
    error(message, ...optionalParams) {
        if (constants_1.ERROR_LOG) {
            if (optionalParams.length > 0) {
                console.error(message, optionalParams);
            }
            else {
                console.error(message);
            }
        }
    }
    registerProcessListeners() {
        process.on('uncaughtException', (error, origin) => {
            this.error('Uncaught exception', error, origin);
        });
        process.on('unhandledRejection', (reason) => {
            this.error('Unhandled rejection', reason);
        });
        process.on('exit', (code) => {
            if (worker_threads_1.isMainThread) {
                this.log(`Process exiting... Code: ${code}`);
            }
        });
    }
};
Logger = __decorate([
    (0, tsyringe_1.singleton)(),
    __metadata("design:paramtypes", [])
], Logger);
exports.default = Logger;
//# sourceMappingURL=Logger.js.map