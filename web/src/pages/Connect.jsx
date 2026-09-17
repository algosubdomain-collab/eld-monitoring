import { useEffect, useState } from 'react';
import { Truck, Plus } from '../components/Icons.jsx';

/**
 * Ulanishlar sozlash: ELD platformalari va Telegram boti.
 * Kirishdan keyin, dashboard ochilishidan oldin shu ekran chiqadi.
 * Kamida bitta platforma ulangach dashboard ochiladi.
 */
export default function Connect({ status, onChange, onReady, onSignOut, standalone }) {
  const [openProvider, setOpenProvider] = useState(null);
  const [token, setToken] = useState('');
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const [botToken, setBotToken] = useState('');
  const [chatId, setChatId] = useState('');
  const [chats, setChats] = useState(null);
  const [bot, setBot] = useState(null);
  const [tgError, setTgError] = useState(null);

  const connected = status?.providers?.filter((p) => p.connected) ?? [];

  useEffect(() => { setToken(''); setError(null); }, [openProvider]);

  /**
   * Maydonga ikki narsa qo'yilishi mumkin: yordamchi buyruq bergan JSON
   * (ikkala token) yoki oddiy access token. Ikkalasini ham qabul qilamiz.
   */
  const parseTokens = (raw) => {
    const text = raw.trim();
    try {
      const obj = JSON.parse(text);
      const access = obj.access_token ?? obj.accessToken ?? obj.token;
      if (access) {
        return { token: String(access), refreshToken: obj.refresh_token ?? obj.refreshToken ?? null };
      }
    } catch { /* oddiy token */ }
    return { token: text, refreshToken: null };
  };

  const saveToken = async (providerId) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/connections/provider', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: providerId, ...parseTokens(token) }),
      });
      const body = await res.json();
      if (body.error) throw new Error(body.error);
      onChange(body);
      setOpenProvider(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async (providerId) => {
    const res = await fetch('/api/connections/provider', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: providerId, token: null }),
    });
    onChange(await res.json());
  };

  const findChats = async (byId = false) => {
    setBusy(true);
    setTgError(null);
    try {
      const res = await fetch('/api/connections/telegram/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botToken: botToken.trim(),
          ...(byId && chatId.trim() ? { chatId: chatId.trim() } : {}),
        }),
      });
      const body = await res.json();
      if (body.error) throw new Error(body.error);
      setBot(body.bot);
      setChats(body.chats);
      if (!body.chats.length) {
        // Bot guruhda bo'lsa ham topilmasligi mumkin: privacy mode yoqilgan
        // botga oddiy xabarlar kelmaydi, faqat /buyruqlar.
        setTgError(
          `No recent messages reached the bot. In your group send /start@${body.bot.username} ` +
          '(a plain message is not enough), then press Find my group again — or enter the group ID below.'
        );
      }
    } catch (err) {
      setTgError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const saveTelegram = async (chat) => {
    setBusy(true);
    setTgError(null);
    try {
      const res = await fetch('/api/connections/telegram', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botToken: botToken.trim(), chatId: chat.id, chatTitle: chat.title }),
      });
      const body = await res.json();
      if (body.error) throw new Error(body.error);
      onChange(body);
      setChats(null);
      setBotToken('');
    } catch (err) {
      setTgError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const removeTelegram = async () => {
    const res = await fetch('/api/connections/telegram', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    onChange(await res.json());
  };

  return (
    <div className="setup">
      <div className="masthead">
        <span className="logo"><Truck /></span>
        <h1>{standalone ? 'Connections' : 'Set up your connections'}</h1>
        <span style={{ flex: 1 }} />
        {standalone
          ? <button className="btn" onClick={onReady}>Back to dashboard</button>
          : <button className="btn" onClick={onSignOut}>Sign out</button>}
      </div>

      {!standalone && (
        <p className="setuplead">
          Connect at least one ELD platform to start monitoring. The Telegram bot is
          optional — add it to get a message in your group when a driver disconnects.
        </p>
      )}

      <section className="card setupcard">
        <header>
          <div>
            <div className="eyebrow">Step 1</div>
            <h2>ELD platforms</h2>
            <p>Paste the access token from the platform you use.</p>
          </div>
        </header>

        <div className="rows">
          {(status?.providers ?? []).map((p) => (
            <div className="setuprow" key={p.id}>
              <span className={`dot ${p.connected ? 'on' : ''}`} />
              <span className="meta">
                <span className="nm">{p.name}</span>
                <span className="id">
                  {p.connected
                    ? (p.autoRenew ? 'Connected · renews automatically' : 'Connected · expires in about a day')
                    : p.expired ? 'Session expired · reconnect' : p.site}
                  {p.lastError ? ` · ${p.lastError}` : ''}
                </span>
              </span>
              <span style={{ flex: 1 }} />
              {p.connected
                ? <button className="btn" onClick={() => disconnect(p.id)}>Disconnect</button>
                : <button className="btn lime" onClick={() => setOpenProvider(p.id)}>Connect</button>}
            </div>
          ))}
        </div>

        {openProvider && (() => {
          const p = status.providers.find((x) => x.id === openProvider);
          // Ikkala tokenni birdan oladi: access qisqa muddatli, refresh esa
          // uni avtomatik yangilab turish uchun.
          const helper =
            "copy(JSON.stringify({access_token:localStorage.access_token," +
            "refresh_token:localStorage.refresh_token}))";

          const copyHelper = async () => {
            try {
              await navigator.clipboard.writeText(helper);
            } catch {
              const box = document.createElement('textarea');
              box.value = helper;
              box.style.cssText = 'position:fixed;opacity:0';
              document.body.appendChild(box);
              box.select();
              document.execCommand('copy');
              box.remove();
            }
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          };

          return (
            <div className="setupform">
              {error && <div className="gateerr">{error}</div>}

              <ol className="gatesteps tall">
                <li>
                  <button
                    type="button" className="btn lime sm"
                    onClick={() => window.open(`https://${p.site}`, '_blank', 'noopener')}
                  >
                    Open {p.name} and sign in
                  </button>
                </li>
                <li>
                  On that tab press <b>F12</b> → <b>Console</b>, then paste this and press Enter:
                  <div className="snippet">
                    <code>{helper}</code>
                    <button type="button" className="btn sm" onClick={copyHelper}>
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  It copies both tokens at once — the second one keeps the
                  connection alive so you do not have to repeat this every day.
                </li>
                <li>Come back here and paste it below.</li>
              </ol>

              <input
                className="gateinput" type="password" value={token} autoFocus
                placeholder={`Paste here — token for ${p.name}`}
                style={{ marginTop: 14 }}
                onChange={(e) => { setToken(e.target.value); setError(null); }}
              />

              <div className="acts">
                <button className="btn" onClick={() => setOpenProvider(null)}>Cancel</button>
                <button
                  className="btn lime" disabled={busy || !token.trim()}
                  onClick={() => saveToken(openProvider)}
                >
                  {busy ? 'Checking…' : 'Save'}
                </button>
              </div>

              <p className="whynopass">
                Signing in with an email and password from here is not possible —
                {' '}{p.name} protects its login with reCAPTCHA, which only works on
                their own page. That is why you sign in there and bring the token back.
              </p>
            </div>
          );
        })()}
      </section>

      <section className="card setupcard">
        <header>
          <div>
            <div className="eyebrow">Step 2 · optional</div>
            <h2>Telegram alerts</h2>
            <p>Get a message in your group the moment a driver goes offline.</p>
          </div>
        </header>

        {status?.telegram?.connected ? (
          <div className="rows">
            <div className="setuprow">
              <span className="dot on" />
              <span className="meta">
                <span className="nm">{status.telegram.chatTitle ?? 'Group'}</span>
                <span className="id">chat {status.telegram.chatId}</span>
              </span>
              <span style={{ flex: 1 }} />
              <button className="btn" onClick={removeTelegram}>Remove</button>
            </div>
          </div>
        ) : (
          <div className="setupform">
            {tgError && <div className="gateerr">{tgError}</div>}
            {bot && <div className="botline">Bot: <b>@{bot.username}</b></div>}

            <input
              className="gateinput" type="password" value={botToken}
              placeholder="Bot token from @BotFather"
              onChange={(e) => { setBotToken(e.target.value); setTgError(null); }}
            />

            {chats?.length ? (
              <div className="chatlist">
                {chats.map((c) => (
                  <button className="chatopt" key={c.id} disabled={busy}
                          onClick={() => saveTelegram(c)}>
                    <span className="n">{c.title}</span>
                    <span className="s">{c.type} · {c.id}</span>
                  </button>
                ))}
              </div>
            ) : (
              <>
                <div className="acts">
                  <button className="btn lime" disabled={busy || !botToken.trim()} onClick={() => findChats(false)}>
                    <Plus />{busy ? 'Looking…' : 'Find my group'}
                  </button>
                </div>

                {bot && (
                  <div className="manualid">
                    <input
                      className="gateinput" type="text" value={chatId}
                      placeholder="Or enter the group ID, e.g. -1001234567890"
                      onChange={(e) => { setChatId(e.target.value); setTgError(null); }}
                    />
                    <button
                      className="btn" disabled={busy || !chatId.trim()}
                      onClick={() => findChats(true)}
                    >
                      Check
                    </button>
                  </div>
                )}
              </>
            )}

            <ol className="gatesteps">
              <li>Create a bot with <b>@BotFather</b> and copy its token.</li>
              <li>Add the bot to your group.</li>
              <li>
                In the group send <b>/start@{bot?.username ?? 'your_bot'}</b> — a plain message
                does not reach bots with privacy mode on.
              </li>
              <li>Paste the token above, press <b>Find my group</b> and pick it.</li>
            </ol>
          </div>
        )}
      </section>

      {!standalone && (
        <div className="setupdone">
          <button className="btn lime wide" disabled={!connected.length} onClick={onReady}>
            {connected.length ? 'Open the dashboard' : 'Connect a platform to continue'}
          </button>
        </div>
      )}
    </div>
  );
}
