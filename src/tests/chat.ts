import { Worker } from 'node:worker_threads';
import path from 'path';
import { fileURLToPath } from 'url';
import { BatchId } from '@ethersphere/bee-js';
import { ethers } from 'ethers';
import { MessageInfo, NodeListElement, TestParams, UserThreadMessages } from '../types/types.js';
import { generateID, sleep, RunningAverage } from '../utils/misc.js';

const __filename = fileURLToPath(import.meta.url); // get the resolved path to the file
const __dirname = path.dirname(__filename); // get the name of the directory

import { initChatRoom, startMessageFetchProcess, getChatActions, orderMessages, MessageData, EVENTS, startUserFetchProcess } from 'swarm-decentralized-chat';

// List of Bee nodes, with stamp
const nodeList: NodeListElement[] = [
    { url: "http://195.88.57.155:1633" , stamp: "4c2ad0d140559eb644f96f61dc8e1ded8e0e34378fcc1738fd8cf2c2d6d83784" as BatchId }
];
let messages: MessageData[] = [];
let messageAnalyitics: MessageInfo = {};
let totalSentCount = 0;
const transmitAvg: RunningAverage = new RunningAverage(1000);


export async function startChatTest(params: TestParams) {
    const topic = `Chat-Library-Test-${Math.floor(Math.random() * 10000)}`;

    // Generate a list of private keys, each associated to a user
    const walletList = [];
    for (let i = 0; i < params.userCount; i++) {
        const wallet = ethers.Wallet.createRandom();
        walletList.push(wallet);
    }

    // Create the chat room
    console.info("Creating chat room...");
    initChatRoom(topic, nodeList[0].stamp);
    console.info("Done!");
    await sleep(5000);
    
    console.info("Registering users...");
    const userThreadList = walletList.map(async (wallet, i) => {
        const userThread = new Worker(path.resolve(__dirname, '../utils/userThread.js'), {
            workerData: {
                topic,
                params,
                address: wallet.address,
                privateKey: wallet.privateKey,
                stamp: nodeList[0].stamp,           // Later this should be dynamic if we want to test with multiple nodes
                username: `user-${i}`
            },
        });

        userThread.on("message", (messageFromThread) => {
            if (messageFromThread.type === UserThreadMessages.INCREMENT_TOTAL_MESSAGE_COUNT) {
                messageAnalyitics[messageFromThread.id] = {
                    sent: messageFromThread.timestamp,
                    received: 0
                }
                
                totalSentCount++;
            }
        });
        
        await sleep(params.registrationInterval);
        return userThread;
    });

    startUserFetchProcess(topic);
    startMessageFetchProcess(topic);
    const { on, off } = getChatActions();

    on(EVENTS.RECEIVE_MESSAGE, handleMessageReceive);

    console.log("--SUMMARY--")
}   

const handleMessageReceive = (newMessages: MessageData[]) => {
    const i = newMessages.length-1;
    const id = generateID(newMessages[i]);
    messageAnalyitics[id].received = Date.now();
    const time = messageAnalyitics[id].received - messageAnalyitics[id].sent;
    transmitAvg.addValue(time);
    console.info("New message: ", newMessages[i]);
    console.info(`Transmission time: ${time} ms. Average: ${Math.ceil(transmitAvg.getAverage()/1000)} s`);


    const uniqueNewMessages = newMessages.filter(
        (newMsg) => !messages.some((prevMsg) => prevMsg.timestamp === newMsg.timestamp),
    );
    messages = orderMessages([...messages, ...uniqueNewMessages]);

    console.info("TOTAL RECEIVED / TOTAL SENT: ", `${messages.length} / ${totalSentCount}`)
};