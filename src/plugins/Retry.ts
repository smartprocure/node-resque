// If a job fails, retry it N times before finally placing it into the failed queue
// a port of some of the features in https://github.com/lantins/resque-retry

import * as os from "os";
import { Plugin } from "..";

export class Retry extends Plugin {
  constructor(worker, func, queue, job, args, options) {
    super(worker, func, queue, job, args, options);

    if (!this.options.retryLimit) {
      this.options.retryLimit = 1;
    }
    if (!this.options.retryDelay) {
      this.options.retryDelay = 1000 * 5;
    }
    if (!this.options.backoffStrategy) {
      this.options.backoffStrategy = null;
    }
  }

  beforeEnqueue() {
    return true;
  }

  afterEnqueue() {
    return true;
  }

  beforePerform() {
    return true;
  }

  async afterPerform() {
    if (!this.worker.error) {
      await this.cleanup();
      return true;
    }
    const remaining = await this.attemptUp();
    await this.saveLastError();

    if (remaining <= 0) {
      await this.cleanup();
      throw this.worker.error;
    }

    let nextTryDelay = this.options.retryDelay;
    if (Array.isArray(this.options.backoffStrategy)) {
      let index = this.options.retryLimit - remaining - 1;
      if (index > this.options.backoffStrategy.length - 1) {
        index = this.options.backoffStrategy.length - 1;
      }
      nextTryDelay = this.options.backoffStrategy[index];
    }

    await this.queueObject.enqueueIn(
      nextTryDelay,
      this.queue,
      this.func,
      this.args
    );

    this.job.args = this.args;
    this.worker.emit("reEnqueue", this.queue, this.job, {
      delay: nextTryDelay,
      remainingAttempts: remaining,
      err: this.worker.error,
    });

    await this.redis().decr(
      this.queueObject.connection.key("stat", "processed")
    );
    await this.redis().decr(
      this.queueObject.connection.key("stat", "processed", this.worker.name)
    );

    await this.redis().incr(this.queueObject.connection.key("stat", "failed"));
    await this.redis().incr(
      this.queueObject.connection.key("stat", "failed", this.worker.name)
    );

    delete this.worker.error;
    return true;
  }

  argsKey() {
    if (!this.args || this.args.length === 0) {
      return "";
    }
    return this.args
      .map(function (elem) {
        return typeof elem === "object" ? JSON.stringify(elem) : elem;
      })
      .join("-");
  }

  retryKey() {
    return this.queueObject.connection
      .key("resque-retry", this.func, this.argsKey())
      .replace(/\s/, "");
  }

  failureKey() {
    return this.queueObject.connection
      .key("failure-resque-retry:" + this.func + ":" + this.argsKey())
      .replace(/\s/, "");
  }

  maxDelay() {
    // 64-bit signed integer
    let redisMaxExpire = 9223372036854775807;
    let maxDelay = this.options.retryDelay || 1;
    if (Array.isArray(this.options.backoffStrategy)) {
      this.options.backoffStrategy.forEach(function (d) {
        if (d > maxDelay) {
          maxDelay = d;
        }
      });
    }
    // Prevent out of range exception if max delay is larger than largest allowed value
    return maxDelay > redisMaxExpire ? redisMaxExpire : maxDelay;
  }

  redis() {
    return this.queueObject.connection.redis;
  }

  async attemptUp() {
    const key = this.retryKey();
    const maxDelay = this.maxDelay();
    const keyNotExist = await this.redis().set(key, 1, "PX", maxDelay, "NX");
    const retryCount = keyNotExist ? 1 : await this.redis().incr(key);
    if (!keyNotExist) {
      await this.redis().pexpire(key, maxDelay);
    }

    return this.options.retryLimit - retryCount;
  }

  async saveLastError() {
    const now = new Date();
    const failedAt =
      "" +
      now.getFullYear() +
      "/" +
      ("0" + (now.getMonth() + 1)).slice(-2) +
      "/" +
      ("0" + now.getDate()).slice(-2) +
      " " +
      ("0" + now.getHours()).slice(-2) +
      ":" +
      ("0" + now.getMinutes()).slice(-2) +
      ":" +
      ("0" + now.getSeconds()).slice(-2);
    const backtrace = this.worker.error.stack
      ? this.worker.error.stack.split(os.EOL) || []
      : [];

    const data = {
      failed_at: failedAt,
      payload: this.args,
      exception: String(this.worker.error),
      error: String(this.worker.error),
      backtrace: backtrace,
      worker: this.func,
      queue: this.queue,
      attempts: this.options.retryLimit,
    };

    await this.redis().setex(
      this.failureKey(),
      this.maxDelay(),
      JSON.stringify(data)
    );
  }

  async cleanup() {
    await this.redis().del(this.retryKey());
    await this.redis().del(this.failureKey());
  }
}
