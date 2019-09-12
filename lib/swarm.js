import hyperswarm from 'hyperswarm';
import createDebug from 'debug';
import WaitList from 'promise-waitlist';
import swarmDefaults from 'dat-swarm-defaults';

import StreamSocket from './stream-socket';

const debug = createDebug('vowlink-swarm');

const KEEPALIVE_INTERVAL = 10 * 1000;

export default class Swarm {
  constructor(vowlink, options = {}) {
    this.vowlink = vowlink;
    this.network = hyperswarm({
      bootstrap: swarmDefaults().dht.bootstrap,

      ...(options.hyperswarm || {}),
    });

    this.network.on('connection', (stream, info) => {
      this.onConnection(stream, info);
    });

    debug('join vowlink.id=%s', this.vowlink.id.toString('hex').slice(0, 8));
    this.network.join(this.vowlink.id, {
      lookup: true,
      announce: true,
    });

    for (const channel of this.vowlink.channels) {
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

    debug('join peer.id=%s', peerId.toString('hex').slice(0, 8));
    this.network.join(peerId, {
      lookup: true,
      announce: true,
    });

    const entry = this.vowlink.waitForPeer(peerId, timeout);
    const promise = entry.promise.then(async (peer) => {
      await peer.sendInvite(encryptedInvite);
      return true;
    }).finally(() => {
      debug('leave peer.id=%s', peerId.toString('hex').slice(0, 8));
      this.network.leave(peerId);
    });
    return { promise, cancel: (...args) => entry.cancel(...args) };
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
    if (stream.setKeepAlive) {
      debug('setting keepalive');
      stream.setKeepAlive(true, KEEPALIVE_INTERVAL);
    }

    const socket = new StreamSocket(stream, info);

    this.vowlink.connect(socket).then((reconnect) => {
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
