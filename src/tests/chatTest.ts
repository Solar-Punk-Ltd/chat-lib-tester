import { Worker } from 'node:worker_threads';
import path from 'path';
import { fileURLToPath } from 'url';
import { BatchId, Bee, Signer, Topic, Utils } from '@ethersphere/bee-js';

import logger from '../utils/logger.js';
import { FeedCommitHashList, MessageInfo, NodeListElement, TestParams, UserInfo, UserThreadMessages } from '../types/types.js';
import { generateID, sleep, RunningAverage, determineDone } from '../utils/misc.js';
import { summary, writeNodeInfoToFile } from '../utils/info.js';
import { getUserInputs } from '../utils/input.js';
import { ethers } from 'ethers';
import { readComments } from '../libs/comment-system/comments.js';
import { EthAddress } from 'swarm-decentralized-chat';
import { Comment } from '../libs/comment-system/model/comment.model.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


// List of Bee nodes, with stamp
const nodeList: NodeListElement[] = [
    { url: "http://195.88.57.155:1633" ,  stamp: "b4fe81362508d9405e8f67f319e3feb715fb7bef7d2bf14dda046e8f9c3aafbc" as BatchId },
    { url: "http://161.97.125.121:1733" , stamp: "1f191134439c1810da0ef41f4decb176b931377f0a66f9eba41a40308a62d8c5" as BatchId },
    { url: "http://161.97.125.121:1833" , stamp: "f85df6e7a755ac09494696c94e66c8f03f2c8efbe1cb4b607e44ad6df047e8cc" as BatchId },
    { url: "http://161.97.125.121:2033" , stamp: "7093b4457e4443090cb2e8765823a601b3c0165372f8b5bf013cc0f48be4e367" as BatchId }
];

let comments: Comment[] = [];
let messageAnalyitics: MessageInfo = {};
let userAnalytics: UserInfo = {};
let startTime = 0;
let intervalId: NodeJS.Timeout | null = null;                          // Interval to check whether the process is finished or not (if not all messages can be sent)
let readInterval: NodeJS.Timeout | null = null;                        // Read comments interval
let lastLength = 0;                                                    // Last comment list length
let totalSentCount = 0;
let feedCommitHashList: FeedCommitHashList = {};
const transmitAvg: RunningAverage = new RunningAverage(1000);
let messageIdAnomaly = 0;
let timestampAnomaly = 0;
let isDone = false;
const usersFeedTimeout = 20000;                                        // 20 seconds. This is not prompted from the user, but it could be. Will be visible in stats.

const names = ["Alice", "Bob", "Carol", "Dave", "Eve", "Frank", "Gina", "Hannah", "Iza", "Jasmin", "Kate", "Laura", "Mina", "Ophelia", "Petra", "Quintina", "Rita", "Sabina", "Tina", "Una", "Viola", "Wendy", "Xenia"];


// The main chat test, currently this is the only one, but probably there will be more
export async function startChatTest() {
    const topic = `Chat-Library-Test-${Math.floor(Math.random() * 10000)}`;
    const userThreadList: Worker[] = [];

    const bee = new Bee(nodeList[0].url);

    const params = getUserInputs(usersFeedTimeout);
    writeNodeInfoToFile(params.filename, nodeList);

    // Generate a list of private keys, each associated to a user
    const userList = [];
    for (let i = 0; i < params.userCount; i++) {
        userList.push(names[i]);
    }

    // Create Signer for Griffiti feed
    const wallet = ethers.Wallet.createRandom();
    const signer: Signer = {
        address: Utils.hexToBytes(wallet.address.slice(2)),
        sign: async (data: any) => {
          return await wallet.signMessage(data);
        },
    };

    // Create the chat room
    logger.info("Creating chat room...");
    const topicHex: Topic = bee.makeFeedTopic(topic)
    await bee.createFeedManifest(
      nodeList[0].stamp,
      "sequence",
      topicHex,
      signer.address
    );
    startTime = Date.now();
    logger.info(`Done! Now we will wait ${params.registrationInterval} ms before starting registration. \n`);
    await sleep(params.registrationInterval);

    // Some analytics is happening in handle-functions
    
    const READ_INTERVAL = 5 * 1000;
    readInterval = setInterval(async () => {
        comments = await readComments({
            identifier: topicHex,
            beeApiUrl: nodeList[0].url,
            approvedFeedAddress: signer.address as unknown as EthAddress
        });
        if (comments.length > lastLength) {
            handleMessageReceive(comments.slice(lastLength-1), params, userThreadList);
            lastLength = comments.length;
        }
    }, READ_INTERVAL) as unknown as NodeJS.Timeout;

    // Stop the test process on timeout as well, not just if all messages were sent
    intervalId = setInterval(() => {
        if (determineDone(params, startTime, messageAnalyitics))
            done(userThreadList, params.filename);
    }, 15 * 1000) as unknown as NodeJS.Timeout;
    
    // This are the users, who are registering, and writing messages, each has a separate Worker thread
    logger.info("Registering users...");
    for (let i = 0; i < userList.length; i++) {
        const nodeIndex = i % nodeList.length;      // This will cycle through nodeList indices
        const userThread = new Worker(path.resolve(__dirname, '../utils/userThread.js'), {
            workerData: {
                identifier: topicHex,
                params,
                username: userList[i],
                signer,
                node: nodeList[nodeIndex].url,
                stamp: nodeList[nodeIndex].stamp,
            },
            stdout: false,
            stderr: false
        });

        // Handle the messages (notifications) that are coming from Worker threads
        handleUserThreadEvent(userThread);
        
        if (i < userList.length-1) logger.info(`Waiting ${params.registrationInterval} ms until next user registration...`); 
        await sleep(params.registrationInterval);
        userThreadList.push(userThread);
    };
}   

