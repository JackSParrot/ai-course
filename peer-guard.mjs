import {isIP} from 'node:net';

export function createPeerGuard(addresses, onAllowedPeer = () => {}) {
  if (!addresses) return () => true;
  if (!Array.isArray(addresses) || !addresses.length || addresses.some(ip => isIP(ip) !== 4)) {
    throw new Error('Peer restriction requires explicit IPv4 addresses.');
  }
  const allowed = new Set(addresses), observed = new Set();
  return (req, res) => {
    // Use the TCP peer, never client-controlled X-Forwarded-For or CF headers.
    const peer = req.socket.remoteAddress;
    if (!allowed.has(peer)) {
      res.writeHead(403, {'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
      res.end(req.method === 'HEAD' ? undefined : 'Forbidden');
      return false;
    }
    if (!observed.has(peer)) { observed.add(peer); onAllowedPeer(peer); }
    return true;
  };
}
