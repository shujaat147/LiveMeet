import { child, get, getDatabase, push, ref, remove, set, update } from "firebase/database";
import { getFirebaseApp } from "../firebaseHelper";
import { getUserPushTokens } from "./authActions";
import { addUserChat, deleteUserChat, getUserChats } from "./userActions";
import { detectLanguage, translateText } from "../translateHelper";

export const createChat = async (loggedInUserId, chatData) => {
    const newChatData = {
        ...chatData,
        chatName: chatData.chatName ?? null,
        createdBy: loggedInUserId,
        updatedBy: loggedInUserId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    const app = getFirebaseApp();
    const dbRef = ref(getDatabase(app));
    const newChat = await push(child(dbRef, 'chats'), newChatData);

    const chatUsers = newChatData.users;

    // ✅ Run all userChat push operations in parallel
    await Promise.all(
        chatUsers.map(userId =>
            push(child(dbRef, `userChats/${userId}`), newChat.key)
        )
    );

    return newChat.key;
};

export const sendTextMessage = async (chatId, senderData, messageText, replyTo, chatUsers) => {
    await sendMessage(chatId, senderData, messageText, null, replyTo, null);

    const otherUsers = chatUsers.filter(uid => uid !== senderData.userId);
    await sendPushNotificationForUsers(otherUsers, `${senderData.firstName} ${senderData.lastName}`, messageText, chatId);
}

export const sendInfoMessage = async (chatId, senderData, messageText) => {
    await sendMessage(chatId, senderData, messageText, null, null, "info");
}

export const sendImage = async (chatId, senderData, imageUrl, replyTo, chatUsers) => {
    await sendMessage(chatId, senderData, 'Image', imageUrl, replyTo, null);

    const otherUsers = chatUsers.filter(uid => uid !== senderData.userId);
    await sendPushNotificationForUsers(otherUsers, `${senderData.firstName} ${senderData.lastName}`, `${senderData.firstName} sent an image`, chatId);
}

export const updateChatData = async (chatId, userId, chatData) => {
    const app = getFirebaseApp();
    const dbRef = ref(getDatabase(app));
    const chatRef = child(dbRef, `chats/${chatId}`);

    await update(chatRef, {
        ...chatData,
        updatedAt: new Date().toISOString(),
        updatedBy: userId
    })
}

const sendMessage = async (chatId, senderData, messageText, imageUrl, replyTo, type) => {
    const app = getFirebaseApp();
    const db = getDatabase(app);
    const dbRef = ref(db);
    const messagesRef = child(dbRef, `messages/${chatId}`);

    // 1. Detect language of the message
    const detectedLang = await detectLanguage(messageText);
    let translatedText = null;

    // 2. Get chat users to determine recipient
    const chatSnapshot = await get(child(dbRef, `chats/${chatId}`));
    const chatUsers = chatSnapshot.val()?.users || [];

    // 3. Determine recipientId (someone other than sender)
    const recipientId = chatUsers.find(uid => uid !== senderData.userId);

    // 4. Get recipient's language preference
    let recipientLang = null;
    if (recipientId) {
        const recipientSnapshot = await get(child(dbRef, `users/${recipientId}`));
        recipientLang = recipientSnapshot.val()?.preferredLanguage;
    }

    // 5. Perform translation only if needed
    if (
        recipientLang &&
        recipientLang !== "no_translation" &&
        recipientLang !== detectedLang
    ) {
        translatedText = await translateText(messageText, recipientLang);
    }

    // 6. Construct and push the message
    const messageData = {
        sentBy: senderData.userId,
        sentAt: new Date().toISOString(),
        text: messageText,
        language: detectedLang,
    };

    if (replyTo) messageData.replyTo = replyTo;
    if (imageUrl) messageData.imageUrl = imageUrl;
    if (type) messageData.type = type;

    await push(messagesRef, messageData);

    // 7. Update chat metadata
    const chatRef = child(dbRef, `chats/${chatId}`);
    await update(chatRef, {
        updatedBy: senderData.userId,
        updatedAt: new Date().toISOString(),
        latestMessageText: messageText
    });
};


export const starMessage = async (messageId, chatId, userId) => {
    try {
        const app = getFirebaseApp();
        const dbRef = ref(getDatabase(app));
        const childRef = child(dbRef, `userStarredMessages/${userId}/${chatId}/${messageId}`);

        const snapshot = await get(childRef);

        if (snapshot.exists()) {
            // Starred item exists - Un-star
            await remove(childRef);
        }
        else {
            // Starred item does not exist - star
            const starredMessageData = {
                messageId,
                chatId,
                starredAt: new Date().toISOString()
            }

            await set(childRef, starredMessageData);
        }
    } catch (error) {
        console.log(error);
    }
}

export const removeUserFromChat = async (userLoggedInData, userToRemoveData, chatData) => {
    const userToRemoveId = userToRemoveData.userId;
    const newUsers = chatData.users.filter(uid => uid !== userToRemoveId);
    await updateChatData(chatData.key, userLoggedInData.userId, { users: newUsers });

    const userChats = await getUserChats(userToRemoveId);

    for (const key in userChats) {
        const currentChatId = userChats[key];

        if (currentChatId === chatData.key) {
            await deleteUserChat(userToRemoveId, key);
            break;
        }
    }

    const messageText = userLoggedInData.userId === userToRemoveData.userId ?
        `${userLoggedInData.firstName} left the chat` :
        `${userLoggedInData.firstName} removed ${userToRemoveData.firstName} from the chat`;

    await sendInfoMessage(chatData.key, userLoggedInData, messageText);
}

export const addUsersToChat = async (userLoggedInData, usersToAddData, chatData) => {
    const existingUsers = Object.values(chatData.users);
    const newUsers = [];

    let userAddedNames = [];

    for (const userToAdd of usersToAddData) {
        const userToAddId = userToAdd.userId;

        if (existingUsers.includes(userToAddId)) continue;

        newUsers.push(userToAddId);
        userAddedNames.push(`${userToAdd.firstName} ${userToAdd.lastName}`);

        await addUserChat(userToAddId, chatData.key);
    }

    if (newUsers.length === 0) {
        return;
    }

    await updateChatData(chatData.key, userLoggedInData.userId, {
        users: existingUsers.concat(newUsers)
    });

    const addedNamesStr = userAddedNames.join(", ");
    const messageText = `${userLoggedInData.firstName} ${userLoggedInData.lastName} added ${addedNamesStr} to the chat`;

    await sendInfoMessage(chatData.key, userLoggedInData, messageText);
};

export const logCallMessage = async (chatId, senderId, statusText, status) => {
    const app = getFirebaseApp();
    const dbRef = ref(getDatabase(app));
    const messagesRef = child(dbRef, `messages/${chatId}`);

    const messageData = {
        type: "call_log",
        status,
        sentBy: senderId,
        sentAt: new Date().toISOString(),
        text: statusText
    };

    await push(messagesRef, messageData);

    const chatRef = child(dbRef, `chats/${chatId}`);
    await update(chatRef, {
        updatedBy: senderId,
        updatedAt: new Date().toISOString(),
        latestMessageText: statusText
    });
};


const sendPushNotificationForUsers = (chatUsers, title, body, chatId) => {
    chatUsers.forEach(async uid => {
        console.log("test");
        const tokens = await getUserPushTokens(uid);

        for (const key in tokens) {
            const token = tokens[key];

            await fetch("https://exp.host/--/api/v2/push/send", {
                method: "POST",
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    to: token,
                    title,
                    body,
                    data: { chatId }
                })
            })
        }
    })
}