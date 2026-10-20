import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from '../scripts/server.mjs';
import {createPeerGuard} from '../scripts/peer-guard.mjs';

async function runServer(options, body) {
  const server=await createServer(options);
  await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
  try { await body(`http://127.0.0.1:${server.address().port}`); }
  finally { server.closeAllConnections(); await new Promise(ok=>server.close(ok)); }
}

test('origin accepts only the actual allowed TCP peer and records it once',async()=>{
  const observed=[];
  await runServer({allowedPeers:['127.0.0.1'],onAllowedPeer:ip=>observed.push(ip)},async origin=>{
    for(const path of ['/','/perceptrons/','/digits/','/cars/'])assert.equal((await fetch(origin+path)).status,200);
  });
  assert.deepEqual(observed,['127.0.0.1']);
});

test('unapproved TCP peers cannot spoof Cloudflare or forwarded headers',async()=>{
  await runServer({allowedPeers:['203.0.113.9']},async origin=>{
    for(const path of ['/','/cars/','/digits/data/train.bin','/health']) {
      const response=await fetch(origin+path,{headers:{'X-Forwarded-For':'203.0.113.9','CF-Connecting-IP':'203.0.113.9'}});
      assert.equal(response.status,403);
      assert.equal(await response.text(),'Forbidden');
    }
  });
  for(const invalid of [[],['*'],['0.0.0.0/0'],['::1'],['not-an-ip']])assert.throws(()=>createPeerGuard(invalid));
});
