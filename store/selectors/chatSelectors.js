import { createSelector } from 'reselect';

export const selectChatById = createSelector(
 [state => state.chats.chatsData, (state, chatId) => chatId],
 (chatsData, chatId) => chatsData && chatId ? chatsData[chatId] : undefined
);

export const selectStoredUsers = state => state.users.storedUsers;

export const selectStarredMessagesByChatId = createSelector(
 [state => state.messages.starredMessages, (state, chatId) => chatId],
 (starredMessages, chatId) => starredMessages[chatId] ?? {}
);

export const selectChatMessages = createSelector(
 [
  state => state.messages.messagesData,
  (_, chatId) => chatId,
 ],
 (messagesData, chatId) => {
  if (!chatId || !messagesData) return [];
  const msgs = messagesData[chatId] || {};
  return Object.keys(msgs).map(key => ({ key, ...msgs[key] }));
 }
);

export const selectUserChats = createSelector(
 [
  state => state.chats.chatsData,
  state => state.auth.userData?.userId
 ],
 (chatsData, currentUserId) => {
  if (!currentUserId || !chatsData) return [];
  const filteredChats = Object.values(chatsData).filter(chat =>
   chat.users.includes(currentUserId)
  );
  return filteredChats.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
 }
);
