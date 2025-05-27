import { child, endAt, get, getDatabase, orderByChild, push, query, ref, remove, startAt } from "firebase/database"
import { getFirebaseApp } from "../firebaseHelper";

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
}

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
}

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
}

export const addUserChat = async (userId, chatId) => {
    try {
        const app = getFirebaseApp();
        const dbRef = ref(getDatabase(app));
        const chatRef = child(dbRef, `userChats/${userId}`);

        await push(chatRef, chatId);
    } catch (error) {
        console.log(error);
        throw error;
    }
}

export const searchUsers = async (queryText) => {
    const searchTerm = queryText.toLowerCase();

    try {
        const app = getFirebaseApp();
        const dbRef = ref(getDatabase(app));
        const userRef = child(dbRef, 'users');

        const queryRef = query(userRef, orderByChild('firstLast'), startAt(searchTerm), endAt(searchTerm + "\uf8ff"));

        const snapshot = await get(queryRef);

        if (snapshot.exists()) {
            return snapshot.val();
        }

        return {};
    } catch (error) {
        console.log(error);
        throw error;
    }
}

// ✅ NEW: Delete entire chat and messages for a user (safe user-only deletion)
export const deleteEntireChatForUser = async (userId, chatId) => {
    try {
        const app = getFirebaseApp();
        const db = getDatabase(app);
        const dbRef = ref(db);

        // 1. Remove chatId from user's chat list
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

        // 2. Delete messages of that chat
        await remove(child(dbRef, `messages/${chatId}`));

        // 3. Optional: Remove chat entry from /chats if user is last person
        const chatRef = child(dbRef, `chats/${chatId}`);
        const chatSnapshot = await get(chatRef);

        if (chatSnapshot.exists()) {
            const chatData = chatSnapshot.val();
            const remainingUsers = chatData.users.filter(uid => uid !== userId);

            if (remainingUsers.length === 0) {
                await remove(chatRef);
            }
        }

    } catch (error) {
        console.log("Error deleting entire chat for user:", error);
    }
};