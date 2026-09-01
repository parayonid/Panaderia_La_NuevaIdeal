// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBns2UIA_ED5CsjBMEmJxUYLqxp1PRXlGo",
  authDomain: "weblanuevaideal.firebaseapp.com",
  projectId: "weblanuevaideal",
  storageBucket: "weblanuevaideal.firebasestorage.app",
  messagingSenderId: "783648403901",
  appId: "1:783648403901:web:f52f6438c6afcf12cb62d4",
  measurementId: "G-XM65Y561VF"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);