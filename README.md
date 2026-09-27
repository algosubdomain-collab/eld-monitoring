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

## Update Dashboard — sozlamalar, responsible, boardlar

Dashboard tepasidagi **Update Dashboard** tugmasi ochadigan jadvalda har bir haydovchi
uchun qo'lda to'ldiriladigan ustunlar bor. Jadval tepasidagi **Settings** uchta bo'limdan
iborat.

**Columns** — Status va Profile Form ustunlaridagi variantlar (nom + rang). Rangni
kvadratchani bosib almashtirasiz.

Profile Form ustuni haydovchining profil formasi qay holatda ekanini belgilash uchun.
Standart variantlar: `Filled`, `Needs update`, `Sent to driver`, `No response` — ularni
o'zingizga moslab o'zgartirishingiz mumkin.

**Responsible** — mas'ullar ro'yxati va sizning ismingiz.

- Ro'yxatga odam qo'shasiz, jadvaldagi Responsible ustuni faqat shu ro'yxatdan tanlanadi.
- **Your name** — o'zingizni tanlaysiz. Shundan keyin jadval tepasidagi
  **"Assign <ism> to all"** tugmasi **bitta bosishda** ochiq boarddagi (va qidiruvga
  tushgan) barcha haydovchiga o'zingizni mas'ul qilib qo'yadi.
- Tugma yonidagi strelka boshqa mas'ulni tanlash uchun — ro'yxatdan ism bosilsa,
  u ham darhol qo'yiladi.
- **Qamrov.** Tugmaning o'zi doim ekranda ko'rinib turganlarga qo'yadi. Board yoki
  qidiruv tufayli hammasi ko'rinmayotgan bo'lsa, strelka menyusida tanlagich chiqadi:

  | Tanlov | Kimga qo'yiladi |
  |--------|-----------------|
  | `Shown 46` | faqat ochiq board va qidiruvdagilar |
  | `All drivers 100` | filtrdan qat'i nazar **barcha** faol haydovchilar |

  Filtr yo'q paytda (All boardi, qidiruv bo'sh) ikkalasi bir xil bo'lgani uchun
  tanlagich umuman chiqmaydi. Menyu har safar `Shown` dan boshlanadi — oldingi
  tanlov esda qolib, kutilmaganda hammasiga yozib yubormasin.
- Alohida haydovchiga esa o'sha qatordagi ochiladigan ro'yxatdan qo'yasiz.

**Boards** — kompaniyalarni boardlarga bo'lish.

- Board yaratasiz va unga kompaniyalarni belgilaysiz.
- Har bir board jadval tepasida tab bo'lib chiqadi, yonida haydovchilar soni bilan.
  **All** tabi hammasini ko'rsatadi.
- Bitta kompaniya bir nechta boardda bo'lishi mumkin. Hech bir boardga tushmagan
  kompaniyalar faqat **All** da ko'rinadi — sozlamalar pastida ular ro'yxati yozilib turadi.
- Board — bu ko'rinish, alohida ro'yxat emas: haydovchining qiymatlari (status, responsible,
  belgisi) qaysi boarddan qarasangiz ham bir xil.
- Tanlangan board brauzerda eslab qolinadi.

### Cycle xabarnomasi

Har bir qatorning boshida cycle qoldig'i halqa ichida soat bilan ko'rsatiladi.
Vaqt kam qolganda halqa **ustida** xabarnoma yorlig'i chiqadi:

| Qoldiq | Yorliq | Rang |
|--------|--------|------|
| 15 soatdan kam | `Open fast` | qizil |
| 25 soatdan kam | `Need open` | sariq |

Yorliqni bosasiz — yo'qoladi (masalani hal qildingiz). Haydovchi holati o'zgarib,
yana shu chegaraga tushsa, yorliq qayta chiqadi. Halqaning yoyi pastdan boshlanadi,
shuning uchun kam qolgan qoldiq yorliq ostida ko'rinmay qolmaydi.

### DOT ustuni — joylashuv va tarozilar

Status ustunidan oldingi **DOT** ustuni ikki ish qiladi.

**Joylashuv.** Nuqtani bosasiz — haydovchining hozirgi koordinatasi Google Maps'da
yangi oynada ochiladi. Kursorni olib borsangiz manzili ko'rinadi. Platforma
koordinata bermasa `—` turadi.

**Tarozi ogohlantirishi.** Haydovchining **yo'lida** 5 km ichida weigh station /
truck scale bo'lsa, nuqta qizil bo'lib yonib turadi. Tooltipda tarozi nomi va
masofasi yoziladi. **O'tib ketgandan keyin qizil o'chadi.**

Platforma haydovchining yo'nalishini bermaydi, shuning uchun u oldingi va hozirgi
nuqta orasidan hisoblanadi. Shuning uchun:

