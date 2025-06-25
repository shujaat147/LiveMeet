import { createSelector } from 'reselect';

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
