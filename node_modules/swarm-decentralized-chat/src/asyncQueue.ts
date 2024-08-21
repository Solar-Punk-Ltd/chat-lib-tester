import { FIRST_SEGMENT_INDEX } from "./constants";
import { incrementHexString, sleep } from "./utils";

// A promise queue, that will keep a specified max parallel request count
export class AsyncQueue {
  private indexed;
  private waitable;
  private clearWaitTime;
  private index;
  private isProcessing = false;
  private inProgressCount = 0;
  private isWaiting = false;
  private queue: ((index?: string) => Promise<void>)[] = [];
  private maxParallel: number;

  constructor(settings: { indexed?: boolean; index?: string; waitable?: boolean; clearWaitTime?: number; max?: number } = {}) {
    this.indexed = settings.indexed || false;
    this.index = settings.index || FIRST_SEGMENT_INDEX;
    this.waitable = settings.waitable || false;
    this.clearWaitTime = settings.clearWaitTime || 100;
    this.maxParallel = settings.max || 5;
  }

  // Executes promises from the AsyncQueue, will execute maxParallel count parallel requests
  private async processQueue() {
    if (this.inProgressCount >= this.maxParallel) return;
    this.isProcessing = true;

    while (this.queue.length > 0) {
      this.inProgressCount = this.inProgressCount+1;
      const promise = this.queue.shift()!;
      const action = this.indexed ? () => promise(this.index) : () => promise();

      if (this.waitable) {
        try {
          await action();
          this.index = incrementHexString(this.index);
        } catch (error) {
          console.error('Error processing promise:', error);
        } finally {
          this.inProgressCount = this.inProgressCount-1;
        }
      } else {
        action()
          .then(() => {
            this.index = incrementHexString(this.index);
          })
          .catch((error) => {
            console.error('Error processing promise:', error);
          })
          .finally(() => {
            this.inProgressCount = this.inProgressCount-1;
          });
      }
    }

    this.isProcessing = false;
  }

  // Enqueue a promise into the AsyncQueue
  enqueue(promiseFunction: (index?: string) => Promise<any>) {
    this.queue.push(promiseFunction);
    this.processQueue();
  }

  // Increase the number of maximum parallel requests
  increaseMax(limit: number) {
    if (this.maxParallel+1 <= limit) {
      this.maxParallel++;
    }
    console.log("Max parallel request set to ", this.maxParallel);
  }

  // Decrease the number of maximum parallel requests
  decreaseMax() {
    if (this.maxParallel > 1) {
      this.maxParallel--;
      console.log("Max parallel request set to ", this.maxParallel);
    }
  }

  // Waits for in-progress promises, then clears the queue
  async clearQueue() {
    this.queue = [];
    while (this.isProcessing || this.inProgressCount > 0) {
      await sleep(this.clearWaitTime);
    }
  }

  //TODO need to understand this part
  async waitForProcessing() {
    if (this.isWaiting) return true;

    this.isWaiting = true;

    while (this.isProcessing || this.inProgressCount > 0) {
      await sleep(this.clearWaitTime);
    }

    this.isWaiting = false;
  }
}
