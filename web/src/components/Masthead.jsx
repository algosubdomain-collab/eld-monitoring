import { Truck } from './Icons.jsx';

/** Sahifa tepasidagi ixcham sarlavha — och kanvas ustida turadi. */
export default function Masthead({ live, sourceName }) {
  return (
    <div className="masthead">
      <span className="logo"><Truck /></span>
      <h1>ELD Monitoring</h1>
      <span style={{ flex: 1 }} />
      <span className={`beat ${live ? '' : 'off'}`}>
        <i />{live ? `Live · ${sourceName}` : `Demo · ${sourceName}`}
      </span>
    </div>
  );
}
