import { BatchId } from "@ethersphere/bee-js";

export enum UserThreadMessages {
    "INCREMENT_TOTAL_MESSAGE_COUNT",
    "USER_REGISTERED",
    "USER_RECONNECTED",
    "HASH_RECEIVED",
    "ERROR"
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
    filename: string;
}

export type MessageInfo = Record<
    string, { 
        sent: Timestamp; 
        received: Timestamp 
    }
>;

export type UserInfo = Record<
    string, {
        registrationStarted: Timestamp;
        registrationSuccess: Timestamp;
        reconnectTimes: Timestamp[];
        reconnectCount: number;
    }
>

// just for debugging
export type FeedCommitHashList = Record<
    string, {
        count: number
    }
>