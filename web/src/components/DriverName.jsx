import { useToast } from '../lib/toast.jsx';
import { useProvider } from '../lib/provider.jsx';
import { driverLogUrl } from '../lib/platform.js';

/**
 * Haydovchi ismi. Bosilganda platformadagi o'sha haydovchi log sahifasi
 * yangi oynada ochiladi. O'ng tugma bosilganda esa ism nusxalanadi.
 */
export default function DriverName({ name, driver }) {
  const { copy } = useToast();
  const provider = useProvider();
  const url = driver ? driverLogUrl(driver, provider) : null;

  const onContextMenu = (e) => { e.preventDefault(); copy(name); };

  // Platforma noma'lum bo'lsa (masalan namuna ma'lumot) — oddiy matn.
  if (!url) {
    return (
      <span className="nm copyable" title="Right-click to copy the name" onContextMenu={onContextMenu}>
        {name}
      </span>
    );
  }

  return (
    <a
      className="nm copyable link"
      href={url} target="_blank" rel="noopener noreferrer"
      title={`Open this driver's log on ${provider.name} · right-click to copy the name`}
      onContextMenu={onContextMenu}
    >
      {name}
    </a>
  );
}
