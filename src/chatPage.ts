export const CHAT_PAGE_HTML = `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>TC Kimlik Yapay Zeka Ajanı</title>
<style>
  :root { color-scheme: light dark; }
  body {
    font-family: -apple-system, system-ui, sans-serif;
    max-width: 640px;
    margin: 0 auto;
    padding: 1.5rem;
    background: #0b0f19;
    color: #e6e8ee;
  }
  h1 { font-size: 1.1rem; font-weight: 600; color: #9aa4bf; }
  #log {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    min-height: 50vh;
    margin-bottom: 1rem;
  }
  .msg { padding: 0.6rem 0.9rem; border-radius: 10px; max-width: 85%; white-space: pre-wrap; line-height: 1.4; }
  .user { align-self: flex-end; background: #2f6feb; color: white; }
  .agent { align-self: flex-start; background: #1c2333; color: #e6e8ee; }
  form { display: flex; gap: 0.5rem; }
  input { flex: 1; padding: 0.7rem; border-radius: 8px; border: 1px solid #2a3350; background: #131829; color: #e6e8ee; }
  button { padding: 0.7rem 1.1rem; border-radius: 8px; border: none; background: #2f6feb; color: white; font-weight: 600; cursor: pointer; }
  button:disabled { opacity: 0.5; cursor: default; }
</style>
</head>
<body>
  <h1>T.C. Kimlikli Yapay Zekâ Ajanı — Web Kanalı</h1>
  <div id="log"></div>
  <form id="chat-form">
    <input id="chat-input" autocomplete="off" placeholder="Bir mesaj yaz..." />
    <button type="submit">Gönder</button>
  </form>
<script>
  const log = document.getElementById('log');
  const form = document.getElementById('chat-form');
  const input = document.getElementById('chat-input');
  const button = form.querySelector('button');

  let sessionId = localStorage.getItem('sessionId');
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem('sessionId', sessionId);
  }

  function addMessage(role, text) {
    const el = document.createElement('div');
    el.className = 'msg ' + role;
    el.textContent = text;
    log.appendChild(el);
    el.scrollIntoView({ behavior: 'smooth', block: 'end' });
    return el;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const message = input.value.trim();
    if (!message) return;
    input.value = '';
    button.disabled = true;
    addMessage('user', message);
    const thinking = addMessage('agent', '...');
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, message }),
      });
      const data = await res.json();
      thinking.textContent = data.reply || 'Bir hata oluştu.';
    } catch (err) {
      thinking.textContent = 'Bağlantı hatası: ' + err;
    } finally {
      button.disabled = false;
      input.focus();
    }
  });
</script>
</body>
</html>`;
