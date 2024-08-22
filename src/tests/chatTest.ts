import { Worker } from 'node:worker_threads';
import path from 'path';
import { fileURLToPath } from 'url';
import { BatchId } from '@ethersphere/bee-js';
import { ethers } from 'ethers';

import { 
    initChatRoom,
    startMessageFetchProcess,
    getChatActions,
    orderMessages,
    MessageData,
    EVENTS,
    startUserFetchProcess,
    setBeeUrl,
    getUserCount,
    stopMessageFetchProcess,
    stopUserFetchProcess
} from 'swarm-decentralized-chat';

import { FeedCommitHashList, MessageInfo, NodeListElement, TestParams, UserInfo, UserThreadMessages } from '../types/types.js';
import { generateID, sleep, RunningAverage, determineDone } from '../utils/misc.js';
import { summary, writeNodeInfoToFile } from '../utils/info.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


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
let startTime = 0;
let intervalId: NodeJS.Timeout | null = null;                          // Interval to check whether the process is finished or not (if not all messages can be sent)
let totalSentCount = 0;
let feedCommitHashList: FeedCommitHashList = {};
const transmitAvg: RunningAverage = new RunningAverage(1000);
let messageIdAnomaly = 0;
let timestampAnomaly = 0;
let isDone = false;


// The main chat test, currently this is the only one, but probably there will be more
export async function startChatTest(params: TestParams) {
    const topic = `Chat-Library-Test-${Math.floor(Math.random() * 10000)}`;
    const userThreadList: Worker[] = [];

    writeNodeInfoToFile(params.filename, nodeList);

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
    startTime = Date.now();
    console.info(`Done! Now will wait ${params.registrationInterval} ms before starting registration. \n`);
    await sleep(params.registrationInterval);

    // This user (on the main thread), will only read messages, and create stats based on that
    startUserFetchProcess(topic);
    startMessageFetchProcess(topic);
    const { on } = getChatActions();

    // Some analytics is happening in handle-functions
    on(EVENTS.RECEIVE_MESSAGE, async (newMessages: MessageData[]) => {
        handleMessageReceive(newMessages, params, userThreadList);
    });
    on(EVENTS.USER_REGISTERED, handleUserRegistered);

    // Stop the test process on timeout as well, not just if all messages were sent
    intervalId = setInterval(() => {
        if (determineDone(params, startTime, messageAnalyitics))
            done(userThreadList, params.filename);
    }, 15 * 1000);
    
    // This are the users, who are registering, and writing messages, each has a separate Worker thread
    console.info("Registering users...");
    for (let i = 0; i < walletList.length; i++) {
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
            stdout: false,
            stderr: false
        });

        // Handle the messages (notifications) that are coming from Worker threads
        handleUserThreadEvent(userThread);
        
        if (i < walletList.length-1) console.info(`Waiting ${params.registrationInterval} ms until next user registration...`); 
        await sleep(params.registrationInterval);
        userThreadList.push(userThread);
    };
}   

async function handleMessageReceive(newMessages: MessageData[], params: TestParams, userThreadList: Worker[]) {
    const i = newMessages.length-1;
    const id = generateID(newMessages[i]);

    // Take note when the message was received. If message ID can't be found, that's an error.
    if (!messageAnalyitics[id]) {
        console.warn("WARNING! MESSAGE COULD NOT BE FOUND, THIS IS AN ANOMALY!");
        console.log("It seems like message was received before it was sent, or the ID is wrong.");
        console.log("ID of the message: ", id);
        messageAnalyitics[id] = {
            sent: 0,
            received: Date.now()
        }
        messageAnalyitics[id].received = Date.now();
        messageIdAnomaly++;
    } else {
        messageAnalyitics[id].received = Date.now();
    }

    console.info("New message: ", newMessages[i]);
    console.info("User count: ", getUserCount());

    // Calculate transmission time. If some of the values does not look like a timestamp, that's an error.
    if (messageAnalyitics[id].received < 1600000000000 || messageAnalyitics[id].sent < 1600000000000) {
        console.warn("WARNING! ANOMALY, received or sent is not correct timestamp");
        console.log("Received: ", messageAnalyitics[id].received);
        console.log("Sent: ", messageAnalyitics[id].sent);
        timestampAnomaly++;
    } else {
        const time = messageAnalyitics[id].received - messageAnalyitics[id].sent;
        transmitAvg.addValue(time);
        console.info(`Transmission time: ${time} ms. Average: ${Math.ceil(transmitAvg.getAverage()/1000)} s`);
    }


    const uniqueNewMessages = newMessages.filter(
        (newMsg) => !messages.some((prevMsg) => prevMsg.timestamp === newMsg.timestamp),
    );
    messages = orderMessages([...messages, ...uniqueNewMessages]);

    console.info("TOTAL RECEIVED / TOTAL SENT: ", `${messages.length} / ${totalSentCount}`);

    if (determineDone(params, startTime, messageAnalyitics)) 
        done(userThreadList, params.filename);
};

function handleUserRegistered(username: string) {
    if (userAnalytics[username].registrationSuccess) {
        // This is a reconnect
        return;
    } else {
        // This is a register event
        userAnalytics[username].registrationSuccess = Date.now();
    }
}

function handleUserThreadEvent(userThread: Worker) {
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

            case UserThreadMessages.HASH_RECEIVED:
                if (feedCommitHashList[messageFromThread.hash]) {
                    feedCommitHashList[messageFromThread.hash].count++;
                } else {
                    feedCommitHashList[messageFromThread.hash] = {
                        count: 1
                    }
                }
                console.log("Hash list with counts: ");
                Object.keys(feedCommitHashList).forEach((key) => console.log(`${key}: ${feedCommitHashList[key].count}`));

                break;

            default:
                console.warn("Received message from user threa, that does not have a known label.");
        }
    });
}

async function done(userThreadList: Worker[], filename: string) {
    // Stop the timeout interval
    if (intervalId) clearInterval(intervalId);
    else return;
    
    // A handleMessage function might be still running
    if (isDone) return;
    isDone = true;

    // Wait for last messages
    await sleep(Math.floor(transmitAvg.getAverage()*1.2));
        
    // Terminate all threads
    for (let k = 0; k < userThreadList.length; k++) {
        (await userThreadList[k]).terminate();
    }

    stopMessageFetchProcess();
    stopUserFetchProcess();
    await sleep(1000);

    summary(
        filename, 
        transmitAvg, 
        messages, 
        totalSentCount, 
        userAnalytics,
        messageIdAnomaly,
        timestampAnomaly
    );
}