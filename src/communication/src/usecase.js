import {
  emailSignIn,
  loggedInUser,
  isLoggedIn,
  logOut,
} from './index';

export async function demonstrateFirebaseAuth() {
  try {
    console.log('Starting Firebase authentication demonstration...');
    // Check initial login state
    let loggedIn = await isLoggedIn();
    console.log('Initially logged in:', loggedIn);
    // Attempt to sign in with email and password
    const email = 'test@example.com';
    const password = 'testpassword123';
    console.log(`Attempting to sign in with email: ${email}`);
    await emailSignIn(email, password);
    // Check login state after sign-in attempt
    loggedIn = await isLoggedIn();
    console.log('Logged in after email sign-in:', loggedIn);
    if (loggedIn) {
      const user = await loggedInUser();
      console.log('Logged in user details:', user);
      // Log out
      console.log('Logging out...');
      await logOut();
      // Check login state after logout
      loggedIn = await isLoggedIn();
      console.log('Logged in after logout:', loggedIn);
    }
  } catch (error) {
    console.error('An error occurred during the demonstration:', error);
  }
}

import {
  listAllUsers,
  deleteUserById,
  updateUserEmail,
  updateUserPassword,
  sendPasswordResetLink,
} from 'daitanjs/authentication';

// Example usage:
async function manageUsers() {
  try {
    const users = await listAllUsers();
    console.log('All users:', users);

    await updateUserEmail('someUserId', 'newemail@example.com');
    await updateUserPassword('someUserId', 'newPassword123');
    await sendPasswordResetLink('user@example.com');
    await deleteUserById('someUserId');
  } catch (error) {
    console.error('Error managing users:', error);
  }
}

manageUsers();
