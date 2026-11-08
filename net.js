/* Conexão online entre amigos: WebRTC ponto a ponto via PeerJS (código de sala).
   ?net=bc usa BroadcastChannel (teste local entre abas).
   Resistente a quedas: batimento (ping) a cada 2 s, reconexão automática por até 45 s e
   erros do servidor de salas não derrubam uma partida já conectada. */
(function () {
  const PREFIX = 'cosmocards-v1-';
  const ALPH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const PEER_URLS = ['https://cdnjs.cloudflare.com/ajax/libs/peerjs/1.5.4/peerjs.min.js',
    'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js'];
  const ICE = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' }] };
  const useBC = /[?&]net=bc/.test(location.search);
  const HB_MS = 2000, STALE_MS = 10000, RECONN_MS = 45000;

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
    constructor(h) {
      this.h = h; this.peer = null; this.conn = null; this.bc = null; this.closed = false;
      this.everOpen = false; this.reconn = false; this.lastRx = Date.now(); this.hb = null; this.rt = null; this.dl = null;
      this._vis = () => { if (document.visibilityState === 'visible') { this.lastRx = Date.now(); if (this.everOpen && !this.closed) { if (!this.conn || !this.conn.open) this._drop(); else this.h.wake && this.h.wake(); } } };
      document.addEventListener('visibilitychange', this._vis);
    }
    _wire(conn) {
      conn.on('open', () => {
        if (this.closed) { try { conn.close(); } catch (e) {} return; }
        if (this.conn && this.conn !== conn) { const old = this.conn; this.conn = conn; try { old.close(); } catch (e) {} } else this.conn = conn;
        this.lastRx = Date.now(); this._startHb();
        if (!this.everOpen) { this.everOpen = true; this.h.open && this.h.open(); }
        else if (this.reconn) { this.reconn = false; clearTimeout(this.rt); clearTimeout(this.dl); this.h.unstable && this.h.unstable(false); this.h.reopen && this.h.reopen(); }
      });
      conn.on('data', d => {
        if (conn !== this.conn) return;
        this.lastRx = Date.now();
        if (d && d.__hb) return;
        this.h.data && this.h.data(d);
      });
      conn.on('close', () => { if (conn === this.conn) this._drop(); });
      conn.on('error', () => { if (conn === this.conn) this._drop(); });
      if (!this.conn) this.conn = conn;
    }
    _startHb() {
      if (this.hb) return;
      this.hb = setInterval(() => {
        if (this.closed) return;
        if (this.conn && this.conn.open) { try { this.conn.send({ __hb: 1 }); } catch (e) {} }
        if (this.everOpen && !this.reconn && document.visibilityState === 'visible' && Date.now() - this.lastRx > STALE_MS) this._drop();
      }, HB_MS);
    }
    // conexão caiu ou ficou muda: tenta reconectar antes de desistir
    _drop() {
      if (this.closed || this.reconn) return;
      if (!this.everOpen) return this._lost();
      this.reconn = true; this.h.unstable && this.h.unstable(true);
      clearTimeout(this.dl); this.dl = setTimeout(() => { if (this.reconn) this._lost(); }, RECONN_MS);
      if (this.role === 'guest') this._retry();
      else if (this.peer && this.peer.disconnected && !this.peer.destroyed) { try { this.peer.reconnect(); } catch (e) {} }
    }
    _retry() {
      if (this.closed || !this.reconn) return;
      const p = this.peer;
      try {
        if (p && p.destroyed) { this._newGuestPeer(); }
        else if (p && p.disconnected) p.reconnect();
        else if (p && p.open) { const c = p.connect(PREFIX + this.code, { reliable: true, serialization: 'json' }); this._wire(c); }
      } catch (e) {}
      clearTimeout(this.rt); this.rt = setTimeout(() => this._retry(), 4000);
    }
    _newGuestPeer() {
      const peer = this.peer = new Peer(undefined, { debug: 0, config: ICE });
      peer.on('open', () => { if (this.reconn) { const c = peer.connect(PREFIX + this.code, { reliable: true, serialization: 'json' }); this._wire(c); } });
      peer.on('error', () => {});
      peer.on('disconnected', () => { if (!this.closed && !peer.destroyed) try { peer.reconnect(); } catch (e) {} });
    }
    _lost() {
      if (this.closed) return;
      this.closed = true; clearInterval(this.hb); clearTimeout(this.rt); clearTimeout(this.dl);
      document.removeEventListener('visibilitychange', this._vis);
      this.h.close && this.h.close();
    }
    send(o) {
      if (this.bc) { this.bc.postMessage({ from: this.role, o }); return; }
      if (this.conn && this.conn.open) { try { this.conn.send(o); } catch (e) { this._drop(); } }
    }
    async host() {
      this.role = 'host';
      if (useBC) {
        const c = code(); this.code = c; this.h.code && this.h.code(c);
        this.bc = new BroadcastChannel(PREFIX + c);
        this.bc.onmessage = e => { const m = e.data; if (m.from === 'host') return;
          if (m.o === '__hello') { this.bc.postMessage({ from: 'host', o: '__welcome' }); if (!this.everOpen) { this.everOpen = true; this.h.open && this.h.open(); } else this.h.reopen && this.h.reopen(); return; }
          if (m.o === '__bye') return this._lost(); this.h.data && this.h.data(m.o); };
        return;
      }
      await loadPeer();
      const tryId = (left) => {
        const c = code();
        const peer = this.peer = new Peer(PREFIX + c, { debug: 0, config: ICE });
        peer.on('open', () => { if (!this.everOpen) { this.code = c; this.h.code && this.h.code(c); } });
        peer.on('connection', conn => {
          // aceita a reconexão do amigo se a conexão atual caiu; recusa um terceiro jogador
          if (this.conn && this.conn.open && !this.reconn && this.everOpen && Date.now() - this.lastRx < 4000) { conn.on('open', () => conn.close()); return; }
          this._wire(conn);
        });
        peer.on('error', err => {
          if (err.type === 'unavailable-id' && left > 0 && !this.everOpen) { peer.destroy(); tryId(left - 1); return; }
          if (this.everOpen) return;   // partida em andamento: erro do servidor de salas não derruba a conexão direta
          this.h.error && this.h.error(err.type || 'erro');
        });
        peer.on('disconnected', () => { if (!this.closed && this.peer && !this.peer.destroyed) setTimeout(() => { try { if (this.peer.disconnected && !this.peer.destroyed) this.peer.reconnect(); } catch (e) {} }, 1500); });
      };
      tryId(3);
    }
    async join(c) {
      this.role = 'guest';
      c = c.toUpperCase().trim(); this.code = c;
      if (useBC) {
        this.bc = new BroadcastChannel(PREFIX + c);
        this.bc.onmessage = e => { const m = e.data; if (m.from === 'guest') return;
          if (m.o === '__welcome') { if (!this.everOpen) { this.everOpen = true; this.h.open && this.h.open(); } return; }
          if (m.o === '__bye') return this._lost(); this.h.data && this.h.data(m.o); };
        this.bc.postMessage({ from: 'guest', o: '__hello' });
        return;
      }
      await loadPeer();
      const peer = this.peer = new Peer(undefined, { debug: 0, config: ICE });
      peer.on('open', () => {
        if (this.everOpen) return;
        const conn = peer.connect(PREFIX + c, { reliable: true, serialization: 'json' });
        this._wire(conn);
        setTimeout(() => { if (!this.everOpen && !this.closed) this.h.error && this.h.error('timeout'); }, 15000);
      });
      peer.on('error', err => { if (this.everOpen) return; this.h.error && this.h.error(err.type || 'erro'); });
      peer.on('disconnected', () => { if (!this.closed && !peer.destroyed) setTimeout(() => { try { if (peer.disconnected && !peer.destroyed) peer.reconnect(); } catch (e) {} }, 1500); });
    }
    close() {
      this.closed = true; clearInterval(this.hb); clearTimeout(this.rt); clearTimeout(this.dl);
      document.removeEventListener('visibilitychange', this._vis);
      try { if (this.bc) { this.bc.postMessage({ from: this.role, o: '__bye' }); this.bc.close(); } } catch (e) {}
      try { this.conn && this.conn.close(); } catch (e) {}
      try { this.peer && this.peer.destroy(); } catch (e) {}
    }
  }
  window.Net = { Link, loadPeer };
})();
