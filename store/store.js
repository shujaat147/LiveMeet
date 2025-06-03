import { configureStore } from "@reduxjs/toolkit";
import thunk from "redux-thunk";

import authSlice from "./authSlice";
import chatSlice from "./chatSlice";
import messagesSlice from "./messagesSlice";
import userSlice from "./userSlice";

export const store = configureStore({
    reducer: {
        auth: authSlice,
        users: userSlice,
        chats: chatSlice,
        messages: messagesSlice
    },
    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({
            thunk: true,
            serializableCheck: false, // optional: disables warnings about unserializable values like audio files
        }),
});