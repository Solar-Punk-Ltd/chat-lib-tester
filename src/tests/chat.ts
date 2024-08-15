import { BatchId } from '@ethersphere/bee-js';
import { ethers } from 'ethers';
import { NodeListElement, TestParams } from '../types/types.js';
import { sleep } from '../utils/misc.js';

import pkg, { EthAddress, registerUser, initChatRoom } from 'swarm-decentralized-chat';

// It is not handling it on module-level, it is just looking for .js file. But, it won't find chat lib js files there
//, because those are not handled by this tsc compilation


// List of Bee nodes, with stamp
const nodeList: NodeListElement[] = [
    { url: "http://195.88.57.155:1633" , stamp: "bafe831364e954bdf00ecbc5f1c02bd494e5cd7568fbf748edbb599e9fc1d2cf" as BatchId }
];


export function startChatTest(params: TestParams) {
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
    sleep(5000);

    console.info("Registering users...");
    walletList.map((wallet, i) => {
        console.info("Registering ", `user-${i}`);
        registerUser(topic, { 
            participant: wallet.address as EthAddress,
            key: wallet.privateKey,
            stamp: nodeList[0].stamp,       // Later this should be dynamic if we want to test with multiple nodes
            nickName: `user-${i}`
        });

        sleep(params.registrationInterval);
    });


    console.log("\nStarting simulation with the following parameters:");
    console.log(params);
}