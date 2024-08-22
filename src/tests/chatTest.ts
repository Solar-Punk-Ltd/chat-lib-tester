import { Worker } from 'node:worker_threads';
import path from 'path';
import { fileURLToPath } from 'url';
import { BatchId } from '@ethersphere/bee-js';
import { ethers } from 'ethers';
import { MessageInfo, NodeListElement, TestParams, UserInfo, UserThreadMessages } from '../types/types.js';
import { generateID, sleep, RunningAverage } from '../utils/misc.js';

const __filename = fileURLToPath(import.meta.url); // get the resolved path to the file
const __dirname = path.dirname(__filename); // get the name of the directory

import { initChatRoom, startMessageFetchProcess, getChatActions, orderMessages, MessageData, EVENTS, startUserFetchProcess, setBeeUrl, getUserCount, stopMessageFetchProcess, stopUserFetchProcess } from 'swarm-decentralized-chat';

// List of Bee nodes, with stamp
const nodeList: NodeListElement[] = [
    { url: "http://161.97.125.121:1733" , stamp: "1f191134439c1810da0ef41f4decb176b931377f0a66f9eba41a40308a62d8c5" as BatchId },
    { url: "http://195.88.57.155:1633" ,  stamp: "b4fe81362508d9405e8f67f319e3feb715fb7bef7d2bf14dda046e8f9c3aafbc" as BatchId },
    { url: "http://161.97.125.121:1833" , stamp: "f85df6e7a755ac09494696c94e66c8f03f2c8efbe1cb4b607e44ad6df047e8cc" as BatchId },
    { url: "http://161.97.125.121:2033" , stamp: "7093b4457e4443090cb2e8765823a601b3c0165372f8b5bf013cc0f48be4e367" as BatchId }
];

let messages: MessageData[] = [];
let messageAnalyitics: MessageInfo = {};
let userAnalytics: UserInfo = {};
let totalSentCount = 0;
const transmitAvg: RunningAverage = new RunningAverage(1000);


export async function startChatTest(params: TestParams) {
    const topic = `Chat-Library-Test-${Math.floor(Math.random() * 10000)}`;
    const userThreadList: Worker[] = [];

    // Generate a list of private keys, each associated to a user
    const walletList = [];
    for (let i = 0; i < params.userCount; i++) {
        const wallet = ethers.Wallet.createRandom();
        walletList.push(wallet);
    }

    // Create the chat room
    console.info("Creating chat room...");
    setBeeUrl(nodeList[0].url);
    initChatRoom(topic, nodeList[0].stamp);
    console.info("Done!");
    await sleep(5000);

    // This user (on the main thread), will only read messages, and create stats based on that
    startUserFetchProcess(topic);
    startMessageFetchProcess(topic);
    const { on, off } = getChatActions();

    on(EVENTS.RECEIVE_MESSAGE, async (newMessages: MessageData[]) => {
        handleMessageReceive(newMessages, params, userThreadList);
    });

    on(EVENTS.USER_REGISTERED, handleUserRegistered);
    
    // This are the users, who are registering, and writing messages, each has a separate Worker thread
    console.info("Registering users...");
    for (let i = 0; i < walletList.length; i++) {
        console.log("ENTERED LOOP, i is: ", i)
        const nodeIndex = i % nodeList.length;      // This will cycle through nodeList indices
        const userThread = new Worker(path.resolve(__dirname, '../utils/userThread.js'), {
            workerData: {
                topic,
                params,
                address: walletList[i].address,
                privateKey: walletList[i].privateKey,
                node: nodeList[nodeIndex].url,
                stamp: nodeList[nodeIndex].stamp,
                username: `user-${i}`
            },
        });

        userThread.on("message", (messageFromThread) => {
            switch (messageFromThread.type) {
                case UserThreadMessages.INCREMENT_TOTAL_MESSAGE_COUNT:
                    messageAnalyitics[messageFromThread.id] = {
                        sent: messageFromThread.timestamp,
                        received: 0
                    }
                    totalSentCount++;

                    break;

                case UserThreadMessages.USER_REGISTERED:
                    userAnalytics[messageFromThread.username] = {
                        registrationStarted: messageFromThread.timestamp,
                        registrationSuccess: 0,
                        reconnectTimes: [],
                        reconnectCount: 0
                    }
                    break;

                case UserThreadMessages.USER_RECONNECTED:
                    userAnalytics[messageFromThread.username].reconnectTimes.push(messageFromThread.timestamp);
                    userAnalytics[messageFromThread.username].reconnectCount++;

                    break;

                default:
                    console.warn("Received message from user threa, that does not have a known label.");
            }
        });
        
        if (i < walletList.length-1) console.info(`Waiting ${params.registrationInterval} ms until next user registration...`); 
        await sleep(params.registrationInterval);
        userThreadList.push(userThread);
    };
}   

