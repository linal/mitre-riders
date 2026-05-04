import { initializeApp, type FirebaseApp } from 'firebase/app';

const required = (key: string): string => {
  const value = import.meta.env[key as keyof ImportMetaEnv];
  if (!value) {
    // Surface misconfiguration loudly in the browser console; auth will be
    // broken anyway, but a clear error beats a cryptic SDK failure later.
    console.error(`Missing required env var ${key}. Add it to your .env file.`);
    return '';
  }
  return value;
};

const firebaseConfig = {
  apiKey: required('VITE_FIREBASE_API_KEY'),
  authDomain: required('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: required('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: required('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: required('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: required('VITE_FIREBASE_APP_ID'),
};

const app: FirebaseApp = initializeApp(firebaseConfig);

export default app;