- tarozi faqat **harakat yo'nalishida** bo'lsa yonadi — orqadagisi yonmaydi;
- haydovchi turgan joyida qimirlamasa yangi ogohlantirish chiqmaydi (yo'nalish
  noma'lum), lekin yonib turgani o'chib qolmaydi;
- yo'nalishni aniqlash uchun kamida 300 metr yurgan bo'lishi kerak.

Masofani `.env` dagi `DOT_ALERT_KM` bilan o'zgartirasiz.

#### Ishlayotganini qanday tekshirasiz

```bash
npm run dot:check
```

Sozlama, kesh holati va manbaning jonli javobini ketma-ket ko'rsatadi — qaysi
bo'g'in ishlamayotgani darrov ko'rinadi. O'z yo'nalishingizdagi nuqtani berish
mumkin (kenglik, uzunlik):

```bash
npm run dot:check -- 34.27 -79.70
```

Javob shunday bo'ladi:

```
4. Manba jonli ishlayaptimi
  ok    Manba javob berdi (1168 ms, katak 68,-160)
  ok    6 ta tarozi topildi:
           0.4 km  CAT Scale  ← radius ichida
           3.1 km  CAT Scale  ← radius ichida
          10.2 km  CAT Scale
```

Buyruq faqat o'qiydi — server ishlab turganda ham xavfsiz.

#### Tarozilar bazasi qayerdan keladi

Asosiy manba — **OpenStreetMap** (bepul, API kaliti kerak emas). Har bir haydovchi
uchun har yangilanishda so'rov yuborilmaydi: hudud 0.5 darajali kataklarga bo'linib,
har bir katak **bir marta** yuklanadi va `data/scales.json` ga keshlanadi. Undan
keyin masofa hisobi butunlay serverda, tashqi so'rovsiz ketadi.

`.env` ga `GOOGLE_MAPS_API_KEY` qo'shsangiz, katak yuklanayotganda Google Places
natijalari ham qo'shiladi. Kalit shart emas — usiz ham ishlaydi.

> Google Places'da "weigh station" degan alohida tur yo'q, faqat kalit so'z bilan
> qidiriladi — natija bir xil bo'lmaydi. Shuning uchun Google asosiy emas,
> to'ldiruvchi manba sifatida ishlatiladi.

### Tekshirildi belgisi

Tartib raqamidan keyingi birinchi ustun — mas'ul haydovchini tekshirib bo'lgach
qo'yadigan belgi.

- Belgi **qo'lda olinmaguncha turadi** — avtomatik tozalanmaydi. Ustiga kursorni olib
  borsangiz kim va qachon qo'ygani ko'rinadi.
- Kim qo'ygani sifatida Settings'dagi ismingiz yoziladi (u qo'yilmagan bo'lsa — o'sha
  qatordagi responsible).
- **Shift bilan diapazon** — bitta qatorni bosasiz, so'ng pastroqdagi (yoki
  yuqoridagi) qatorni Shift bilan bosasiz: oradagi hamma qator birinchi bosilgan
  qator holatiga keltiriladi. Belgilangan qatordan boshlasangiz — diapazon
  belgilanadi, belgini olib boshlasangiz — tozalanadi. Boshlanish nuqtasi
  saqlanadi, shuning uchun diapazonni yana Shift bilan cho'zish mumkin.
  Diapazon kompaniyalar chegarasidan o'tadi, lekin **yig'ilgan guruhdagi**
  haydovchilarga tegmaydi — ko'rinmayotgan qator bexosdan belgilanmaydi.
- **Sarlavhadagi belgi** — hammasini birdan boshqaradi. Uchta holati bor: bo'sh,
  yarim (bir qismi belgilangan) va to'la. **Ikkala yo'nalish ham ikki bosishli**:
  birinchi bosishda belgi sariq savol belgisiga aylanadi va nima bo'lishini yozadi,
  ikkinchi bosish bajaradi. Bitta tasodifiy bosish bilan yuzlab haydovchi
  belgilanib yoki belgisi o'chib ketmaydi.
- Jadval tepasida **"N/M checked"** hisobi progress chizig'i bilan, har bir kompaniya
  sarlavhasida esa "3/12 checked" ko'rinadi.

Bu qiymatlar `data/board.json` va `data/board-config.json` da, har bir foydalanuvchi uchun
alohida saqlanadi.

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
| `board.json`       | Update Dashboard qatorlari (status, responsible, belgilar) |
| `board-config.json`| board sozlamalari — variantlar, mas'ullar, boardlar |
| `scales.json`      | DOT tarozilari keshi (hudud bo'yicha)          |
| `dot.json`         | haydovchilarning oxirgi nuqtasi va yo'nalishi  |

## Xavfsizlik

Ilova `http` orqali ishlaydi — tarmoq ichida parol shifrlanmagan holda uzatiladi.
Uy/ofis tarmog'ida ishlating, ochiq Wi-Fi'da emas. Faqat shu kompyuterda kerak bo'lsa,
`.env` ga `HOST=127.0.0.1` qo'ying.
