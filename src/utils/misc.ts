// General sleep function, usage: await sleep(ms)
export function sleep(delay: number) {
    return new Promise((resolve) => {
        setTimeout(resolve, delay);
    });
}