async function handleMessageReceive(newMessages: Comment[], params: TestParams, userThreadList: Worker[]) {
    const i = newMessages.length-1;
    const id = generateID(newMessages[i]);

    // this need to be made a list (FOR LOOP)

    // Take note when the message was received. If message ID can't be found, that's an error.
    if (!messageAnalyitics[id]) {
        logger.warn("WARNING! MESSAGE COULD NOT BE FOUND, THIS IS AN ANOMALY!");
        logger.trace("It seems like message was received before it was sent, or the ID is wrong.");
        logger.trace(`ID of the message:  ${id}`);
        messageAnalyitics[id] = {
            sent: 0,
            received: Date.now()
        }
        messageAnalyitics[id].received = Date.now();
        messageIdAnomaly++;
    } else {
        messageAnalyitics[id].received = Date.now();
    }

    logger.info(`${newMessages[i].data}`);                   // New message
    //logger.debug(`User count:  ${userList.length}`);

    // Calculate transmission time. If some of the values does not look like a timestamp, that's an error.
    if (messageAnalyitics[id].received < 1600000000000 || messageAnalyitics[id].sent < 1600000000000) {
        logger.warn("WARNING! ANOMALY, received or sent is not correct timestamp");
        logger.trace(`Received:  ${messageAnalyitics[id].received}`);
        logger.trace(`Sent:  ${messageAnalyitics[id].sent}`);
        timestampAnomaly++;
    } else {
        const time = messageAnalyitics[id].received - messageAnalyitics[id].sent;
        transmitAvg.addValue(time);
        logger.info(`Transmission time: ${time} ms. Average: ${Math.ceil(transmitAvg.getAverage()/1000)} s`);
    }


    const uniqueNewMessages = newMessages.filter(
        (newMsg) => !comments.some((prevMsg) => prevMsg.timestamp === newMsg.timestamp),
    );

    logger.info(`TOTAL RECEIVED / TOTAL SENT: ${comments.length} / ${totalSentCount} \n`);

    if (determineDone(params, startTime, messageAnalyitics)) 
        done(userThreadList, params.filename);
};

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

            case UserThreadMessages.ERROR:
                logger.error(`Error on the instance of ${messageFromThread.username}: ${messageFromThread.error.error}`);
                // We could count number of errors, and things like that.

                break;

            default:
                logger.warn("Received message from user threa, that does not have a known label.");
        }
    });
}

async function done(userThreadList: Worker[], filename: string) {
    if (intervalId) clearInterval(intervalId);                      // Stop the timeout interval
    else return;
    
    if (isDone) return;                                             // A handleMessage function might be still running
    isDone = true;

    await sleep(Math.floor(transmitAvg.getAverage()*1.2));          // Wait for last messages
        
    for (let k = 0; k < userThreadList.length; k++) {               // Terminate all threads
        (await userThreadList[k]).terminate();
    }

    await sleep(1000);

    summary(
        filename, 
        transmitAvg, 
        comments, 
        totalSentCount, 
        userAnalytics,
        messageIdAnomaly,
        timestampAnomaly
    );
}