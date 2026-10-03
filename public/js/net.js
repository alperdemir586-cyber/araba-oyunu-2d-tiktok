// Sunucu ile WebSocket bağlantısı (otomatik yeniden bağlanır).
export class Net {
  constructor(onMessage) {
    this.onMessage = onMessage;
    this.ws = null;
    this.open = false;
    this.connect();
  }

  connect() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${location.host}/ws`);
    this.ws = ws;
    ws.onopen = () => { this.open = true; };
    ws.onclose = () => {
      this.open = false;
      setTimeout(() => this.connect(), 1500);
    };
    ws.onerror = () => ws.close();
    ws.onmessage = (e) => {
      let msg;
      try { msg = JSON.parse(e.data); } catch { return; }
      this.onMessage(msg);
    };
  }

  send(msg) {
    if (this.open) this.ws.send(JSON.stringify(msg));
  }
}
