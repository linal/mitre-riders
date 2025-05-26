// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBW72KiOT4TYXx8tbTQA2g1GjRMA4-yJ3k",
  authDomain: "mitre-riders.firebaseapp.com",
  projectId: "mitre-riders",
  storageBucket: "mitre-riders.firebasestorage.app",
  messagingSenderId: "701709492859",
  appId: "1:701709492859:web:00f2529f28b096f94038de"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export default app;