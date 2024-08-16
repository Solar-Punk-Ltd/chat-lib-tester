import { BatchId } from "@ethersphere/bee-js";

export enum UserThreadMessages {
    "INCREMENT_TOTAL_MESSAGE_COUNT"
}

export interface NodeListElement {
    url: string;
    stamp: BatchId
}

export interface TestParams {
    userCount: number;
    messageFrequency: number;
    registrationInterval: number;
    totalMessageCount: number;
}