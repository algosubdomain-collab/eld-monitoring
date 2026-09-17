/**
 * KPI kartalar va ular ochadigan sahifalar shu yerda ta'riflanadi.
 * Yangi kategoriya qo'shish uchun shu ro'yxatga bitta yozuv qo'shsangiz kifoya —
 * karta ham, sahifa ham, marshrut ham o'zi paydo bo'ladi.
 */
export const CATEGORIES = [
  {
    slug: 'driving',
    title: 'Driving',
    blurb: 'Drivers currently moving on the road',
    color: 'var(--lime)',
    tone: 'lime',
    count: (s) => s.byStatus.driving,
    match: (d) => d.status === 'driving',
  },
  {
    slug: 'on-duty',
    title: 'On duty',
    blurb: 'Working but not driving — loading, inspection, paperwork',
    color: 'var(--amber)',
    tone: 'amber',
    count: (s) => s.byStatus.on_duty,
    match: (d) => d.status === 'on_duty',
  },
  {
    slug: 'resting',
    title: 'Resting',
    blurb: 'Off duty or in the sleeper berth',
    color: 'var(--violet)',
    count: (s) => s.byStatus.sleeper + s.byStatus.off_duty,
    sub: (s) => `${s.byStatus.sleeper} sleeper · ${s.byStatus.off_duty} off duty`,
    match: (d) => d.status === 'sleeper' || d.status === 'off_duty',
  },
  {
    slug: 'violations',
    title: 'Violations',
    blurb: 'Open HOS violations that need attention',
    color: 'var(--red)',
    tone: 'red',
    count: (s) => s.violationCount,
    match: (d) => d.violations.length > 0,
    // KPI raqami — buzilishlar soni, sahifadagi qatorlar esa haydovchilar.
    // Ikkalasi har xil bo'lgani uchun sahifada ikkalasini ham ko'rsatamiz.
    note: (rows) =>
      `${rows.reduce((n, d) => n + d.violations.length, 0)} violations across ${rows.length} drivers`,
  },
  {
    slug: 'under-1h',
    title: 'Under 1h',
    blurb: 'Less than one hour of driving time left',
    color: 'var(--amber)',
    tone: 'amber',
    count: (s) => s.lowHours,
    sub: () => 'drive time left',
    match: (d) => d.driveRemainingMin != null && d.driveRemainingMin < 60,
  },
  {
    slug: 'offline',
    title: 'ELD disconnected',
    blurb: 'ELD device is not connected',
    color: 'var(--red)',
    tone: 'red',
    count: (s) => s.offline,
    sub: () => 'ELD not connected',
    match: (d) => d.eldConnected === false,
  },
];

export const findCategory = (slug) => CATEGORIES.find((c) => c.slug === slug);