async function handleMessageReceive(newMessages: MessageData[], params: TestParams, userThreadList: Worker[]) {
    const i = newMessages.length-1;
    const id = generateID(newMessages[i]);
    if (!messageAnalyitics[id]) {
        console.warn("WARNING! MESSAGE COULD NOT BE FOUND, THIS IS AN ANOMALY!");
        console.log("It seems like message was received before it was sent, or the ID is wrong.");
        console.log("ID of the message: ", id);
        messageAnalyitics[id] = {
            sent: 0,
            received: Date.now()
        }
        messageAnalyitics[id].received = Date.now();
    } else {
        messageAnalyitics[id].received = Date.now();
    }
    const time = messageAnalyitics[id].received - messageAnalyitics[id].sent;
    transmitAvg.addValue(time);
    console.info("New message: ", newMessages[i]);
    console.info("User count: ", getUserCount());
    console.info(`Transmission time: ${time} ms. Average: ${Math.ceil(transmitAvg.getAverage()/1000)} s`);


    const uniqueNewMessages = newMessages.filter(
        (newMsg) => !messages.some((prevMsg) => prevMsg.timestamp === newMsg.timestamp),
    );
    messages = orderMessages([...messages, ...uniqueNewMessages]);

    console.info("TOTAL RECEIVED / TOTAL SENT: ", `${messages.length} / ${totalSentCount}`);

    if (determineDone(params)) {
        await sleep(10000);
        
        for (let k = 0; k < userThreadList.length; k++) {
            (await userThreadList[k]).terminate();
        }
        stopMessageFetchProcess();
        stopUserFetchProcess();
        await sleep(1000);

        summary();
    }
};

function handleUserRegistered(username: string) {
    if (userAnalytics[username].registrationSuccess) {
        // This is a reconnect
        //userAnalytics[username].reconnectTimes.push(Date.now());
        //userAnalytics[username].reconnectCount
        // here we could also do time-to-go-through calculation, if we would want that statistics as well
        // this way we are only logging that the reconnect happened (see UserThreadMessages.USER_RECONNECTED case in startChatTest)
    } else {
        // This is a register event
        userAnalytics[username].registrationSuccess = Date.now();
    }
}

function determineDone(params: TestParams) {
    const total = params.userCount * params.totalMessageCount;
    return Object.keys(messageAnalyitics).length === total;
}

function summary() {
    const regTimeAvg = new RunningAverage(1000);
    const reconnectCountAvg = new RunningAverage(1000);
    let registrationFailedCount = 0;

    console.info("\n\n\n\n");
    console.info("--SUMMARY--");
    console.info("");
    
    console.info(`Average transmission time: ${Math.ceil(transmitAvg.getAverage()/1000)} s`);
    console.info("TOTAL RECEIVED / TOTAL SENT: ", `${messages.length} / ${totalSentCount}`);
    console.info("");
    
    console.info("User statistics: ");
    for (const [username, stats] of Object.entries(userAnalytics)) {
        const diff = calcTimeDiff(stats.registrationStarted, stats.registrationSuccess);
        if (diff < 0) registrationFailedCount++;
        else regTimeAvg.addValue(diff);
        reconnectCountAvg.addValue(stats.reconnectCount);
        console.info(`${username} registered in ${diff} ms. Reconnect count: ${stats.reconnectCount}`);
    }
    console.info(`Registration time on average:  ${Math.floor(regTimeAvg.getAverage()/1000)} `);
    console.info("Reconnect count on average: ", reconnectCountAvg.getAverage());
    console.info(`Registration failed ${registrationFailedCount} times`);

    console.info("\n")
}

function calcTimeDiff(start: number, end: number) {
    return end-start;
}