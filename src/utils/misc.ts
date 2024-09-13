import { MessageData } from "swarm-decentralized-chat";
import { MessageInfo, TestParams } from "../types/types.js";
import logger from "./logger.js";

// General sleep function, usage: await sleep(ms)
export function sleep(delay: number) {
    return new Promise((resolve) => {
        setTimeout(resolve, delay);
    });
}

// Each message has an ID
export function generateID(message: MessageData): string {
    return message.address + message.timestamp;
}

// A class for handling averages, constructor accepts a max value (array length)
export class RunningAverage {
    private maxSize: number;
    private values: number[];
    private sum: number;
  
    constructor(maxSize: number) {
        this.maxSize = maxSize;
        this.values = [];
        this.sum = 0;
    }
  
    addValue(newValue: number) {
        if (this.values.length === this.maxSize) {
            const removedValue = this.values.shift();
            if (removedValue !== undefined) {
                this.sum -= removedValue;
            }
        }
  
        this.values.push(newValue);
        this.sum += newValue;
    }
  
    getAverage() {
        if (this.values.length === 0) {
            return 200;
        }
        return this.sum / this.values.length;
    }
}

export function calcTimeDiff(start: number, end: number) {
    return end-start;
}

// Determine if the test is finished or not
export function determineDone(params: TestParams, startTime: number, messageAnalyitics: MessageInfo) {
    const total = params.userCount * params.totalMessageCount;
    const currentTime = Date.now();

    const totalRegistrationTime = (params.userCount - 1) * params.registrationInterval;
    const totalMessageTimePerUser = (params.totalMessageCount - 1) * params.messageFrequency;
    const totalExpectedTime = totalRegistrationTime + totalMessageTimePerUser;
    logger.info(`Time left (max):  ${Math.floor(((startTime + totalExpectedTime + 180 * 1000) - currentTime)/1000)} s`);

    if (currentTime > startTime + totalExpectedTime + 120 * 1000) {
        return true;        // Process is running for more than expected time + 2 minutes
    }

    return Object.keys(messageAnalyitics).length === total;
}

// Thousand separator
export function formatWithSpaces(x: number): string {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}