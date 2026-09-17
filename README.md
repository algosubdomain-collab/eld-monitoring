# ELD Monitoring

Leader ELD va Factor ELD haydovchilarini kuzatuvchi dashboard, Telegram xabarnomasi bilan.

## Ishga tushirish

```bash
npm install
npm start
```

Server manzilini terminal yozib beradi:

```
ELD dashboard: http://localhost:3000
  tarmoqda:    http://192.168.x.x:3000   ← bir tarmoqdagi telefon/kompyuterlar uchun
```

## Standart kirish

Server ishga tushganda `admin` akkaunti bo'lmasa, avtomatik yaratiladi
(boshqa akkauntlar bor bo'lsa ham; mavjud `admin` paroliga tegilmaydi):

| Login   | Parol        |
|---------|--------------|
| `admin` | `admin12345` |

Standart qiymatlarni `.env` orqali o'zgartirish mumkin (`admin` yaratilishidan **oldin**):

```
DEFAULT_ADMIN_LOGIN=admin
DEFAULT_ADMIN_PASSWORD=admin12345
```

## Owner va foydalanuvchilar

`admin` akkaunti — **owner**. U kirganda dashboard emas, alohida **Owner panel** ochiladi.
Foydalanuvchilarni faqat owner yaratadi:

- yangi foydalanuvchi yaratish — login va parol (kamida 8 belgi);
- foydalanuvchi parolini o'zgartirish (uning sessiyalari bekor bo'ladi);
- foydalanuvchini o'chirish (uning platforma ulanishlari va Telegram sozlamasi ham o'chadi);
- har bir foydalanuvchi qaysi platformani va Telegram guruhini ulaganini ko'rish.

Owner dashboard va ulanishlar sahifasini ochmaydi. Oddiy foydalanuvchi esa user yarata olmaydi.
Foydalanuvchi kirgach o'z ELD platformasi va Telegram guruhini o'zi ulaydi.
Owner'ni o'chirib bo'lmaydi; uning parolini buyruq orqali o'zgartirasiz (pastda).

## Parolni o'zgartirish yoki tiklash

```bash
npm run user:reset -- <login> <yangi-parol>   # o'z parolingizni o'rnatish
npm run user:reset -- <login>                 # standartga (admin12345) qaytarish
```

Eski sessiyalar bekor bo'ladi. Serverni to'xtatish shart emas.

Login ko'rsatilmasa, mavjud akkauntlar ro'yxati chiqadi:

```bash
npm run user:reset
```

## Kirgandan keyin (oddiy foydalanuvchi)

1. **Connections → ELD platforms** — Leader ELD yoki Factor ELD ga ulaning.
   "Open … and sign in" tugmasi platformani ochadi, u yerda odatdagidek kiring, so'ng
   konsolga ko'rsatilgan buyruqni tashlab, natijani qaytib qo'ying. Ikkala token (access va
   refresh) birga olinadi, shuning uchun ulanish o'zi yangilanib turadi.
2. **Connections → Telegram** (ixtiyoriy) — bot tokeni, so'ng "Find my group".
   Haydovchi aloqadan uzilganda guruhga xabar keladi.

   Guruh topilmasa: botni guruhga qo'shganingizdan keyin guruhda `/start@bot_nomi` yuboring.
   Oddiy xabar yetarli emas — privacy mode yoqilgan botlarga guruhdagi oddiy xabarlar kelmaydi.
   Yoki guruh ID sini qo'lda kiriting.

Akkaunt tugmalari (Connections, Sign out) dashboard'ning tepasida.

## Uzilish xabarlari qanday ishlaydi

- Server har 2 daqiqada barcha haydovchilarni tekshiradi.
- Uzilish **ELD holati** bo'yicha aniqlanadi (platformadagi "ELD status: connected / disconnected"),
  ilovaning online/offline holati bo'yicha emas.
- Haydovchi **5 daqiqadan ko'p** uzluksiz offline tursagina guruhga xabar ketadi.
  1–2 daqiqalik qisqa uzilishlar e'tiborsiz qoladi.
- **Dam oluvchilar ro'yxati** har 12 soatda qayta tuziladi. So'nggi 24 soat davomida bitta
  statusda (Sleeper yoki Off duty) turgan haydovchilar shu ro'yxatga tushadi va ular uchun
  uzilish xabari yuborilmaydi. Haydovchi statusini o'zgartirsa, u keyingi 2 daqiqalik
  tekshiruvdayoq ro'yxatdan chiqadi.
- Server 30 daqiqadan ko'p o'chiq turgan bo'lsa, o'sha orada uzilganlar haqida xabar yuborilmaydi
  (qachon uzilgani noma'lum).

Sozlamalar `.env` da: `DISCONNECT_CONFIRM_MINUTES`, `RESTING_CHECK_HOURS`, `RESTING_MIN_HOURS`.
Ro'yxat `data/resting.json` da saqlanadi.

## Nega platformaga login/parol bilan to'g'ridan-to'g'ri ulanib bo'lmaydi

Leader ELD va Factor ELD login sahifasi reCAPTCHA bilan himoyalangan — u faqat ularning
o'z sahifasida ishlaydi. Shuning uchun platformaga o'sha yerda kirasiz va tokenni olib kelasiz.

## Ma'lumotlar

`data/` papkasida (git'ga tushmaydi):

| Fayl               | Nima                                           |
|--------------------|------------------------------------------------|
| `users.json`       | akkauntlar — parol faqat scrypt xesh ko'rinishida |
| `sessions.json`    | kirish sessiyalari                             |
| `connections.json` | platforma tokenlari va Telegram sozlamalari    |
| `notify.json`      | haydovchilarning online/offline holati         |
| `resting.json`     | dam oluvchilar ro'yxati                        |

## Xavfsizlik

Ilova `http` orqali ishlaydi — tarmoq ichida parol shifrlanmagan holda uzatiladi.
Uy/ofis tarmog'ida ishlating, ochiq Wi-Fi'da emas. Faqat shu kompyuterda kerak bo'lsa,
`.env` ga `HOST=127.0.0.1` qo'ying.
