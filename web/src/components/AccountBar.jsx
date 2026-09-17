/**
 * Akkaunt tugmalari — sahifaning TEPASIDA. Avval ular faqat 382 qatorli
 * jadval ostida edi va topib bo'lmasdi.
 */
export default function AccountBar({ user, onConnections, onSignOut }) {
  if (!user) return null;
  return (
    <div className="accountbar">
      <span className="who"><span className="av sm">{user.login.slice(0, 2).toUpperCase()}</span>{user.login}</span>
      <button className="btn sm" onClick={onConnections}>Connections</button>
      <button className="btn sm" onClick={onSignOut}>Sign out</button>
    </div>
  );
}
