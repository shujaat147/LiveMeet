import {
  child,
  endAt,
  get,
  getDatabase,
  orderByChild,
  push,
  query,
  ref,
  remove,
  startAt,
  set
} from "firebase/database";
import { getFirebaseApp } from "../firebaseHelper";

// Get a single user's data
export const getUserData = async (userId) => {
  try {
    const app = getFirebaseApp();
    const dbRef = ref(getDatabase(app));
    const userRef = child(dbRef, `users/${userId}`);
    const snapshot = await get(userRef);
    return snapshot.val();
  } catch (error) {
    console.log(error);
  }
};

// Get all chat IDs for a user
export const getUserChats = async (userId) => {
  try {
    const app = getFirebaseApp();
    const dbRef = ref(getDatabase(app));
    const userRef = child(dbRef, `userChats/${userId}`);
    const snapshot = await get(userRef);
    return snapshot.val();
  } catch (error) {
    console.log(error);
  }
};

// Delete a single chat reference (not the chat itself)
export const deleteUserChat = async (userId, key) => {
  try {
    const app = getFirebaseApp();
    const dbRef = ref(getDatabase(app));
    const chatRef = child(dbRef, `userChats/${userId}/${key}`);
    await remove(chatRef);
  } catch (error) {
    console.log(error);
    throw error;
  }
};

// Add a chat reference to user's chat list (prevent duplicates)
export const addUserChat = async (userId, chatId) => {
  try {
    const existingChats = await getUserChats(userId);
    const isAlreadyAdded = existingChats && Object.values(existingChats).includes(chatId);

    if (!isAlreadyAdded) {
      const app = getFirebaseApp();
      const dbRef = ref(getDatabase(app));
      const chatRef = child(dbRef, `userChats/${userId}`);
      await push(chatRef, chatId);
    }
  } catch (error) {
    console.log(error);
    throw error;
  }
};

// Search users by full name (lowercase match)
export const searchUsers = async (queryText) => {
  const searchTerm = queryText.toLowerCase();

  try {
    const app = getFirebaseApp();
    const dbRef = ref(getDatabase(app));
    const userRef = child(dbRef, 'users');
    const queryRef = query(
      userRef,
      orderByChild('firstLast'),
      startAt(searchTerm),
      endAt(searchTerm + "\uf8ff")
    );

    const snapshot = await get(queryRef);
    if (snapshot.exists()) {
      return snapshot.val();
    }
    return {};
  } catch (error) {
    console.log(error);
    throw error;
  }
};

// Delete only chat reference from current user's chat list
export const deleteChatForCurrentUser = async (userId, chatId) => {
  try {
    const app = getFirebaseApp();
    const dbRef = ref(getDatabase(app));
    const userChatsRef = child(dbRef, `userChats/${userId}`);
    const snapshot = await get(userChatsRef);

    if (snapshot.exists()) {
      const userChats = snapshot.val();
      const chatEntryKey = Object.keys(userChats).find(
        key => userChats[key] === chatId
      );
      if (chatEntryKey) {
        await remove(child(userChatsRef, chatEntryKey));
      }
    }
  } catch (error) {
    console.log("Error deleting chat for current user:", error);
  }
};

// Delete entire chat and messages (used only for account cleanup)
export const deleteEntireChatForUser = async (userId, chatId) => {
  try {
    const app = getFirebaseApp();
    const db = getDatabase(app);
    const dbRef = ref(db);

    // 1. Remove chatId from userChats
    const userChatsRef = child(dbRef, `userChats/${userId}`);
    const snapshot = await get(userChatsRef);

    if (snapshot.exists()) {
      const data = snapshot.val();
      for (const key in data) {
        if (data[key] === chatId) {
          await remove(child(dbRef, `userChats/${userId}/${key}`));
          break;
        }
      }
    }

    // 2. Delete entire chat messages
    await remove(child(dbRef, `messages/${chatId}`));

    // 3. Remove chat if user was last member
    const chatRef = child(dbRef, `chats/${chatId}`);
    const chatSnapshot = await get(chatRef);

    if (chatSnapshot.exists()) {
      const chatData = chatSnapshot.val();
      const remainingUsers = chatData.users.filter(uid => uid !== userId);
      if (remainingUsers.length === 0) {
        await remove(chatRef);
      } else {
        await set(chatRef, { ...chatData, users: remainingUsers });
      }
    }
  } catch (error) {
    console.log("Error deleting entire chat for user:", error);
  }
};