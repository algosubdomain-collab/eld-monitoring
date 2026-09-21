// Telegram'ga xabar yuborish. Sozlamalar har bir foydalanuvchiga tegishli
// (src/connections.js), shuning uchun ular argument sifatida uzatiladi.
const API = 'https://api.telegram.org';

// Vaqtinchalik xatolarda (tarmoq, 429, 5xx) shuncha marta qayta urinamiz.
const SEND_RETRIES = 5;
const MAX_WAIT_MS = 60_000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Yuborish xatosi. transient — keyinroq qayta urinish mumkin (tarmoq, 429,
 * 5xx); aks holda doimiy (bot guruhdan chiqarilgan, chat topilmadi...).
 */
export class TelegramError extends Error {
  constructor(message, { transient = false } = {}) {
    super(message);
    this.name = 'TelegramError';
    this.transient = transient;
  }
}

/** Bitta chaqiruv; vaqtinchalik xatolarda kutib qayta urinadi. */
async function call(botToken, method, makeBody, { retries = SEND_RETRIES } = {}) {
  for (let attempt = 0; ; attempt += 1) {
    let error;
    try {
      // FormData bir marta ishlatiladi — har urinishda yangisini yasaymiz.
      const init = makeBody();
      const res = await fetch(`${API}/bot${botToken}/${method}`, { method: 'POST', ...init });
      const body = await res.json().catch(() => null);
      if (body?.ok) return body.result;

      const transient = res.status === 429 || res.status >= 500;
      error = new TelegramError(`Telegram: ${body?.description ?? res.status}`, { transient });
      if (!transient) throw error;
      // 429 da Telegram qancha kutish kerakligini o'zi aytadi.
      error.waitMs = (body?.parameters?.retry_after ?? 0) * 1000;
    } catch (err) {
      if (err instanceof TelegramError && !err.transient) throw err;
      error ??= new TelegramError(`Telegram: ${err.message}`, { transient: true });
    }

    if (attempt >= retries) throw error;
    const backoff = Math.min(2000 * 2 ** attempt, MAX_WAIT_MS);
    await sleep(Math.min(Math.max(error.waitMs ?? 0, backoff), MAX_WAIT_MS));
  }
}

export async function sendMessage({ botToken, chatId }, text, { silent = false, replyTo, retries } = {}) {
  if (!botToken || !chatId) throw new TelegramError('Telegram sozlanmagan');

  return call(botToken, 'sendMessage', () => ({
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      disable_notification: silent,
      ...(replyTo ? { reply_parameters: { message_id: replyTo, allow_sending_without_reply: true } } : {}),
    }),
  }), { retries });
}

/** Rasm + izoh yuboradi. Izoh Telegram cheklovi bo'yicha 1024 belgigacha. */
export async function sendPhoto({ botToken, chatId }, png, caption, { replyTo, silent = false, retries } = {}) {
  if (!botToken || !chatId) throw new TelegramError('Telegram sozlanmagan');

  return call(botToken, 'sendPhoto', () => {
    const form = new FormData();
    form.append('chat_id', String(chatId));
    form.append('caption', caption.slice(0, 1024));
    form.append('parse_mode', 'HTML');
    form.append('disable_notification', String(silent));
    if (replyTo) {
      form.append('reply_parameters', JSON.stringify({ message_id: replyTo, allow_sending_without_reply: true }));
    }
    form.append('photo', new Blob([png], { type: 'image/png' }), 'driver.png');
    return { body: form };
  }, { retries });
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
