"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.execute = void 0;
const sales_listener_controller_1 = require("./controllers/sales-listener.controller");
const chalk_1 = __importDefault(require("chalk"));
const container_1 = require("../src/container");
const execute = () => {
    container_1.logger.log(chalk_1.default.blue('---  Running Opensea Sales Scraper ----'));
    (0, sales_listener_controller_1.execute)();
};
exports.execute = execute;
//# sourceMappingURL=index.js.map