import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  useMemo,
} from "react";
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
import {
  createChat,
  sendImage,
  sendTextMessage,
} from "../utils/actions/chatActions";
import {
  launchImagePicker,
  openCamera,
  uploadImageAsync,
} from "../utils/imagePickerHelper";
import { initiateCall } from "../utils/actions/callActions";
import { FontAwesome } from "@expo/vector-icons";
import { Audio } from "expo-av";
import { startRecording, stopRecordingAndUpload } from "../utils/audioHelper";
import { getDatabase, ref, push, set } from "firebase/database";
import { translateText } from "../utils/translateHelper";

const ChatScreen = (props) => {
  const [chatUsers, setChatUsers] = useState([]);
  const [messageText, setMessageText] = useState("");
  const routeChatId = props.route?.params?.chatId;
  const [chatId, setChatId] = useState(routeChatId);
  const [errorBannerText, setErrorBannerText] = useState("");
  const [replyingTo, setReplyingTo] = useState();
  const [tempImageUri, setTempImageUri] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingIntervalRef = useRef(null);

  const flatList = useRef();

  const userData = useSelector((state) => state.auth.userData);
  const storedUsers = useSelector((state) => state.users.storedUsers);
  const storedChats = useSelector((state) => state.chats.chatsData);
  const chatMessagesRaw = useSelector(
    (state) => state.messages.messagesData[chatId] || {}
  );

  const chatMessages = useMemo(() => {
    return Object.keys(chatMessagesRaw).map((key) => ({
      key,
      ...chatMessagesRaw[key],
    }));
  }, [chatMessagesRaw]);

  const preferredLanguage = userData?.preferredLanguage;
  const [translatedMessages, setTranslatedMessages] = useState([]);

  useEffect(() => {
    const translateMessages = async () => {
      const translated = await Promise.all(
        chatMessages.map(async (msg) => {
          if (
            msg.text &&
            msg.sentBy !== userData.userId &&
            msg.language &&
            preferredLanguage &&
            !msg.language.startsWith(preferredLanguage)
          ) {
            const translatedText = await translateText(msg.text, preferredLanguage);
            return { ...msg, translatedText };
          } else {
            return { ...msg };
          }
        })
      );
      setTranslatedMessages(translated);
    };

    translateMessages();
  }, [chatMessages, preferredLanguage]);


  const chatData =
    (chatId && storedChats[chatId]) || props.route?.params?.newChatData || {};

  const getChatTitleFromName = () => {
    const otherUserId = chatUsers.find((uid) => uid !== userData.userId);
    const otherUserData = storedUsers[otherUserId];
    return (
      otherUserData && `${otherUserData.firstName} ${otherUserData.lastName}`
    );
  };

  useEffect(() => {
    console.log("📨 ChatScreen mounted with chatId:", chatId);
    console.log("🧑‍🤝‍🧑 Initial chat users:", chatData.users);
  }, []);


  useEffect(() => {
    if (!chatData || !chatData.users) return;
    setChatUsers(chatData.users);
  }, [chatData]);

  useEffect(() => {
    if (!chatUsers || chatUsers.length === 0) return;

    const chatTitle = chatData.chatName ?? getChatTitleFromName();

    props.navigation.setOptions({
      headerTitle: chatTitle,
      headerRight: () => (
        <HeaderButtons HeaderButtonComponent={CustomHeaderButton}>
          {chatId && (
            <>
              <Item
                title="Voice Call"
                iconName="call-outline"
                onPress={async () => {
                  const otherUserId = chatUsers.find(uid => uid !== userData.userId);
                  const otherUserData = storedUsers[otherUserId];

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
                onPress={() =>
                  chatData.isGroupChat
                    ? props.navigation.navigate("ChatSettings", { chatId })
                    : props.navigation.navigate("Contact", {
                      uid: chatUsers.find((uid) => uid !== userData.userId),
                    })
                }
              />
            </>
          )}
        </HeaderButtons>
      )
    });
  }, [chatUsers, chatId]);


  const sendMessage = useCallback(async () => {
    if (isSending || messageText.trim() === "") return;

    setIsSending(true);
    try {
      let id = chatId;
      if (!id) {
        id = await createChat(userData.userId, props.route.params.newChatData);

        // ✅ Save to local state
        setChatId(id);

        // ✅ Navigate to same screen with new chatId param (force rerender)
        props.navigation.setParams({ chatId: id });
      }

      await sendTextMessage(
        id,
        userData,
        messageText,
        replyingTo?.key,
        chatUsers.length > 0 ? chatUsers : chatData.users
      );
      setMessageText("");
      setReplyingTo(null);
    } catch (error) {
      console.log(error);
      setErrorBannerText("Message failed to send");
      setTimeout(() => setErrorBannerText(""), 5000);
    } finally {
      setIsSending(false);
    }
  }, [messageText, chatId, isSending]);

  const handleVoiceRecording = async () => {
    if (!isRecording) {
      await startRecording();
      setIsRecording(true);

      setRecordingDuration(0);
      recordingIntervalRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } else {
      const audioUrl = await stopRecordingAndUpload(chatId);
      setIsRecording(false);
      clearInterval(recordingIntervalRef.current);
      setRecordingDuration(0);

      if (audioUrl) {
        let id = chatId;
        if (!id) {
          id = await createChat(
            userData.userId,
            props.route.params.newChatData
          );
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
          id = await createChat(
            userData.userId,
            props.route.params.newChatData
          );
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

  const handleImagePress = (imageUrl) => {
    props.navigation.navigate('FullScreenImage', { imageUrl });
  };


  return (
    <SafeAreaView edges={["right", "left", "bottom"]} style={styles.container}>
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={100}
      >
        <ImageBackground
          source={backgroundImage}
          style={styles.backgroundImage}
        >
          <PageContainer style={{ backgroundColor: "transparent" }}>
            {!chatId && (
              <Bubble text="This is a new chat. Say hi!" type="system" />
            )}
            {errorBannerText !== "" && (
              <Bubble text={errorBannerText} type="error" />
            )}

            {chatId && (
              <FlatList
                ref={(ref) => (flatList.current = ref)}
                onContentSizeChange={() =>
                  flatList.current.scrollToEnd({ animated: false })
                }
                onLayout={() =>
                  flatList.current.scrollToEnd({ animated: false })
                }
                data={translatedMessages}
                // below code for scroll to new msg
                initialScrollIndex={translatedMessages.length > 0 ? translatedMessages.length - 1 : 0}
                getItemLayout={(data, index) => ({
                  length: 80, // approximate message height
                  offset: 80 * index,
                  index,
                })}
                renderItem={(itemData) => {
                  const message = itemData.item;
                  const isOwnMessage = message.sentBy === userData.userId;

                  let messageType = isOwnMessage ? "myMessage" : "theirMessage";
                  if (message.type === "info" || message.type === "call_log") {
                    messageType = "info";
                  }

                  const sender = message.sentBy && storedUsers[message.sentBy];
                  const name =
                    sender && `${sender.firstName} ${sender.lastName}`;

                  return (
                    <Bubble
                      type={messageType}
                      text={message.text}
                      translatedText={message.translatedText}
                      audioUrl={message.audioUrl}
                      messageId={message.key}
                      userId={userData.userId}
                      chatId={chatId}
                      date={message.sentAt}
                      name={
                        !chatData.isGroupChat || isOwnMessage ? undefined : name
                      }
                      setReply={() => setReplyingTo(message)}
                      replyingTo={
                        message.replyTo &&
                        chatMessages.find((i) => i.key === message.replyTo)
                      }
                      imageUrl={message.imageUrl}
                      onImagePress={handleImagePress}
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
            onSubmitEditing={sendMessage}
          />

          {messageText === "" ? (
            <TouchableOpacity style={styles.mediaButton} onPress={takePhoto}>
              <Feather name="camera" size={24} color={colors.red} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={{ ...styles.mediaButton, ...styles.sendButton }}
              onPress={sendMessage}
            >
              <Feather name="send" size={20} color="white" />
            </TouchableOpacity>
          )}

          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <TouchableOpacity
              style={styles.mediaButton}
              onPress={handleVoiceRecording}
            >
              <FontAwesome
                name={isRecording ? "stop" : "microphone"}
                size={24}
                color={colors.red}
              />
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
                {isLoading && (
                  <ActivityIndicator size="small" color={colors.primary} />
                )}
                {!isLoading && tempImageUri !== "" && (
                  <Image
                    source={{ uri: tempImageUri }}
                    style={{ width: 200, height: 200 }}
                  />
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
