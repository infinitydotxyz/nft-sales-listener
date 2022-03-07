"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.moralis = exports.firebase = exports.providers = exports.logger = void 0;
const tsyringe_1 = require("tsyringe");
const Firebase_1 = __importDefault(require("../src/database/Firebase"));
const Moralis_1 = __importDefault(require("../src/services/Moralis"));
const Logger_1 = __importDefault(require("../src/utils/Logger"));
const Providers_1 = __importDefault(require("../src/models/Providers"));
exports.logger = tsyringe_1.container.resolve(Logger_1.default);
exports.providers = tsyringe_1.container.resolve(Providers_1.default);
exports.firebase = tsyringe_1.container.resolve(Firebase_1.default);
exports.moralis = tsyringe_1.container.resolve(Moralis_1.default);
//# sourceMappingURL=container.js.map