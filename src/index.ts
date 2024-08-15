import { getUserInputs } from './utils/input';

import { 
    EVENTS, 
    getChatActions, 
    initUsers, 
    ParticipantDetails, 
    registerUser, 
    UserWithIndex, 
    MessageData,
    orderMessages,
    startMessageFetchProcess,
    startUserFetchProcess,
    stopMessageFetchProcess,
    stopUserFetchProcess
} from './libs/chat/';



const main = () => {
    console.log("Welcome to the Chat Library Test App!\n");
    
    const inputs = getUserInputs();
  
    console.log("\nStarting simulation with the following parameters:");
    console.log(inputs);
  
    // Further logic to simulate based on inputs...
  };
  
  main();