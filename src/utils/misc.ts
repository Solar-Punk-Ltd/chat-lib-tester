import { MessageData } from "swarm-decentralized-chat";

// General sleep function, usage: await sleep(ms)
export function sleep(delay: number) {
    return new Promise((resolve) => {
        setTimeout(resolve, delay);
    });
}

export function generateID(message: MessageData): string {
    return message.address + message.timestamp;
}

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