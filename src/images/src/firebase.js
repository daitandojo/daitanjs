import { getStorage, ref, uploadString, getDownloadURL } from 'firebase/storage';
import { initializeApp, getApps, getApp } from 'firebase/app';

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
  measurementId: process.env.FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase only if no instance already exists
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const storage = getStorage(app);

const uploadImageToFirebase = async (file) => {
  return new Promise(async (resolve, reject) => {
    console.log("URL OF BLOB:" + file);
    console.log("Extracting blob...");
    
    try {
      // Fetch the image as a blob
      const response = await fetch(file);
      const blob = await response.blob();

      // Convert the blob to a base64 string
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        const base64data = reader.result.split(',')[1];
        
        // Create a reference to the Firebase Storage location
        const storageRef = ref(storage, `uploads/${Date.now()}.png`);
        
        console.log("Uploading to Firebase Storage...");
        try {
          // Upload the base64 string to Firebase Storage
          await uploadString(storageRef, base64data, 'base64', { contentType: 'image/png' });

          // Get the download URL of the uploaded image
          const downloadURL = await getDownloadURL(storageRef);
          console.log("Resolving: " + downloadURL);
          resolve(downloadURL);
        } catch (uploadError) {
          console.error("Error uploading to Firebase Storage:", uploadError);
          reject(uploadError);
        }
      };
    } catch (fetchError) {
      console.error("Error fetching image:", fetchError);
      reject(fetchError);
    }
  });
};

export { uploadImageToFirebase };
