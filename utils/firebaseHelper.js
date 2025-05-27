// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";

export const getFirebaseApp = () => {
    // TODO: Add SDKs for Firebase products that you want to use
    // https://firebase.google.com/docs/web/setup#available-libraries

    // Your web app's Firebase configuration
    // For Firebase JS SDK v7.20.0 and later, measurementId is optional
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
    
    // Initialize Firebase
    return initializeApp(firebaseConfig);
}