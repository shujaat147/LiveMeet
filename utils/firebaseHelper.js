import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

let app;

export const getFirebaseApp = () => {
    if (app) return app;
    // Your Firebase config
    const firebaseConfig = {
        apiKey: "AIzaSyDcqJZNzF2UmBl8V7zoTVsGohUGCfw44y4",
        authDomain: "livemeet-669d1.firebaseapp.com",
        databaseURL: "https://livemeet-669d1-default-rtdb.firebaseio.com",
        projectId: "livemeet-669d1",
        storageBucket: "livemeet-669d1.firebasestorage.app",
        messagingSenderId: "306921595143",
        appId: "1:306921595143:web:69ce27c04c50a7262ba5a2",
        measurementId: "G-ZDC5F2RKL5"
    };
    app = initializeApp(firebaseConfig);
    return app;
};

// --- ADD THIS: ---
export const auth = getAuth(getFirebaseApp());