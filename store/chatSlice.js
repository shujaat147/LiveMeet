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
    }
  }
});

export const { setChatsData, removeChatData } = chatSlice.actions;
export default chatSlice.reducer;