import { BatchId } from "@ethersphere/bee-js";

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