
import { getUserInputs } from './utils/input.js';
import { startChatTest } from './tests/chatTest.js';


const main = () => {
    console.log("Welcome to the Chat Library Test App!\n");
    
    const inputs = getUserInputs();
  
    startChatTest(inputs);
};
  
main();