// Telegram'ga xabar yuborish. Sozlamalar har bir foydalanuvchiga tegishli
// (src/connections.js), shuning uchun ular argument sifatida uzatiladi.
const API = 'https://api.telegram.org';

export async function sendMessage({ botToken, chatId }, text, { silent = false } = {}) {
  if (!botToken || !chatId) throw new Error('Telegram sozlanmagan');

  const res = await fetch(`${API}/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      disable_notification: silent,
    }),
  });

  const body = await res.json().catch(() => null);
  if (!body?.ok) throw new Error(`Telegram: ${body?.description ?? res.status}`);
  return body.result;
}

/** Rasm + izoh yuboradi. Izoh Telegram cheklovi bo'yicha 1024 belgigacha. */
export async function sendPhoto({ botToken, chatId }, png, caption) {
  if (!botToken || !chatId) throw new Error('Telegram sozlanmagan');

  const form = new FormData();
  form.append('chat_id', String(chatId));
  form.append('caption', caption.slice(0, 1024));
  form.append('parse_mode', 'HTML');
  form.append('photo', new Blob([png], { type: 'image/png' }), 'driver.png');

  const res = await fetch(`${API}/bot${botToken}/sendPhoto`, { method: 'POST', body: form });
  const body = await res.json().catch(() => null);
  if (!body?.ok) throw new Error(`Telegram: ${body?.description ?? res.status}`);
  return body.result;
}

/** Bot haqiqiyligini tekshiradi va nomini qaytaradi. */
export async function getBot(botToken) {
  const body = await fetch(`${API}/bot${botToken}/getMe`).then((r) => r.json());
  if (!body?.ok) throw new Error(body?.description ?? 'Invalid bot token');
  return body.result;
}

/** Guruhni ID bo'yicha tekshiradi — bot u yerda bo'lmasa xato beradi. */
export async function getChat(botToken, chatId) {
  const body = await fetch(`${API}/bot${botToken}/getChat?chat_id=${encodeURIComponent(chatId)}`)
    .then((r) => r.json());
  if (!body?.ok) {
    throw new Error(`Group ${chatId} not reachable — make sure the bot is a member (${body?.description ?? 'unknown error'})`);
  }
  const c = body.result;
  return { id: c.id, type: c.type, title: c.title ?? c.username ?? c.first_name ?? String(c.id) };
}

/**
 * Bot qaysi guruhlarga qo'shilgan — chat_id ni topish uchun.
 * DIQQAT: privacy mode yoqilgan botga guruhdagi oddiy xabarlar kelmaydi,
 * faqat /buyruqlar va @eslatmalar. Hodisalar ham 24 soat saqlanadi.
 */
export async function listChats(botToken) {
  const body = await fetch(`${API}/bot${botToken}/getUpdates`).then((r) => r.json());
  if (!body?.ok) throw new Error(body?.description ?? 'Could not read updates');

  const chats = new Map();
  for (const u of body.result ?? []) {
    const msg = u.message ?? u.my_chat_member ?? u.channel_post ?? {};
    if (msg.chat) chats.set(msg.chat.id, msg.chat);
  }
  return [...chats.values()].map((c) => ({
    id: c.id,
    type: c.type,
    title: c.title ?? c.username ?? c.first_name ?? String(c.id),
  }));
}
