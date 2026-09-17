import { countdown } from '../lib/ops.js';

/**
 * "Collecting" bosqichi — ro'yxat hali yopiq, sanoq ketyapti.
 *
 * Ko'rinish: radar. Aylanuvchi nur doira bo'ylab yuradi, navbatdagi har bir
 * haydovchi doirada bitta nuqta bo'lib turadi va nur ustidan o'tganda yonadi.
 * Markazda sanoq.
 *
 * Nuqtalarning joyi indeksdan kelib chiqib hisoblanadi — har renderda bir xil
 * bo'lsin, aks holda ular har soniyada sakrab turardi.
 */
const SWEEP_SECONDS = 4;

function placeBlip(i, total) {
  // Oltin burchak — nuqtalar tekis tarqaladi, uyushib qolmaydi.
  const angle = (i * 137.508) % 360;
  const ring = 0.42 + ((i * 37) % 100) / 100 * 0.5; // 0.42..0.92 radius ulushi
  return { angle, ring };
}

export default function ScanPanel({ run, msLeft, queued }) {
  const windowMs = run.releaseMinutes * 60_000;
  const progress = Math.max(0, Math.min(100, ((windowMs - msLeft) / windowMs) * 100));
  const blips = Math.min(queued, 48);

  return (
    <div className="radarwrap" style={{ '--c': run.color, '--sweep': `${SWEEP_SECONDS}s` }}>
      <div className="radar-head">
        <span className="pulse" />Collecting · {run.title}
      </div>

      <div className="radar" aria-hidden="true">
        <span className="ring r1" /><span className="ring r2" /><span className="ring r3" />
        <span className="cross x" /><span className="cross y" />
        <span className="sweep" />

        {Array.from({ length: blips }, (_, i) => {
          const { angle, ring } = placeBlip(i, blips);
          return (
            <span
              className="contact"
              key={i}
              // Masofa radar radiusiga nisbatan hisoblanadi (CSS'dagi --size),
              // foizda berilsa nuqtaning O'Z o'lchamiga nisbatan bo'lib qolardi.
              style={{
                '--a': `${angle}deg`,
                '--ring': ring,
                animationDelay: `${(angle / 360) * SWEEP_SECONDS}s`,
              }}
            />
          );
        })}

        <span className="hub">
          <span className="hub-time mono">{countdown(msLeft)}</span>
          <span className="hub-label">until release</span>
        </span>
      </div>

      <div className="radar-foot">
        <div className="radar-sub">
          <b>{queued}</b> driver{queued === 1 ? '' : 's'} in the queue
        </div>
        <div className="radar-bar"><i style={{ width: `${progress}%` }} /></div>
      </div>
    </div>
  );
}
