import React from "react";
import { FlatList } from "react-native";
import Bubble from "./Bubble";
console.log('Rendering ChatMessages')

// Memoized component, only re-renders if props.messages or others change
const ChatMessages = React.memo(
 ({
  messages,
  renderItem,
  flatListRef,
  onContentSizeChange,
  onLayout,
 }) => (
  <FlatList
   ref={flatListRef}
   data={messages}
   renderItem={renderItem}
   keyExtractor={item => item.key}
   onContentSizeChange={onContentSizeChange}
   onLayout={onLayout}
  />
 )
);

export default ChatMessages;
