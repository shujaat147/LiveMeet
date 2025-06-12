import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ImageBackground,
  FlatList,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { HeaderButtons, Item } from "react-navigation-header-buttons";
import { useSelector } from "react-redux";

import backgroundImage from "../assets/images/droplet.png";
import colors from "../constants/colors";
import PageContainer from "../components/PageContainer";
import Bubble from "../components/Bubble";
import ReplyTo from "../components/ReplyTo";
import AwesomeAlert from "react-native-awesome-alerts";
import CustomHeaderButton from "../components/CustomHeaderButton";
import { createChat, sendImage, sendTextMessage } from "../utils/actions/chatActions";
import { launchImagePicker, openCamera, uploadImageAsync } from "../utils/imagePickerHelper";
import { initiateCall } from "../utils/actions/callActions";
import { FontAwesome } from "@expo/vector-icons";
import { Audio } from "expo-av";
import { startRecording, stopRecordingAndUpload } from "../utils/audioHelper"; // You’ll create this file
import { get, getDatabase, ref, push, set } from "firebase/database";
import { useMemo } from "react";
import { translateText } from "../utils/translateHelper";


const ChatScreen = (props) => {
  const [messageText, setMessageText] = useState("");
  const [chatId, setChatId] = useState(props.route?.params?.chatId || null);
  const [errorBannerText, setErrorBannerText] = useState("");
  const [replyingTo, setReplyingTo] = useState();
  const [tempImageUri, setTempImageUri] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingIntervalRef = useRef(null);

  const flatList = useRef();

  const userData = useSelector(state => state.auth.userData);
  const storedUsers = useSelector(state => state.users.storedUsers);
  const storedChats = useSelector(state => state.chats.chatsData);
  const [translatedMessages, setTranslatedMessages] = useState([]);
  const fallbackChatData = props.route?.params?.newChatData;

  const chatMessagesRaw = useSelector(
    useCallback(state => state.messages.messagesData[chatId] || {}, [chatId])
  );

  const chatMessages = useMemo(() => {
    return Object.keys(chatMessagesRaw).map(key => ({
      key,
      ...chatMessagesRaw[key],
    }));
  }, [chatMessagesRaw]);

  const chatData = useMemo(() => {
    return (chatId && storedChats[chatId]) || props.route?.params?.newChatData || null;
  }, [chatId, storedChats, props.route?.params?.newChatData]);

  const [chatUsers, setChatUsers] = useState([]);


  console.log("[ChatScreen] route.params:", props.route?.params);
  console.log("[ChatScreen] chatId:", props.route?.params?.chatId);
  console.log("[ChatScreen] newChatData:", props.route?.params?.newChatData);
  console.log("[ChatScreen] computed chatData:", chatData);
  console.log("[ChatScreen] chatUsers state:", chatUsers);

  useEffect(() => {
    const routeUsers = props.route?.params?.newChatData?.users;
    const fallbackUsers = chatData?.users;

    const resolvedUsers = routeUsers || fallbackUsers;

    if (Array.isArray(resolvedUsers) && resolvedUsers.length > 0) {
      console.log("[ChatScreen] Updating chatUsers from route/chatData:", resolvedUsers);
      setChatUsers(resolvedUsers);
    } else {
      console.warn("[ChatScreen] Failed to resolve chat users", { routeUsers, fallbackUsers });
    }
  }, [props.route, chatData]);




  // Automatically find chatId if only newChatData is passed
  useEffect(() => {
    if (!chatId && fallbackChatData?.users?.length) {
      const newUsersSet = new Set(fallbackChatData.users);
      const existingChat = Object.entries(storedChats).find(([id, chat]) => {
        return (
          chat.users.length === fallbackChatData.users.length &&
          chat.users.every(userId => newUsersSet.has(userId))
        );
      });

      if (existingChat) {
        console.log("Found existing chat from newChatData, setting chatId:", existingChat[0]);
        setChatId(existingChat[0]);
      }
    }
  }, [chatId, fallbackChatData, storedChats]);



  const getChatTitleFromName = () => {
    if (!Array.isArray(chatUsers)) return "Chat";

    const otherUserId = chatUsers.find(uid => uid !== userData.userId);
    const otherUserData = storedUsers?.[otherUserId];

    if (!otherUserData) {
      console.warn("[ChatScreen] Missing user data for:", otherUserId);
      return "Chat";
    }

    return `${otherUserData.firstName} ${otherUserData.lastName}`;
  };


  useEffect(() => {
    const translateMessages = async () => {
      const preferredLang = userData?.preferredLanguage;

      // Always map messages, even if no translation
      const updated = await Promise.all(
        chatMessages.map(async (msg) => {
          // Don't translate if it's own message or already in correct lang
          if (
            preferredLang &&
            preferredLang !== "no_translation" &&
            msg.sentBy !== userData.userId &&
            msg.language &&
            msg.language !== preferredLang &&
            !msg.translatedText
          ) {
            const translated = await translateText(msg.text, preferredLang);
            return { ...msg, translatedText: translated };
          }
          return msg; // Return original message
        })
      );

      setTranslatedMessages(updated);
    };

    translateMessages();
  }, [chatMessages, userData?.preferredLanguage]);


  useEffect(() => {
    if (!chatData) return;

    props.navigation.setOptions({
      headerTitle: chatData.chatName ?? getChatTitleFromName(),
      headerRight: renderHeaderRight,
    });

    if (!chatUsers || chatUsers.length === 0) {
      const usersFromRoute = props.route.params?.newChatData?.users;
      const fallbackUsers = chatData?.users;

      const resolvedUsers = usersFromRoute || fallbackUsers || [];

      if (resolvedUsers.length) {
        console.log("[ChatScreen] Resolved initial chat users:", resolvedUsers);
        setChatUsers(resolvedUsers);
      } else {
        console.warn("[ChatScreen] Unable to resolve users for chat");
      }
    }
    if (!chatData.users || !Array.isArray(chatData.users)) {
      console.warn("[ChatScreen] chatData.users is invalid:", chatData.users);
    }
    console.log("[ChatScreen] Setting chat users from chatData:", chatData.users);
  }, [chatData]);

  const sendMessage = useCallback(async () => {
    if (isSending || messageText.trim() === "") return;

    setIsSending(true);
    try {
      let id = chatId;
      let updatedChatUsers = chatUsers;
      const db = getDatabase();

      if (!id) {
        id = await createChat(userData.userId, props.route.params.newChatData);
        setChatId(id);

        // 🆕 Skip Firebase .get() — directly use what you already know
        const newChat = {
          ...props.route.params.newChatData,
          createdBy: userData.userId,
          createdAt: new Date().toISOString(),
          key: id
        };

        dispatch({
          type: "chats/setChatsData",
          payload: {
            chatsData: {
              ...storedChats,
              [id]: newChat
            }
          }
        });

        updatedChatUsers = newChat.users || [];
        setChatUsers(updatedChatUsers);
        
        if (!updatedChatUsers || updatedChatUsers.length < 2) {
          throw new Error("Group members not loaded yet.");
        }
      }

      // ✅ Use updatedChatUsers + id directly
      await sendTextMessage(id, userData, messageText, replyingTo?.key, updatedChatUsers);
      setMessageText("");
      setReplyingTo(null);
    } catch (error) {
      console.log(error);
      setErrorBannerText("Message failed to send");
      setTimeout(() => setErrorBannerText(""), 5000);
    } finally {
      setIsSending(false);
    }
  }, [messageText, chatId, isSending, chatUsers, storedChats, storedUsers, userData, replyingTo]);


  const handleVoiceRecording = async () => {
    if (!isRecording) {
      await startRecording();
      setIsRecording(true);

      // Start timer
      setRecordingDuration(0);
      recordingIntervalRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } else {
      const audioUrl = await stopRecordingAndUpload(chatId);
      setIsRecording(false);

      clearInterval(recordingIntervalRef.current);
      setRecordingDuration(0);

      if (audioUrl) {
        let id = chatId;
        if (!id) {
          id = await createChat(userData.userId, props.route.params.newChatData);
          setChatId(id);
        }

        const voiceMessage = {
          type: "audio",
          audioUrl,
          timestamp: Date.now(),
          sentBy: userData.userId,
        };

        const db = getDatabase();
        const messagesRef = ref(db, `messages/${id}`);
        const newMessageRef = push(messagesRef);
        await set(newMessageRef, voiceMessage);
      }
    }
  };

  const pickImage = useCallback(async () => {
    try {
      const tempUri = await launchImagePicker();
      if (!tempUri) return;
      setTempImageUri(tempUri);
    } catch (error) {
      console.log(error);
    }
  }, []);

  const takePhoto = useCallback(async () => {
    try {
      const tempUri = await openCamera();
      if (!tempUri) return;
      setTempImageUri(tempUri);
    } catch (error) {
      console.log(error);
    }
  }, []);

  const uploadImage = useCallback(
    async (uri) => {
      setIsLoading(true);
      try {
        let id = chatId;
        if (!id) {
          id = await createChat(userData.userId, props.route.params.newChatData);
          setChatId(id);
        }

        const uploadUrl = await uploadImageAsync(uri, true);
        await sendImage(id, userData, uploadUrl, replyingTo?.key, chatUsers);
      } catch (error) {
        console.log(error);
      } finally {
        setIsLoading(false);
      }
    },
    [chatId, userData, replyingTo, chatUsers]
  );

  useEffect(() => {
    if (!chatData || !chatUsers?.length) return;

    const otherUserId = chatUsers.find(uid => uid !== userData.userId);
    const otherUserData = storedUsers[otherUserId];

    if (otherUserData) {
      console.log("[ChatScreen] Setting header - chatId:", chatId);
      console.log("[ChatScreen] chatUsers:", chatUsers);
      console.log("[ChatScreen] storedUsers:", storedUsers);

      props.navigation.setOptions({
        headerTitle: chatData.chatName ?? `${otherUserData.firstName} ${otherUserData.lastName}`,
        headerRight: renderHeaderRight,
      });
    }
  }, [chatData, chatUsers, storedUsers]);

  const handleImagePress = (imageUrl) => {
    props.navigation.navigate('FullScreenImage', { imageUrl });
  };

  if (!chatData || !chatData.users || chatData.users.length === 0) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const renderHeaderRight = () => {
    if (!Array.isArray(chatUsers) || chatUsers.length < 2) {
      console.warn("[ChatScreen] chatUsers is invalid or incomplete:", chatUsers);
      return null;
    }

    const otherUserId = chatUsers.find(uid => uid !== userData.userId);
    const otherUserData = storedUsers[otherUserId];

    return (
      <HeaderButtons HeaderButtonComponent={CustomHeaderButton}>
        <Item
          title="Voice Call"
          iconName="call-outline"
          onPress={async () => {
            await initiateCall({
              chatId,
              callerId: userData.userId,
              receiverId: otherUserId,
            });

            props.navigation.navigate("VoiceCall", {
              chatId,
              callerData: userData,
              receiverData: otherUserData,
              isCaller: true,
            });
          }}
        />
        <Item
          title="Chat settings"
          iconName="settings-outline"
          onPress={() => {
            if (chatData?.isGroupChat) {
              // Navigate to group settings screen
              props.navigation.navigate("ChatSettings", {
                chatId,
                chatData,
                chatUsers,
              });
            } else {
              const otherUserId = chatUsers.find(uid => uid !== userData.userId);
              const otherUserData = storedUsers[otherUserId];

              if (!otherUserData) {
                console.warn("[ChatScreen] Missing user data for:", otherUserId);
                return;
              }

              props.navigation.navigate("Contact", {
                uid: otherUserId,
                userData: otherUserData,
                chatId,
              });
            }
          }}
        />
      </HeaderButtons>
    );
  };


  return (
    <SafeAreaView edges={["right", "left", "bottom"]} style={styles.container}>
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={100}
      >
        <ImageBackground source={backgroundImage} style={styles.backgroundImage}>
          <PageContainer style={{ backgroundColor: "transparent" }}>
            {!chatId && <Bubble text="This is a new chat. Say hi!" type="system" />}
            {errorBannerText !== "" && <Bubble text={errorBannerText} type="error" />}

            {chatId && (
              <FlatList
                ref={(ref) => (flatList.current = ref)}
                onContentSizeChange={() => flatList.current.scrollToEnd({ animated: false })}
                onLayout={() => flatList.current.scrollToEnd({ animated: false })}
                data={translatedMessages}
                renderItem={(itemData) => {
                  const message = itemData.item;
                  const isOwnMessage = message.sentBy === userData.userId;

                  let messageType = isOwnMessage ? "myMessage" : "theirMessage";
                  if (message.type === "info" || message.type === "call_log") {
                    messageType = "info";
                  }

                  const sender = message.sentBy && storedUsers[message.sentBy];
                  const name = sender && `${sender.firstName} ${sender.lastName}`;

                  return (
                    <Bubble
                      type={messageType}
                      text={message.text}
                      audioUrl={message.audioUrl}
                      messageId={message.key}
                      userId={userData.userId}
                      chatId={chatId}
                      date={message.sentAt}
                      name={!chatData.isGroupChat || isOwnMessage ? undefined : name}
                      setReply={() => setReplyingTo(message)}
                      replyingTo={message.replyTo && translatedMessages.find(i => i.key === message.replyTo)}
                      imageUrl={message.imageUrl}
                      onImagePress={handleImagePress}
                      translatedText={message.translatedText}
                    />
                  );
                }}
              />
            )}
          </PageContainer>

          {replyingTo && (
            <ReplyTo
              text={replyingTo.text}
              user={storedUsers[replyingTo.sentBy]}
              onCancel={() => setReplyingTo(null)}
            />
          )}
        </ImageBackground>

        <View style={styles.inputContainer}>
          <TouchableOpacity style={styles.mediaButton} onPress={pickImage}>
            <Feather name="plus" size={24} color={colors.red} />
          </TouchableOpacity>

          <TextInput
            style={styles.textbox}
            value={messageText}
            onChangeText={setMessageText}
            onSubmitEditing={() => {
              if (!isSending && chatId && chatUsers.length > 0) {
                sendMessage();
              }
            }}
          />

          {messageText === "" ? (
            <TouchableOpacity style={styles.mediaButton} onPress={takePhoto}>
              <Feather name="camera" size={24} color={colors.red} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={{ ...styles.mediaButton, ...styles.sendButton }} onPress={sendMessage}>
              <Feather name="send" size={20} color="white" />
            </TouchableOpacity>
          )}

          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <TouchableOpacity style={styles.mediaButton} onPress={handleVoiceRecording}>
              <FontAwesome name={isRecording ? "stop" : "microphone"} size={24} color={colors.red} />
            </TouchableOpacity>
            {isRecording && (
              <Text style={{ marginLeft: 6, color: colors.red }}>
                {recordingDuration}s
              </Text>
            )}
          </View>

          <AwesomeAlert
            show={tempImageUri !== ""}
            title="Send image?"
            closeOnTouchOutside={true}
            closeOnHardwareBackPress={false}
            showCancelButton={true}
            showConfirmButton={true}
            cancelText="Cancel"
            confirmText="Send image"
            confirmButtonColor={colors.primary}
            cancelButtonColor={colors.red}
            titleStyle={styles.popupTitleStyle}
            onCancelPressed={() => setTempImageUri("")}
            onConfirmPressed={async () => {
              const uri = tempImageUri;
              setTempImageUri("");
              await uploadImage(uri);
            }}
            customView={
              <View>
                {isLoading && <ActivityIndicator size="small" color={colors.primary} />}
                {!isLoading && tempImageUri !== "" && (
                  <Image source={{ uri: tempImageUri }} style={{ width: 200, height: 200 }} />
                )}
              </View>
            }
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: "column",
  },
  screen: {
    flex: 1,
  },
  backgroundImage: {
    flex: 1,
  },
  inputContainer: {
    flexDirection: "row",
    paddingVertical: 8,
    paddingHorizontal: 10,
    height: 50,
  },
  textbox: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 50,
    borderColor: colors.red,
    marginHorizontal: 15,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  mediaButton: {
    alignItems: "center",
    justifyContent: "center",
    width: 35,
  },
  sendButton: {
    backgroundColor: colors.red,
    borderRadius: 50,
    padding: 8,
  },
  popupTitleStyle: {
    fontFamily: "medium",
    letterSpacing: 0.3,
  },
});

export default ChatScreen;



