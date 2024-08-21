import { BatchId } from "@ethersphere/bee-js";

export enum UserThreadMessages {
    "INCREMENT_TOTAL_MESSAGE_COUNT"
}

type Timestamp = number;

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

export type MessageInfo = Record<
    string, { 
        sent: Timestamp; 
        received: Timestamp 
    }
>;