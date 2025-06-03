import { child, get, getDatabase, push, ref, remove, set, update } from "firebase/database";
import { getFirebaseApp } from "../firebaseHelper";
import { getUserPushTokens } from "./authActions";
import { addUserChat, deleteUserChat, getUserChats } from "./userActions";
import { removeMessage } from "../../store/messagesSlice";

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
    for (let i = 0; i < chatUsers.length; i++) {
        const userId = chatUsers[i];
        await push(child(dbRef, `userChats/${userId}`), newChat.key);
    }

    return newChat.key;
};

export const sendTextMessage = async (chatId, senderData, messageText, replyTo, chatUsers) => {
    await sendMessage(chatId, senderData.userId, messageText, null, replyTo, null);

    const otherUsers = chatUsers.filter(uid => uid !== senderData.userId);
    await sendPushNotificationForUsers(otherUsers, `${senderData.firstName} ${senderData.lastName}`, messageText, chatId);
};

export const sendInfoMessage = async (chatId, senderId, messageText) => {
    await sendMessage(chatId, senderId, messageText, null, null, "info");
};

export const sendImage = async (chatId, senderData, imageUrl, replyTo, chatUsers) => {
    await sendMessage(chatId, senderData.userId, 'Image', imageUrl, replyTo, null);

    const otherUsers = chatUsers.filter(uid => uid !== senderData.userId);
    await sendPushNotificationForUsers(otherUsers, `${senderData.firstName} ${senderData.lastName}`, `${senderData.firstName} sent an image`, chatId);
};

export const updateChatData = async (chatId, userId, chatData) => {
    const app = getFirebaseApp();
    const dbRef = ref(getDatabase(app));
    const chatRef = child(dbRef, `chats/${chatId}`);

    await update(chatRef, {
        ...chatData,
        updatedAt: new Date().toISOString(),
        updatedBy: userId
    });
};

const sendMessage = async (chatId, senderId, messageText, imageUrl, replyTo, type) => {
    const app = getFirebaseApp();
    const dbRef = ref(getDatabase());
    const messagesRef = child(dbRef, `messages/${chatId}`);

    const messageData = {
        sentBy: senderId,
        sentAt: new Date().toISOString(),
        text: messageText
    };

    if (replyTo) {
        messageData.replyTo = replyTo;
    }

    if (imageUrl) {
        messageData.imageUrl = imageUrl;
    }

    if (type) {
        messageData.type = type;
    }

    await push(messagesRef, messageData);

    const chatRef = child(dbRef, `chats/${chatId}`);
    await update(chatRef, {
        updatedBy: senderId,
        updatedAt: new Date().toISOString(),
        latestMessageText: messageText
    });

    // ✅ Ensure all users still have this chat in their userChats list
    const chatSnapshot = await get(chatRef);
    if (chatSnapshot.exists()) {
        const chatData = chatSnapshot.val();
        for (const uid of chatData.users) {
            const userChatsRef = child(dbRef, `userChats/${uid}`);
            const userChatsSnap = await get(userChatsRef);
            const alreadyHasChat = userChatsSnap.exists() && Object.values(userChatsSnap.val()).includes(chatId);
            if (!alreadyHasChat) {
                await push(userChatsRef, chatId);
            }
        }
    }
};

export const starMessage = async (messageId, chatId, userId) => {
    try {
        const app = getFirebaseApp();
        const dbRef = ref(getDatabase(app));
        const childRef = child(dbRef, `userStarredMessages/${userId}/${chatId}/${messageId}`);

        const snapshot = await get(childRef);

        if (snapshot.exists()) {
            await remove(childRef);
        } else {
            const starredMessageData = {
                messageId,
                chatId,
                starredAt: new Date().toISOString()
            };
            await set(childRef, starredMessageData);
        }
    } catch (error) {
        console.log(error);
    }
};

export const unsendMessage = ({ chatId, messageId }) => {
    return async (dispatch) => {
        try {
            const app = getFirebaseApp();
            const db = getDatabase(app);

            const msgRef = ref(db, `messages/${chatId}/${messageId}`);
            await remove(msgRef);

            dispatch(removeMessage({ chatId, messageId }));

            const messagesSnap = await get(ref(db, `messages/${chatId}`));
            const messagesData = messagesSnap.val();

            let latestText = "";

            if (messagesData) {
                const sorted = Object.entries(messagesData).sort((a, b) =>
                    new Date(a[1].sentAt) - new Date(b[1].sentAt)
                );

                const lastMsg = sorted[sorted.length - 1][1];
                latestText =
                    lastMsg.text ||
                    (lastMsg.imageUrl ? "Image" : lastMsg.audioUrl ? "Voice Message" : "Message");
            }

            await update(ref(db, `chats/${chatId}`), {
                latestMessageText: latestText,
                updatedAt: new Date().toISOString()
            });
        } catch (error) {
            console.log("Unsend failed:", error);
        }
    };
};

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

    await sendInfoMessage(chatData.key, userLoggedInData.userId, messageText);
};

export const addUsersToChat = async (userLoggedInData, usersToAddData, chatData) => {
    const existingUsers = Object.values(chatData.users);
    const newUsers = [];

    let userAddedName = "";

    usersToAddData.forEach(async userToAdd => {
        const userToAddId = userToAdd.userId;

        if (existingUsers.includes(userToAddId)) return;

        newUsers.push(userToAddId);

        await addUserChat(userToAddId, chatData.key);

        userAddedName = `${userToAdd.firstName} ${userToAdd.lastName}`;
    });

    if (newUsers.length === 0) return;

    await updateChatData(chatData.key, userLoggedInData.userId, { users: existingUsers.concat(newUsers) });

    const moreUsersMessage = newUsers.length > 1 ? `and ${newUsers.length - 1} others ` : '';
    const messageText = `${userLoggedInData.firstName} ${userLoggedInData.lastName} added ${userAddedName} ${moreUsersMessage}to the chat`;
    await sendInfoMessage(chatData.key, userLoggedInData.userId, messageText);
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
            });
        }
    });
};
