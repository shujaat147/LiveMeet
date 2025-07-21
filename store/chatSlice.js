import { createSlice } from "@reduxjs/toolkit";

const chatSlice = createSlice({
  name: "chats",
  initialState: {
    chatsData: {}
  },
  reducers: {
    setChatsData: (state, action) => {
      state.chatsData = { ...action.payload.chatsData };
    },

    // ✅ New reducer to remove a single chat locally
    removeChatData: (state, action) => {
      const chatId = action.payload;
      delete state.chatsData[chatId];
    },
    addChatData: (state, action) => {
      // action.payload must have .key (chatId) and chat object fields
      const chatId = action.payload.key;
      state.chatsData[chatId] = { ...state.chatsData[chatId], ...action.payload };
    },
  }
});

export const { setChatsData, removeChatData, addChatData } = chatSlice.actions;
export default chatSlice.reducer;