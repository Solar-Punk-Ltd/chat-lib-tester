import readlineSync from 'readline-sync';

// Generic function for reading numbers from the console
function getNumberInput(prompt: string, defaultInput: string): number {
    const value = readlineSync.questionInt(`${prompt} (default: ${defaultInput}): `, { defaultInput });
    return value;
}

export function getUserInputs() {
    const userCount = getNumberInput("Enter the number of users", "50");
    const messageFrequency = getNumberInput("Enter the message frequency (seconds)", "2") * 1000;
    const registrationInterval = getNumberInput("Enter the registration interval (seconds)", "3") * 1000;
    const totalMessageCount = getNumberInput("Enter total message count", "1000");
  
    console.log("\n--- Input Summary ---");
    console.log(`User Count: ${userCount}`);
    console.log(`Message Frequency: ${messageFrequency} milliseconds`);
    console.log(`Registration Interval: ${registrationInterval} milliseconds`);
    console.log(`Total message count: ${totalMessageCount}`);
  
    return {
        userCount,
        messageFrequency,
        registrationInterval,
        totalMessageCount
    };
};