/* Conexão online entre amigos: WebRTC ponto a ponto via PeerJS (código de sala).
   ?net=bc usa BroadcastChannel (teste local entre abas). */
(function () {
  const PREFIX = 'cosmocards-v1-';
  const ALPH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const PEER_URLS = ['https://cdnjs.cloudflare.com/ajax/libs/peerjs/1.5.4/peerjs.min.js',
    'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js'];
  const ICE = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' }] };
  const useBC = /[?&]net=bc/.test(location.search);

  function code() { let s = ''; for (let i = 0; i < 5; i++) s += ALPH[Math.floor(Math.random() * ALPH.length)]; return s; }

  let loading = null;
  function loadPeer() {
    if (window.Peer) return Promise.resolve();
    if (loading) return loading;
    loading = new Promise((res, rej) => {
      let i = 0;
      const next = () => {
        if (i >= PEER_URLS.length) { loading = null; return rej(new Error('lib')); }
        const s = document.createElement('script'); s.src = PEER_URLS[i++]; s.async = true;
        s.onload = () => window.Peer ? res() : next(); s.onerror = next; document.head.appendChild(s);
      };
      next();
    });
    return loading;
  }

  class Link {
    constructor(h) { this.h = h; this.peer = null; this.conn = null; this.bc = null; this.closed = false; }
    _wire(conn) {
      this.conn = conn;
      conn.on('open', () => this.h.open && this.h.open());
      conn.on('data', d => this.h.data && this.h.data(d));
      conn.on('close', () => this._lost());
      conn.on('error', () => this._lost());
    }
    _lost() { if (this.closed) return; this.closed = true; this.h.close && this.h.close(); }
    send(o) {
      if (this.bc) { this.bc.postMessage({ from: this.role, o }); return; }
      if (this.conn && this.conn.open) this.conn.send(o);
    }
    async host() {
      this.role = 'host';
      if (useBC) {
        const c = code(); this.h.code && this.h.code(c);
        this.bc = new BroadcastChannel(PREFIX + c);
        this.bc.onmessage = e => { const m = e.data; if (m.from === 'host') return;
          if (m.o === '__hello') { this.bc.postMessage({ from: 'host', o: '__welcome' }); this.h.open && this.h.open(); return; }
          if (m.o === '__bye') return this._lost(); this.h.data && this.h.data(m.o); };
        return;
      }
      await loadPeer();
      const tryId = (left) => {
        const c = code();
        const peer = this.peer = new Peer(PREFIX + c, { debug: 0, config: ICE });
        peer.on('open', () => this.h.code && this.h.code(c));
        peer.on('connection', conn => {
          if (this.conn) { conn.on('open', () => conn.close()); return; }
          this._wire(conn);
        });
        peer.on('error', err => {
          if (err.type === 'unavailable-id' && left > 0) { peer.destroy(); tryId(left - 1); return; }
          this.h.error && this.h.error(err.type || 'erro');
        });
        peer.on('disconnected', () => { if (!this.closed && this.peer && !this.peer.destroyed) try { this.peer.reconnect(); } catch (e) {} });
      };
      tryId(3);
    }
    async join(c) {
      this.role = 'guest';
      c = c.toUpperCase().trim();
      if (useBC) {
        this.bc = new BroadcastChannel(PREFIX + c);
        this.bc.onmessage = e => { const m = e.data; if (m.from === 'guest') return;
          if (m.o === '__welcome') { this.h.open && this.h.open(); return; }
          if (m.o === '__bye') return this._lost(); this.h.data && this.h.data(m.o); };
        this.bc.postMessage({ from: 'guest', o: '__hello' });
        return;
      }
      await loadPeer();
      const peer = this.peer = new Peer(undefined, { debug: 0, config: ICE });
      let opened = false;
      peer.on('open', () => {
        const conn = peer.connect(PREFIX + c, { reliable: true, serialization: 'json' });
        conn.on('open', () => { opened = true; });
        this._wire(conn);
        setTimeout(() => { if (!opened && !this.closed) this.h.error && this.h.error('timeout'); }, 15000);
      });
      peer.on('error', err => this.h.error && this.h.error(err.type || 'erro'));
    }
    close() {
      this.closed = true;
      try { if (this.bc) { this.bc.postMessage({ from: this.role, o: '__bye' }); this.bc.close(); } } catch (e) {}
      try { this.conn && this.conn.close(); } catch (e) {}
      try { this.peer && this.peer.destroy(); } catch (e) {}
    }
  }
  window.Net = { Link, loadPeer };
})();
