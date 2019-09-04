import { Buffer } from 'buffer';

export default class StreamSocket {
  constructor(stream, info) {
    this.stream = stream;
    this.info = info;

    this.stream.on('readable', () => this.maybeRead());
    this.stream.once('error', (error) => {
      this.close(error).catch(() => {});

      this.error = error;

      for (const pending of this.receiveQueue) {
        pending.reject(error);
      }
    });
    const onClose = () => {
      this.closed = true;

      this.error = new Error('Closed');
      for (const pending of this.receiveQueue) {
        pending.reject(this.error);
      }
    };
    this.stream.once('end', onClose);
    this.stream.once('close', onClose);

    this.error = null;
    this.receiveQueue = [];
    this.buffer = Buffer.alloc(0);

    this.closed = false;
  }

  async send(data) {
    if (this.closed) {
      return;
    }

    const packet = Buffer.alloc(4 + data.length);
    packet.writeUInt32BE(data.length, 0);
    data.copy(packet, 4);

    this.stream.write(packet);
  }

  async receive(timeout) {
    if (this.error) {
      throw this.error;
    }

    let entry;
    let result = new Promise((resolve, reject) => {
      entry = { resolve, reject }
      this.receiveQueue.push(entry);
    });

    if (timeout) {
      const timer = setTimeout(() => {
        entry.reject(new Error('Timed out'));
      }, timeout);

      result = result.finally(() => {
        clearTimeout(timer);
      });
    }

    this.maybeRead();

    return await result;
  }

  async close(error) {
    if (this.closed) {
      return;
    }

    this.closed = true;

    while (this.receiveQueue.length !== 0) {
      const elem = this.receiveQueue.shift();
      elem.reject(error || new Error('Closed'));
    }

    if (error && error.ban) {
      this.info.destroy(error);
      return;
    }

    if (this.stream.destroy) {
      this.stream.destroy();
    } else {
      this.stream.end();
    }
  }

  //
  // Internal
  //

  maybeRead() {
    while (this.receiveQueue.length !== 0) {
      // `this.buffer` might have multiple packets in it
      while (this.receiveQueue.length !== 0) {
        if (this.buffer.length < 4) {
          break;
        }
        const len = this.buffer.readUInt32BE(0);
        if (this.buffer.length < 4 + len) {
          break;
        }

        const data = this.buffer.slice(4, 4 + len);
        this.buffer = this.buffer.slice(4 + len);

        this.receiveQueue.shift().resolve(data);
      }

      const chunk = this.stream.read();
      if (!chunk) {
        break;
      }

      this.buffer = Buffer.concat([ this.buffer, chunk ]);
    }
  }
}
