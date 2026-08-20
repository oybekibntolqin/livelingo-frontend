# Backend Integration Setup

Frontend va backend birga ishlashi uchun nima sozlash kerak.

## 1. `.env.local` faylini yarating

Loyihaning ildizida (`livelingo-frontend/`) **`.env.local`** nomli fayl yarating va quyidagini yozing:

```
VITE_API_BASE=http://localhost:8080
VITE_GOOGLE_CLIENT_ID=358897772425-XXXXXXXXX.apps.googleusercontent.com
```

`VITE_GOOGLE_CLIENT_ID` qiymatini backendning `application.properties` faylidan oling — u yerda `google.client-id=...` deb yozilgan, xuddi shu qiymatni nusxa qiling.

**Muhim:** `.env.local` ni o'zgartirgandan keyin `npm run dev` ni **to'xtatib qaytadan ishga tushiring** (Ctrl+C, keyin `npm run dev`). Vite faqat boshlanishda env'ni o'qiydi.

## 2. Google Cloud Console — JS origin'larni qo'shing

Google sign-in localhost'da ishlashi uchun:

1. https://console.cloud.google.com/apis/credentials ga o'ting
2. Loyihangizni tanlang
3. **OAuth 2.0 Client ID** ro'yxatidan o'zingiznikini bosing (yoki yangisini yarating: Application type → Web application)
4. **Authorized JavaScript origins** bo'limiga shularni qo'shing:
   - `http://localhost:5173`
   - `http://localhost:8080` (ehtiyot uchun)
5. **Save** bosing
6. 5 daqiqa kuting (Google'da yangilanish biroz vaqt oladi)

## 3. Backend'ni ishga tushiring

IDEA'da `LivelingoApplication.java` faylini Run qiling.

Konsolda `Started LivelingoApplication in X seconds` chiqsa — backend ishlamoqda.

Endi `application.properties`'da quyidagi sozlamalar **to'g'ri** ekanini tekshiring:

```properties
server.port=8080
app.allowed.origins=http://localhost:5173,http://localhost:3000
spring.datasource.url=jdbc:postgresql://localhost:5432/livelingo
```

## 4. PostgreSQL'da `livelingo` database mavjudligini tekshiring

```sql
psql -U postgres
\l
-- livelingo bo'lishi kerak
```

Yo'q bo'lsa: `CREATE DATABASE livelingo;`

## 5. Frontend'ni ishga tushiring

```powershell
npm run dev
```

`http://localhost:5173`'da ochiladi.

## 6. Sinab ko'ring

1. **Landing page** ochiladi → **"Get started"** tugmasini bosing
2. **Sign In** sahifasi → Google tugma ko'rinishi kerak. Agar **"Setup needed"** xabari chiqsa, demak `VITE_GOOGLE_CLIENT_ID` o'rnatilmagan
3. Google tugmasini bosing → Google login oynasi ochiladi → akkaunt tanlang
4. Backend'ga POST `/api/auth/google` ketadi → JWT olinadi → `localStorage`'ga saqlanadi
5. **Birinchi kirish** bo'lsa: avtomatik `/onboarding`'ga olib boradi
6. Onboarding'ni to'ldiring (har bosqichda backend'ga POST ketadi):
   - **Step 1**: `POST /api/onboarding/step1` (firstName, lastName, username, birthDate, gender, countryCode, timeZone, city)
   - **Step 2**: `POST /api/onboarding/step2` (nativeLanguageCode, learningLanguageCode)
   - **Step 3**: `POST /api/onboarding/step3` (beginner, cefrLevel, languageCode)
7. Tugagandan keyin `/dashboard` ga avtomatik o'tasiz

## Debug — nimadir ishlamasa

### Brauzer konsoli (F12 → Console)

- `Failed to fetch` yoki CORS xato — backend ishlamayapti yoki `app.allowed.origins` to'g'ri emas
- `401 Unauthorized` — JWT yo'q yoki muddati o'tgan; sign in qaytadan
- `400 Bad Request` — yuborilayotgan ma'lumot xato; Network tabda so'rov body'sini ko'ring

### Backend konsoli

- IDEA pastdagi Run terminal'ida xato ko'rinadi
- `JdbcSQLException` — PostgreSQL ishlamayapti yoki database yo'q
- `JwtException` — JWT secret xato yoki muddati o'tgan

### Test sifatida `localStorage`'ni ko'ring

Brauzer DevTools → **Application** tabi → **Local Storage** → `http://localhost:5173` → `jwt` kalit bormi?

Bor bo'lsa — sign in muvaffaqiyatli o'tgan. Yo'q bo'lsa — auth jarayonida nimadir buzilgan.

### JWT'ni manually o'chirish

Logout tugmasi Dashboard'ning yuqori o'ng burchagidagi avatarda. Bosing → "Log out" → `localStorage` tozalanadi.

Yoki konsol orqali: `localStorage.removeItem('jwt')` keyin sahifani yangilang.

## Keyingi qadamlar

Auth ishlab tursa, keyin asta-sekin shularni qilamiz:
1. Dashboard'da mock postlarni `GET /api/posts/feed` bilan almashtirish
2. Suggested users — `GET /api/users/suggested`
3. Like / comment ishlatish — `POST /api/posts/{id}/like`
4. Chat sahifasi (WebSocket bilan)
5. Boshqa sahifalar: Learn, Flashcards, Reading, Listening, Writing, CEFR test, Profile
