# Gemini Runner

A dual-phase endless runner: a 3D Temple-Run-style dash through levels 1-5, then a 3D space shooter for levels 6-10 aboard a purchased aircraft. Built with React, Three.js/@react-three/fiber, Zustand, and Firebase (global leaderboard).

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`
2. Run the app:
   `npm run dev`
3. Build for production:
   `npm run build`

## Firebase

The global leaderboard reads/writes to Firestore using the config in `firebase-applet-config.json`. Players are signed in anonymously on first submit (see `firebase.ts`); no API key or `.env` setup is required to run the game locally.
