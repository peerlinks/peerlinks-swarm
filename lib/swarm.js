import hyperswarm from 'hyperswarm';
import createDebug from 'debug';
import WaitList from 'promise-waitlist';

import StreamSocket from './stream-socket';

const debug = createDebug('peerlinks-swarm');

export default class Swarm {
  constructor(peerLinks, options = {}) {
    this.peerLinks = peerLinks;
    this.network = hyperswarm({
      ...(options.hyperswarm || {}),
    });

    this.network.on('connection', (stream, info) => {
      this.onConnection(stream, info);
    });

    debug('join peerLinks.id=%s', this.peerLinks.id.toString('hex').slice(0, 8));
    this.network.join(this.peerLinks.id, {
      lookup: true,
      announce: true,
    });

    for (const channel of this.peerLinks.channels) {
      this.joinChannel(channel);
    }
  }

  joinChannel(channel) {
    debug('join channel.id=%s', channel.id.toString('hex').slice(0, 8));
    this.network.join(channel.id, {
      lookup: true,
      announce: true,
    });
  }

  leaveChannel(channel) {
    debug('leave channel.id=%s', channel.id.toString('hex').slice(0, 8));
    this.network.leave(channel.id);
  }

  waitForInvite(requestId, timeout) {
    debug('waiting for invite requestId=%s',
      requestId.toString('hex').slice(0, 8));
    return this.peerLinks.waitForInvite(requestId, timeout);
  }

  sendInvite({ peerId, encryptedInvite }, timeout) {
    // Self-resolve
    if (peerId.equals(this.peerLinks.id)) {
      return WaitList.resolve(
        this.peerLinks.resolveInvite(encryptedInvite));
    }

    debug('join peer.id=%s', peerId.toString('hex').slice(0, 8));
    this.network.join(peerId, {
      lookup: true,
      announce: true,
    });

    const entry = this.peerLinks.waitForPeer(peerId, timeout);

    const promise = entry.then(async (peer) => {
      await peer.sendInvite(encryptedInvite);
      return true;
    }).finally(() => {
      debug('leave peer.id=%s', peerId.toString('hex').slice(0, 8));
      this.network.leave(peerId);
    });

    return Object.assign(promise, {
      promise,
      cancel(...args) {
        entry.cancel(...args);
      },
    });
  }

  destroy() {
    debug('destroy');
    this.network.destroy();
  }

  //
  // Internal
  //

  onConnection(stream, info) {
    debug('found connection');
    const socket = new StreamSocket(stream, info);

    this.peerLinks.connect(socket).then((reconnect) => {
      debug('peer connect() end reconnect=%j isClient=%j',
        reconnect, !!info.client);
      if (info.client) {
        info.reconnect(reconnect);
      }
      stream.destroy();
    }).catch((e) => {
      debug('connect() error %s ban=%j', e.stack, e.ban);

      // Ban the remote
      if (e.ban) {
        info.ban();
        info.destroy(e);
      } else {
        stream.destroy();
      }
    });
  }
}
