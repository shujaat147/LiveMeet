import { createSlice } from "@reduxjs/toolkit";

const messagesSlice = createSlice({
    name: "messages",
    initialState: {
        messagesData: {},        // { chatId: { messageId: messageObject, ... } }
        starredMessages: {}      // { messageId: messageData }
    },
    reducers: {
        setChatMessages: (state, action) => {
            const { chatId, messagesData } = action.payload;
            state.messagesData[chatId] = messagesData;
        },

        addStarredMessage: (state, action) => {
            const { starredMessageData } = action.payload;
            state.starredMessages[starredMessageData.messageId] = starredMessageData;
        },

        removeStarredMessage: (state, action) => {
            const { messageId } = action.payload;
            delete state.starredMessages[messageId];
        },

        setStarredMessages: (state, action) => {
            const { starredMessages } = action.payload;
            state.starredMessages = { ...starredMessages };
        },
    }
});

export const {
    setChatMessages,
    addStarredMessage,
    removeStarredMessage,
    setStarredMessages,
} = messagesSlice.actions;

export default messagesSlice.reducer;