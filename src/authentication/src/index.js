import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAnalytics } from 'firebase/analytics';
import { getAuth, onAuthStateChanged, signOut as firebaseSignOut, signInWithEmailAndPassword, createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, updateEmail, updatePassword, sendPasswordResetEmail } from 'firebase/auth';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const defaultNodeFirebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID,
    measurementId: process.env.FIREBASE_MEASUREMENT_ID
};

let app;
let auth;
let db;

// Initialize Firebase if not already initialized
function initializeFirebase(firebaseConfig = defaultNodeFirebaseConfig) {
    if (!app) {
        app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
        auth = getAuth(app);
        db = getFirestore(app);
        if (typeof window !== 'undefined') {
            getAnalytics(app);
        }
    }
    return { app, auth, db };
}

// Sign in with Google popup
const googleSignIn = async () => {
    const { auth } = initializeFirebase();
    try {
        const provider = new GoogleAuthProvider();
        return await signInWithPopup(auth, provider);
    } catch (error) {
        handleFirebaseError("Google sign-in", error);
    }
};

// Email sign-up
const emailSignUp = async (email, password) => {
    const { auth } = initializeFirebase();
    const isUserLoggedIn = await isLoggedIn();
    if (isUserLoggedIn) throw new Error('User already logged in');
    try {
        return await createUserWithEmailAndPassword(auth, email, password);
    } catch (error) {
        handleFirebaseError("Email sign-up", error);
    }
};

// Email sign-in
const emailSignIn = async (email, password) => {
    const { auth } = initializeFirebase();
    try {
        return await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        if (error.code === "auth/wrong-password") {
            console.error("The provided password is incorrect.");
        } else {
            handleFirebaseError("Email sign-in", error);
        }
    }
};

// Logout
const logOut = async () => {
    const { auth } = initializeFirebase();
    try {
        await firebaseSignOut(auth);
    } catch (error) {
        handleFirebaseError("Logout", error);
    }
};

// Check if user is logged in
const isLoggedIn = () => {
    const { auth } = initializeFirebase();
    return new Promise((resolve) => {
        onAuthStateChanged(auth, (user) => {
            resolve(!!user);
        });
    });
};

// Get logged in user data
const loggedInUser = () => {
    const { auth } = initializeFirebase();
    return new Promise((resolve) => {
        onAuthStateChanged(auth, (user) => {
            resolve(user);
        });
    });
};

// List all users
const listAllUsers = async () => {
    const { db } = initializeFirebase();
    try {
        const usersCollection = collection(db, 'users');
        const userSnapshot = await getDocs(usersCollection);
        return userSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        handleFirebaseError("Listing users", error);
    }
};

// Update user email
const updateUserEmail = async (userId, newEmail) => {
    const { auth } = initializeFirebase();
    try {
        const user = await getUserFromFirestore(userId); // Adjust logic as per actual user management
        await updateEmail(user, newEmail);
    } catch (error) {
        handleFirebaseError("Updating user email", error);
    }
};

// Update user password
const updateUserPassword = async (userId, newPassword) => {
    const { auth } = initializeFirebase();
    try {
        const user = await getUserFromFirestore(userId); // Adjust logic as per actual user management
        await updatePassword(user, newPassword);
    } catch (error) {
        handleFirebaseError("Updating user password", error);
    }
};

// Send password reset link
const sendPasswordResetLink = async (email) => {
    const { auth } = initializeFirebase();
    try {
        await sendPasswordResetEmail(auth, email);
    } catch (error) {
        handleFirebaseError("Sending password reset link", error);
    }
};

// Error handler
const handleFirebaseError = (operation, error) => {
    console.error(`Error during ${operation}:`, error.message);
    throw error;
};

export {
    app,
    auth,
    db,
    initializeFirebase,
    onAuthStateChanged,
    googleSignIn,
    emailSignUp,
    emailSignIn,
    logOut,
    isLoggedIn,
    loggedInUser,
    listAllUsers,
    updateUserEmail,
    updateUserPassword,
    sendPasswordResetLink
};
