import hyperswarm from 'hyperswarm';
import createDebug from 'debug';
import WaitList from 'promise-waitlist';

import StreamSocket from './stream-socket';

const debug = createDebug('vowlink-swarm');

export default class Swarm {
  constructor(vowlink, options = {}) {
    this.vowlink = vowlink;
    this.network = hyperswarm(options.hyperswarm);

    this.network.on('connection', (stream, info) => {
      this.onConnection(stream, info);
    });

    this.network.join(this.vowlink.id, {
      announce: true,
    });

    for (const channel of this.vowlink.channels) {
      this.joinChannel(channel);
    }
  }

  joinChannel(channel) {
    this.network.join(channel.id, {
      lookup: true,
      announce: true,
    });
  }

  leaveChannel(channel) {
    this.network.leave(channel.id);
  }

  waitForInvite(requestId, timeout) {
    const entry = this.vowlink.waitForInvite(requestId, timeout);
    return {
      ...entry,
      promise: entry.promise.finally(() => {
        this.network.leave(requestId);
      }),
    };
  }

  sendInvite({ peerId, encryptedInvite }, timeout) {
    // Self-resolve
    if (peerId.equals(this.vowlink.id)) {
      return WaitList.resolve(
        this.vowlink.resolveInvite(encryptedInvite));
    }

    // TODO(indutny): should we leave?
    this.network.join(peerId, {
      lookup: true,
    });

    const entry = this.vowlink.waitForPeer(peerId, timeout);
    const promise = entry.promise.then(async (peer) => {
      await peer.sendInvite(encryptedInvite);
      return true;
    });
    return { promise, cancel: (...args) => entry.cancel(...args) };
  }

  destroy() {
    this.network.destroy();
  }

  //
  // Internal
  //

  onConnection(stream, info) {
    debug('found connection');
    const socket = new StreamSocket(stream);

    this.vowlink.connect(socket).then((reconnect) => {
      debug('peer connect() end reconnect=%j', reconnect);
      if (!reconnect) {
        info.reconnect(reconnect);
      }
    }).catch((e) => {
      debug('connect() error %s', e.stack);

      // Ban the remote
      info.ban();
    });
  }
}
