# Облачное сохранение (Firebase)

Проект Firebase: `prep-b72a9`, тариф Spark (бесплатный). Код: `src/lib/cloud.svelte.ts`.

## Вход
- **Ссылка на почту** (основной): любая почта, включая iCloud, без пароля. Firebase → Authentication → Sign-in method →
  Email/Password + «Email link (passwordless sign-in)». Письмо открывать на том же устройстве и в том же браузере,
  где открыт сайт (встроенный браузер почтового приложения — другое хранилище).
- Google — запасной.
- Apple — возможен, но нужен Apple Developer Program ($99/год).

Проверено 27.09.2026: вход по почте, запись и чтение своих данных — работает; чужие данные и запись без входа —
отказ (PERMISSION_DENIED).

## Что где лежит
- `users/{uid}` — сохранение без истории ответов (строка JSON) и `updatedAt`.
- `users/{uid}/attempts/{ГГГГ-ММ}` — история ответов по месяцам (у документа Firestore предел 1 МБ).
- Конфликт двух устройств: побеждает копия с более поздним `updatedAt`; проигравшая остаётся в браузере
  (`localStorage` → `razlom.save.v1.before-replace`).
- Analytics не подключён: для детского приложения сбор статистики не нужен.

## Правила Firestore (Firestore Database → Rules → вставить → Publish)
Каждый вошедший видит и меняет только свои данные.

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

## Разрешённые домены (Authentication → Settings → Authorized domains)
- `localhost` — есть по умолчанию.
- `suulliish.github.io` — добавить, когда сайт будет выложен на GitHub Pages.

## Ключ API
`apiKey` в конфиге — не секрет: он есть в коде любого сайта на Firebase, доступ к данным закрывают правила.
Дополнительно можно ограничить ключ: Google Cloud Console → APIs & Services → Credentials → ключ «Browser key» →
Application restrictions: Websites → `https://suulliish.github.io/*`, `http://localhost:*/*`.
