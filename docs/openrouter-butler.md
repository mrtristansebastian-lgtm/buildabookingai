# OpenRouter Butler Setup

Build A Booking Butler uses OpenRouter from Firebase Functions. Do not put the OpenRouter key in React, `.env.local`, or any `VITE_` variable.

## Get Or Replace The Key

1. Open https://openrouter.ai/settings/keys.
2. Create a key named `Build A Booking Butler`.
3. Copy it once and keep it private.
4. If a key was shared anywhere public or semi-public, revoke it and create a fresh one.

## Set The Firebase Secret

From the repo root:

```powershell
firebase functions:secrets:set OPENROUTER_API_KEY
```

Paste the OpenRouter key when prompted. To replace the key later, run the same command again and paste the new key.

## Deploy

```powershell
firebase deploy --only functions
```

## Local Emulator Only

For local Functions emulator testing, create `functions/.secret.local`:

```env
OPENROUTER_API_KEY=your_new_openrouter_key_here
```

`functions/.secret.local` is ignored by git and must not be committed.
