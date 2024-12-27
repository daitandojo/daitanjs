const isEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const fetchData = async (url, method, data) => {
  try {
    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`Error during fetch to ${url}:`, error.message);
    throw error;
  }
};

const isExistingUser = async (email) => {
  if (!isEmail(email)) return { result: false };
  try {
    const users = await getUsers({ email });
    console.log(`Checking: "${email}" is ${users.length ? "" : "not"} an existing user.`);
    return { result: users.length > 0 };
  } catch (error) {
    console.error("Error checking existing user:", error.message);
    throw error;
  }
};

const getUsers = async (filter = {}) => {
  console.log("Getting users for:", filter);
  try {
    const url = "/api/users/get";
    const users = await fetchData(url, "POST", filter);
    console.log(`${users.length} users found`, users);
    return users;
  } catch (error) {
    console.error("Error fetching users:", error.message);
    throw error;
  }
};

const getUser = async (filter) => {
  try {
    const users = await getUsers(filter);
    return users.length > 0 ? users[0] : null;
  } catch (error) {
    console.error("Error fetching user:", error.message);
    return null;
  }
};

const createUserInDB = async (newUser) => {
  try {
    const url = "/api/users/create";
    const createdUser = await fetchData(url, "POST", newUser);
    console.log("User created:", createdUser);
    return createdUser;
  } catch (error) {
    console.error("Error creating user in DB:", error.message);
    throw error;
  }
};

const updateUserInDB = async (userToSave) => {
  try {
    const url = "/api/users/update";
    const updatedUser = await fetchData(url, "POST", userToSave);
    console.log("User updated:", updatedUser);
    return updatedUser;
  } catch (error) {
    console.error("Error updating user in DB:", error.message);
    throw error;
  }
};

export {
  isExistingUser,
  getUser,
  getUsers,
  createUserInDB,
  updateUserInDB
};
