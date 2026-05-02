# Jack Posts API v2 🚀
### Telegram Storage + Firebase RTDB — بەخۆڕایی هەمیشەیی

---

## چەرا Telegram Storage؟

| | Cloudinary | Telegram |
|---|---|---|
| خۆڕایی | ✅ مانگیک | ✅ **هەمیشەیی** |
| ڤیدیۆ | ✅ | ✅ |
| وێنە | ✅ | ✅ |
| سنوور | 25GB دواتر پارە | **بێ سنوور** |
| لەناوچون | دەلەوچێت | **نەلەوچێت** |

---

## ئەرشیتێکتەر

```
بەرنامەی Android
    │
    ├─ POST /api/upload  →  بۆت Telegram → کەناڵی تایبەت (Storage)
    │                          └── file_id دەگەڕێتەوە
    │
    ├─ POST /api/posts   →  Firebase RTDB (ناونیشان + file_id)
    ├─ GET  /api/posts   →  Firebase RTDB (لیستی پۆستەکان)
    ├─ GET  /api/media?id=FILE_ID  →  Telegram (فایلی ڕاستەوخۆ)
    └─ POST /api/like    →  Firebase RTDB
```

---

## هەنگاوی یەکەم: بۆتی Telegram

١. لە Telegram بچۆ بۆ **@BotFather**
٢. بنووسە `/newbot` و ناوی بۆتت بنێ
٣. **Bot Token** کۆپی بکە  (مەسەلا: `7123456789:AAHxx...`)

---

## هەنگاوی دووەم: کەناڵی تایبەت

١. کەناڵی تایبەت نوێ دروست بکە (Private Channel)
٢. بۆتەکەت بکە **Admin** ی کەناڵەکە
٣. **Channel ID** وەربگرە:
   - بنووسە `/api/posts` لە Telegram Web
   - یان بۆتی `@username_to_id_bot` بکارهێنە
   - Channel ID بە `-100` دەست پێدەکات  (مەسەلا: `-1001234567890`)

---

## هەنگاوی سێیەم: Firebase — پڕۆژەت ئامادەیە! ✅

لە **google-services.json** ئەمانەت هەیە:
```
Project ID   : jack-9a034
Database URL : https://jack-9a034-default-rtdb.firebaseio.com
```

### Firebase RTDB Rules دابنێ (بۆ تێست):
لە Firebase Console → Realtime Database → Rules:
```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```
> ⚠️ دواتر لەگەڵ Firebase Auth دابەستە بکە

---

## هەنگاوی چوارەم: Vercel Deploy

١. ئەم فۆڵدەرە بخە GitHub
٢. لە [vercel.com](https://vercel.com) import بکە
٣. **Environment Variables** ئەمانەی تێدابخە:

```
TELEGRAM_BOT_TOKEN   = 7123456789:AAHxxxxxxxxxxxx
TELEGRAM_CHANNEL_ID  = -1001234567890
FIREBASE_DB_URL      = https://jack-9a034-default-rtdb.firebaseio.com
```

---

## API Endpoints

### ئەپلۆدی فایل
```
POST /api/upload
{
  "file": "data:image/jpeg;base64,...",
  "type": "image"   ← یان "video"
}
✅ { "success": true, "file_id": "BQACAgI...", "type": "image" }
```

### دروستکردنی پۆست
```
POST /api/posts
{
  "text":      "مەتنی پۆست",
  "fileId":    "BQACAgI...",   ← لە upload وەرگیراوە
  "thumbId":   "AAMCAg...",    ← تامبنیل (بۆ ڤیدیۆ)
  "mediaType": "image",
  "userId":    "uid_123",
  "username":  "Jack",
  "userAvatar":"BQACAgI..."
}
```

### پیشاندانی میدیا لە بەرنامە
```
وێنە:  https://your-app.vercel.app/api/media?id=FILE_ID
ڤیدیۆ: https://your-app.vercel.app/api/media?id=FILE_ID&redirect=1
```

---

**JACK MODS | @j4ck_721s**
