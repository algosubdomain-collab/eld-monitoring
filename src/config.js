// Barcha sozlamalar shu yerda. Maxfiy ma'lumotlar (login/parol/token)
// kodda emas, muhit o'zgaruvchilarida (env) turadi.
export const config = {
  port: Number(process.env.PORT ?? 3000),
  // 0.0.0.0 — bir tarmoqdagi boshqa qurilmalar ham kira oladi.
  host: process.env.HOST ?? '0.0.0.0',

  // Qaysi manbadan ma'lumot olinadi: src/sources/ ichidagi fayl nomi.
  // URL berilgach bu yerga haqiqiy manba nomi yoziladi.
  source: process.env.ELD_SOURCE ?? 'sample',

  // Ma'lumot necha soniyada bir yangilanadi (server tomonda kesh).
  refreshSeconds: Number(process.env.ELD_REFRESH_SECONDS ?? 60),

  // Manba uchun kirish ma'lumotlari (env orqali beriladi).
  credentials: {
    baseUrl: process.env.ELD_BASE_URL ?? '',
    apiKey: process.env.ELD_API_KEY ?? '',
    username: process.env.ELD_USERNAME ?? '',
    password: process.env.ELD_PASSWORD ?? '',
    cookie: process.env.ELD_COOKIE ?? '',
  },
};
