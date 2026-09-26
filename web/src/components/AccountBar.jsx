import { Link } from 'react-router-dom';

/**
 * Akkaunt tugmalari — sahifaning TEPASIDA. Bu yerda ikki bo'lim orasidagi
 * o'tish ham turadi: Monitoring → Update Dashboard.
 */
export default function AccountBar({ user, onConnections, onSignOut }) {
  if (!user) return null;
  return (
    <div className="accountbar">
      <span className="who"><span className="av sm">{user.login.slice(0, 2).toUpperCase()}</span>{user.login}</span>
      <Link className="btn sm lime" to="/updates">Go to Update Dashboard →</Link>
      <button className="btn sm" onClick={onConnections}>Connections</button>
      <button className="btn sm" onClick={onSignOut}>Sign out</button>
    </div>
  );
}
