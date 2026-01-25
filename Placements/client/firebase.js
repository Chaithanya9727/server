import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCxfcm6ob9BgdCHS4KzOhI0UPOgPot53Sg",
  authDomain: "onestop-placements.firebaseapp.com",
  projectId: "onestop-placements",
  storageBucket: "onestop-placements.appspot.com",
  messagingSenderId: "687334530470",
  appId: "1:687334530470:web:f3fb403dd7d020c70f4367",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
