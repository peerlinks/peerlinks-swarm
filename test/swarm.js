/* eslint-env node, mocha */
import * as assert from 'assert';
import * as sodium from 'sodium-universal';
import PeerLinks, { Message } from '@peerlinks/protocol';

import Swarm from '../';

async function main() {
  const a = new PeerLinks({ sodium });
  const b = new PeerLinks({ sodium });

  await a.load();
  await b.load();

  const [ idA ] = await a.createIdentityPair('a');
  const [ idB, channelB ] = await b.createIdentityPair('b');

  const swarmA = new Swarm(a);
  const swarmB = new Swarm(b);

  const { requestId, request, decrypt } = idA.requestInvite(a.id);

  const getInvite = async () => {
    const encryptedInvite = await swarmA.waitForInvite(requestId).promise;
    const invite = decrypt(encryptedInvite);

    const channelBCopy = await a.channelFromInvite(invite, idA);

    await assert.rejects(channelBCopy.post(Message.json('ohai'), idA), {
      name: 'Error',
      message: 'Initial synchronization not complete',
    });

    // Get root
    await channelBCopy.waitForIncomingMessage().promise;

    await channelBCopy.post(Message.json('ohai'), idA);

    swarmA.joinChannel(channelBCopy);
  };

  const sendInvite = async () => {
    const { encryptedInvite, peerId } =
      idB.issueInvite(channelB, request, 'invitee-name');

    const sent = await swarmB.sendInvite({
      peerId,
      encryptedInvite,
    }).promise;
    assert.ok(sent);
  };

  channelB.waitForIncomingMessage().promise.then((message) => {
    assert.strictEqual(message.json, 'ohai');
    console.error('ok');
    process.exit(0);
  });

  await Promise.all([
    getInvite(),
    sendInvite(),
  ]);
}

main().catch((e) => {
  console.error(e.stack);
  process.exit(1);
});
