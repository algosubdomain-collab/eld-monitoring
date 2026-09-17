import { useToast } from '../lib/toast.jsx';

/**
 * Haydovchi ismi. Sichqonchaning o'ng tugmasi bosilganda brauzer menyusi
 * o'rniga ism nusxalanadi.
 */
export default function DriverName({ name }) {
  const { copy } = useToast();
  return (
    <span
      className="nm copyable"
      title="Right-click to copy the name"
      onContextMenu={(e) => { e.preventDefault(); copy(name); }}
    >
      {name}
    </span>
  );
}
