# vowlink-swarm
[![Build Status](https://travis-ci.org/vowlink/vowlink-swarm.svg?branch=master)](http://travis-ci.org/vowlink/vowlink-swarm)

Integration of [VowLink][] protocol with [hyperswarm][].

## Usage

```js
import VowLink, { Message } from '@vowlink/protocol';
import Swarm from '@vowlink/swar,';

// Initialize VowLink
const vowLink = new VowLink({ /* ... */ });
await vowlink.open();

const swarm = new Swarm(vowLink);
```

Request invite:
```js
const { requestId, request, decrypt } =
  identity.requestInvite(vowLink.id);

const encryptedInvite = await swarm.waitForInvite(requestId).promise;
const invite = decrypt(encryptedInvite);

const channel = await vowLink.channelFromInvite(invite, identity);
await channel.post(Message.json('test'), identity);

swarm.joinChannel(channel);
```

Issue invite:
```js
const { encryptedInvite, peerId } =
  identity.issueInvite(channel, request, 'invitee-name');

await swarm.sendInvite({
  requestId,
  peerId,
  encryptedInvite,
}).promise;
```

Join/leave channel:
```js
swarm.joinChannel(channel);
swarm.leaveChannel(channel);
```

## LICENSE

This software is licensed under the MIT License.

Copyright Fedor Indutny, 2019.

Permission is hereby granted, free of charge, to any person obtaining a
copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to permit
persons to whom the Software is furnished to do so, subject to the
following conditions:

The above copyright notice and this permission notice shall be included
in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
USE OR OTHER DEALINGS IN THE SOFTWARE.

[VowLink]: https://github.com/vowlink/vowlink-protocol
[hyperswarm]: https://github.com/hyperswarm/hyperswarm
