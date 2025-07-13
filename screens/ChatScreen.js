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
  Modal
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather, Ionicons, MaterialIcons } from "@expo/vector-icons";
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
  pickVideo,
  pickDocument,
  uploadVideoAsync,
  uploadDocumentAsync,
} from "../utils/imagePickerHelper";
import { initiateCall } from "../utils/actions/callActions";
import { FontAwesome } from "@expo/vector-icons";
import { startRecording, stopRecordingAndUpload, cancelRecording } from "../utils/audioHelper"; // You’ll create this file
import { get, getDatabase, ref, push, set } from "firebase/database";
import { useMemo } from "react";
import { translateText } from "../utils/translateHelper";
import { performOCR } from "../utils/imagePickerHelper";
import * as ImagePicker from "expo-image-picker";
import { getAuth } from "firebase/auth";
import * as VideoThumbnails from 'expo-video-thumbnails';
import ChatMessages from "../components/ChatMessages";
import { decryptMessage } from "../utils/encryptionHelper";

const MAX_PREVIEW_WIDTH = 400;
const MAX_PREVIEW_HEIGHT = 700;
const MIN_PREVIEW_WIDTH = 180;
const MIN_PREVIEW_HEIGHT = 120;

function getDateSeparatorString(dateString) {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const isToday = date.toDateString() === today.toDateString();
  const isYesterday = date.toDateString() === yesterday.toDateString();

  if (isToday) return "Today";
  if (isYesterday) return "Yesterday";
  return date.toLocaleDateString(); // Local format (you can change style)
}


const ChatScreen = (props) => {
  console.log("Current user:", getAuth().currentUser?.email || null);
  const [messageText, setMessageText] = useState("");

  const passedChatId = props.route?.params?.chatId;
  const passedUserId = props.route?.params?.userId;

  const userData = useSelector((state) => state.auth.userData);
  const storedChats = useSelector((state) => state.chats.chatsData);
  const scrollToMessageId = props.route?.params?.scrollToMessageId;

  useEffect(() => {
    if (scrollToMessageId && flatList.current && translatedMessages?.length) {
      const idx = translatedMessages.findIndex(
        m => m.key === scrollToMessageId || m.messageId === scrollToMessageId
      );
      if (idx >= 0) {
        setTimeout(() => {
          flatList.current.scrollToIndex({ index: idx, animated: true });
        }, 500); // Allow rendering to complete
      }
    }
  }, [scrollToMessageId, translatedMessages]);

  const resolvedChatId = useMemo(() => {
    if (passedChatId) return passedChatId;

    if (passedUserId) {
      const existingChat = Object.entries(storedChats).find(([_, chat]) =>
        chat.users.length === 2 && // only 1-1 chat allowed
        chat.users.includes(userData.userId) &&
        chat.users.includes(passedUserId)
      );
      return existingChat?.[0] ?? null;
    }

    return null;
  }, [passedChatId, passedUserId, storedChats]);

  const [chatId, setChatId] = useState(resolvedChatId);

  useEffect(() => {
    if (resolvedChatId && chatId !== resolvedChatId) {
      setChatId(resolvedChatId);
    }
  }, [resolvedChatId]);

  const [errorBannerText, setErrorBannerText] = useState("");
  const [replyingTo, setReplyingTo] = useState();
  const [tempImageUri, setTempImageUri] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingIntervalRef = useRef(null);

  const flatList = useRef();

  const storedUsers = useSelector((state) => state.users.storedUsers);
  const [translatedMessages, setTranslatedMessages] = useState([]);
  const fallbackChatData = props.route?.params?.newChatData;
  const translationCache = useRef({});

  const chatMessagesRaw = useSelector(
    useCallback((state) => state.messages.messagesData[chatId] || {}, [chatId])
  );

  const chatMessages = useMemo(() => {
    return Object.keys(chatMessagesRaw).map((key) => ({
      key,
      ...chatMessagesRaw[key],
    }));
  }, [chatMessagesRaw]);

  const chatData = useMemo(() => {
    return (
      (chatId && storedChats[chatId]) ||
      props.route?.params?.newChatData ||
      null
    );
  }, [chatId, storedChats, props.route?.params?.newChatData]);

  const [chatUsers, setChatUsers] = useState([]);

  const renderItem = useCallback(
    ({ item }) => {
      if (item.type === "date-separator") {
        return (
          <View style={{ alignItems: "center", marginVertical: 8 }}>
            <View style={{
              backgroundColor: colors.extraLightGrey,
              borderRadius: 5,
              paddingHorizontal: 14,
              paddingVertical: 6,
            }}>
              <Text style={{ color: colors.grey, fontWeight: "bold" }}>
                {getDateSeparatorString(item.dateString)}
              </Text>
            </View>
          </View>
        );
      }
      const isOwnMessage = item.sentBy === userData.userId;
      let messageType = isOwnMessage ? "myMessage" : "theirMessage";
      if (item.type === "info" || item.type === "call_log") messageType = "info";
      const sender = item.sentBy && storedUsers[item.sentBy];
      const name = sender && `${sender.firstName} ${sender.lastName}`;

      return (
        <Bubble
          type={messageType}
          text={item.text}
          audioUrl={item.audioUrl}
          messageId={item.key}
          userId={userData.userId}
          chatId={chatId}
          date={item.sentAt || item.timestamp}
          name={!chatData.isGroupChat || isOwnMessage ? undefined : name}
          setReply={() => setReplyingTo(item)}
          replyingTo={
            item.replyTo && translatedMessages.find(i => i.key === item.replyTo)
          }
          imageUrl={item.imageUrl}
          onImagePress={handleImagePress}
          translatedText={item.translatedText}
          translatedTextFromImage={item.translatedTextFromImage}
          videoUrl={item.videoUrl}
          thumbnailUrl={item.thumbnailUrl}
          documentUrl={item.documentUrl}
          fileName={item.fileName}
          fileSize={item.fileSize}
          fileType={item.fileType}
          iv={item.iv}
        />
      );
    },
    [userData.userId, chatId, chatData.isGroupChat, storedUsers, translatedMessages, handleImagePress]
  );

  // console.log("[ChatScreen] route.params:", props.route?.params);
  // console.log("[ChatScreen] chatId:", props.route?.params?.chatId);
  // console.log("[ChatScreen] newChatData:", props.route?.params?.newChatData);
  // console.log("[ChatScreen] chatUsers state:", chatUsers);

  useEffect(() => {
    const routeUsers = props.route?.params?.newChatData?.users;
    const fallbackUsers = chatData?.users;

    const resolvedUsers = routeUsers || fallbackUsers;

    if (Array.isArray(resolvedUsers) && resolvedUsers.length > 0) {
      console.log(
        "[ChatScreen] Updating chatUsers from route/chatData:",
        resolvedUsers
      );
      setChatUsers(resolvedUsers);
    } else {
      console.warn("[ChatScreen] Failed to resolve chat users", {
        routeUsers,
        fallbackUsers,
      });
    }
  }, [props.route, chatData]);


  // Automatically find chatId if only newChatData is passed
  useEffect(() => {
    if (!chatId && fallbackChatData?.users?.length) {
      const newUsersSet = new Set(fallbackChatData.users);
      const existingChat = Object.entries(storedChats).find(([id, chat]) => {
        return (
          chat.users.length === fallbackChatData.users.length &&
          chat.users.every((userId) => newUsersSet.has(userId))
        );
      });

      if (existingChat) {
        console.log(
          "Found existing chat from newChatData, setting chatId:",
          existingChat[0]
        );
        setChatId(existingChat[0]);
      }
    }
  }, [chatId, fallbackChatData, storedChats]);

  const getChatTitleFromName = () => {
    if (!Array.isArray(chatUsers)) return "Chat";

    const otherUserId = chatUsers.find((uid) => uid !== userData.userId);
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

      const updated = await Promise.all(
        chatMessages.map(async (msg) => {
          const updatedMsg = { ...msg };

          // 🧠 Skip own messages
          if (msg.sentBy === userData.userId) {
            updatedMsg.translatedText = null;
            updatedMsg.translatedTextFromImage = null;
            return updatedMsg;
          }

          let originalText = msg.text;

          // If encrypted, decrypt before translation
          if (msg.text && msg.iv) {
            try {
              originalText = await decryptMessage(msg.text, msg.iv);
            } catch (e) {
              originalText = msg.text; // fallback to raw
            }
          }

          // TEXT translation
          if (
            preferredLang &&
            preferredLang !== "no_translation" &&
            originalText &&
            msg.language &&
            msg.language !== preferredLang
          ) {
            updatedMsg.translatedText = await translateText(
              originalText,
              preferredLang
            );
          } else {
            updatedMsg.translatedText = null;
          }

          // IMAGE OCR translation
          if (
            preferredLang &&
            preferredLang !== "no_translation" &&
            msg.ocrTextFromImage
          ) {
            updatedMsg.translatedTextFromImage = await translateText(
              msg.ocrTextFromImage,
              preferredLang
            );
          } else {
            updatedMsg.translatedTextFromImage = null;
          }

          return updatedMsg;
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
    console.log(
      "[ChatScreen] Setting chat users from chatData:",
      chatData.users
    );
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
          key: id,
        };

        dispatch({
          type: "chats/setChatsData",
          payload: {
            chatsData: {
              ...storedChats,
              [id]: newChat,
            },
          },
        });

        updatedChatUsers = newChat.users || [];
        setChatUsers(updatedChatUsers);

        if (!updatedChatUsers || updatedChatUsers.length < 2) {
          throw new Error("Group members not loaded yet.");
        }
      }

      // ✅ Use updatedChatUsers + id directly
      await sendTextMessage(
        id,
        userData,
        messageText,
        replyingTo?.key,
        updatedChatUsers
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
  }, [
    messageText,
    chatId,
    isSending,
    chatUsers,
    storedChats,
    storedUsers,
    userData,
    replyingTo,
  ]);

  const handleVoiceRecording = async () => {
    if (!isRecording) {
      await startRecording();
      setIsRecording(true);

      // Start timer
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
        await set(ref(getDatabase(), `chats/${id}/latestMessageText`), "Voice message");
      }
    }
  };

  const handleCancelRecording = async () => {
    if (isRecording) {
      await cancelRecording(); // Properly stop and clean up the recording object
      setIsRecording(false);
      setRecordingDuration(0);
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
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
    async (uri, translatedTextFromImage = null, ocrTextFromImage = null) => {
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
        await sendImage(
          chatId,
          userData,
          uploadUrl,
          replyingTo,
          chatUsers,
          translatedTextFromImage,
          ocrTextFromImage
        );
      } catch (error) {
        console.log(error);
      } finally {
        setIsLoading(false);
      }
    },
    [chatId, userData, replyingTo, chatUsers]
  );

  const sendImageWithTranslation = async () => {
    try {
      setShowAlert(false);
      const imageUri = await launchImagePicker();
      if (!imageUri) return;

      const downloadUrl = await uploadImageAsync(imageUri, true);
      if (!downloadUrl) throw new Error("Image upload failed.");

      const extractedText = await performOCR(imageUri);
      let translatedText = null;

      if (extractedText) {
        const detectedLang = await detectLanguage(extractedText);
        const recipientId = chatUsers.find((uid) => uid !== userData.userId);
        const recipientSnapshot = await get(
          child(ref(getDatabase(getFirebaseApp())), `users/${recipientId}`)
        );
        const recipientLang = recipientSnapshot.val()?.preferredLanguage;

        if (
          recipientLang &&
          recipientLang !== "no_translation" &&
          recipientLang !== detectedLang
        ) {
          translatedText = await translateText(extractedText, recipientLang);
        }
      }

      console.log("Sending image with translation:", {
        imageUri,
        extractedText,
        translatedText,
      });

      await sendImage(
        chatId,
        userData,
        downloadUrl,
        replyingTo,
        chatUsers,
        translatedText,
        extractedText
      );
      setReplyingTo(null);
    } catch (err) {
      console.error("sendImageWithTranslation failed:", err);
    }
  };

  useEffect(() => {
    if (!chatData || !chatUsers?.length) return;

    const otherUserId = chatUsers.find((uid) => uid !== userData.userId);
    const otherUserData = storedUsers[otherUserId];

    if (otherUserData) {
      console.log("[ChatScreen] Setting header - chatId:", chatId);
      console.log("[ChatScreen] chatUsers:", chatUsers);
      //console.log("[ChatScreen] storedUsers:", storedUsers);

      props.navigation.setOptions({
        headerTitle:
          chatData.chatName ??
          `${otherUserData.firstName} ${otherUserData.lastName}`,
        headerRight: renderHeaderRight,
      });
    }
  }, [chatData, chatUsers, storedUsers]);

  const handleImagePress = (imageUrl) => {
    props.navigation.navigate("FullScreenImage", { imageUrl });
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
      console.warn(
        "[ChatScreen] chatUsers is invalid or incomplete:",
        chatUsers
      );
      return null;
    }

    const otherUserId = chatUsers.find((uid) => uid !== userData.userId);
    const otherUserData = storedUsers[otherUserId];

    return (
      <HeaderButtons HeaderButtonComponent={CustomHeaderButton}>
        <Item
          title="Voice Call"
          iconName="call-outline"
          onPress={async () => {
            console.log("📞 Voice Call button pressed");

            if (!chatId) {
              console.warn("[ChatScreen] Cannot call — chatId missing.");
              return;
            }

            if (!otherUserId || !otherUserData) {
              console.warn(
                "[ChatScreen] Cannot initiate call — missing user data."
              );
              return;
            }

            console.log("initiateCall running");

            try {
              await initiateCall({
                chatId,
                callerId: userData.userId,
                receiverId: otherUserId,
              });

              console.log("Navigating to VoiceCall screen...");
              props.navigation.navigate("VoiceCall", {
                chatId,
                callerData: userData,
                receiverData: otherUserData,
                isCaller: true,
              });
            } catch (error) {
              console.error("❌ initiateCall failed:", error);
            }
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
              const otherUserId = chatUsers.find(
                (uid) => uid !== userData.userId
              );
              const otherUserData = storedUsers[otherUserId];

              if (!otherUserData) {
                console.warn(
                  "[ChatScreen] Missing user data for:",
                  otherUserId
                );
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

  const [attachmentMenuVisible, setAttachmentMenuVisible] = useState(false);

  const handleCamera = async () => {
    setAttachmentMenuVisible(false);
    await takePhoto(); // uses your working openCamera logic
  };

  // Photos & Images
  const handlePhotos = async () => {
    setAttachmentMenuVisible(false);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 1,
      });
      if (!result.cancelled && result.assets && result.assets.length > 0) {
        setTempImageUri(result.assets[0].uri); // triggers your image sending popup
      }
    } catch (err) {
      console.warn("Image pick error:", err);
    }
  };

  const handleVideo = async () => {
    setAttachmentMenuVisible(false);
    const videoUri = await pickVideo();
    if (videoUri) {
      try {
        // 1. Generate thumbnail
        const { uri: thumbnailUri } = await VideoThumbnails.getThumbnailAsync(
          videoUri,
          { time: 1000 } // 1 second in
        );

        // 2. Upload video and thumbnail
        const downloadUrl = await uploadVideoAsync(videoUri);
        const thumbnailUrl = await uploadImageAsync(thumbnailUri, true);

        // 3. Send message
        let id = chatId;
        if (!id) {
          id = await createChat(userData.userId, props.route.params.newChatData);
          setChatId(id);
        }

        const videoMessage = {
          type: "video",
          videoUrl: downloadUrl,
          thumbnailUrl: thumbnailUrl, // <--- ADD THIS FIELD
          timestamp: Date.now(),
          sentBy: userData.userId,
        };

        const db = getDatabase();
        const messagesRef = ref(db, `messages/${id}`);
        const newMessageRef = push(messagesRef);
        await set(newMessageRef, videoMessage);
        await set(ref(getDatabase(), `chats/${id}/latestMessageText`), "Video");
      } catch (err) {
        console.warn("Failed to upload/send video:", err);
      }
    }
  };

  const handleDocument = async () => {
    setAttachmentMenuVisible(false);
    const pickedDoc = await pickDocument();
    console.log("Picked document:", pickedDoc);
    if (pickedDoc) {
      try {
        const { uri, name, size, mimeType } = pickedDoc;

        console.log("Uploading document:", uri, name);

        const downloadUrl = await uploadDocumentAsync(uri, name);
        console.log("Download URL for document:", downloadUrl);

        let id = chatId;
        if (!id) {
          id = await createChat(userData.userId, props.route.params.newChatData);
          setChatId(id);
        }

        const docMessage = {
          type: "document",
          documentUrl: downloadUrl,
          fileName: name,
          fileSize: size,
          fileType: mimeType,
          timestamp: Date.now(),
          sentBy: userData.userId,
        };
        console.log("Saving docMessage to Firebase:", docMessage);

        const db = getDatabase();
        const messagesRef = ref(db, `messages/${id}`);
        const newMessageRef = push(messagesRef);
        await set(newMessageRef, docMessage);
        await set(ref(getDatabase(), `chats/${id}/latestMessageText`), "Document");
      } catch (err) {
        console.warn("Failed to upload/send document:", err);
      }
    }
  };

  const ImagePreview = React.memo(({ imageUri }) => {
    const [dimensions, setDimensions] = useState(null);

    useEffect(() => {
      if (!imageUri) return;
      Image.getSize(
        imageUri,
        (originalWidth, originalHeight) => {
          let width = originalWidth;
          let height = originalHeight;
          const widthRatio = MAX_PREVIEW_WIDTH / width;
          const heightRatio = MAX_PREVIEW_HEIGHT / height;
          const scale = Math.min(widthRatio, heightRatio, 1);
          width = Math.max(width * scale, MIN_PREVIEW_WIDTH);
          height = Math.max(height * scale, MIN_PREVIEW_HEIGHT);
          setDimensions({ width, height });
        },
        () => setDimensions({ width: MAX_PREVIEW_WIDTH, height: MAX_PREVIEW_HEIGHT })
      );
    }, [imageUri]);

    if (!dimensions) {
      return (
        <View
          style={{
            width: MAX_PREVIEW_WIDTH,
            height: MAX_PREVIEW_HEIGHT,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ActivityIndicator size="large" color="#666" />
        </View>
      );
    }

    return (
      <Image
        source={{ uri: imageUri }}
        style={{
          width: dimensions.width,
          height: dimensions.height,
          borderRadius: 12,
          backgroundColor: "#000",
          alignSelf: "center",
          marginBottom: 10,
        }}
        resizeMode="cover"
      />
    );
  });

  const chatMessagesWithDates = useMemo(() => {
    if (!translatedMessages || translatedMessages.length === 0) return [];
    const result = [];
    let lastDate = null;

    translatedMessages.forEach((msg) => {
      const dateValue = msg.sentAt || msg.timestamp;
      if (!dateValue) return;
      const msgDate = new Date(dateValue).toDateString();
      if (msgDate !== lastDate) {
        result.push({
          type: "date-separator",
          dateString: dateValue,
          key: "date-separator-" + msgDate + "-" + Math.random(),
        });
        lastDate = msgDate;
      }
      result.push(msg);
    });

    return result;
  }, [translatedMessages]);

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
              <ChatMessages
                messages={chatMessagesWithDates}
                renderItem={renderItem}
                flatListRef={flatList}
                onContentSizeChange={() =>
                  flatList.current.scrollToEnd({ animated: false })
                }
                onLayout={() =>
                  flatList.current.scrollToEnd({ animated: false })
                }
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
          {isRecording ? (
            // --- RECORDING UI: Replaces input area when recording ---
            <View style={styles.recordingControls}>
              <TouchableOpacity onPress={handleCancelRecording} style={{ marginRight: 12 }}>
                <Ionicons name="close-circle" size={28} color={colors.red} />
              </TouchableOpacity>
              <Text style={{ flex: 1, textAlign: "center", fontWeight: "bold", color: "#333" }}>
                Recording... {recordingDuration}s
              </Text>
              <TouchableOpacity onPress={handleVoiceRecording} style={{ marginLeft: 12 }}>
                <Ionicons name="send" size={28} color={colors.red} />
              </TouchableOpacity>
            </View>
          ) : (
            // --- NORMAL INPUT UI ---
            <>
              <TouchableOpacity onPress={() => setAttachmentMenuVisible(true)}>
                <Ionicons name="add" size={28} color={colors.red} />
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
                closeOnTouchOutside={true}
                closeOnHardwareBackPress={false}
                showConfirmButton={false}
                showCancelButton={false}
                onDismiss={() => setTempImageUri("")}
                // FULLSCREEN STYLES:
                contentContainerStyle={{
                  width: "100%",
                  height: "100%",
                  backgroundColor: "transparent",
                  borderRadius: 0,
                  padding: 0,
                  margin: 0,
                  flex: 1,
                  justifyContent: "center",
                  alignItems: "center",
                }}
                overlayStyle={{
                  backgroundColor: "#212121",
                  flex: 1,
                }}
                customView={
                  <View
                    style={{
                      flex: 1,
                      width: "100%",
                      height: "100%",
                      backgroundColor: "#212121",
                    }}
                  >
                    {/* Top Bar: Cross on Left, Buttons on Right */}
                    <View
                      style={{
                        position: "relative",
                        top: 0,
                        left: 0,
                        width: "100%",
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        paddingTop: 10, // adjust for notch/status bar as needed
                        paddingRight: 0,
                        backgroundColor: "#212121",
                        zIndex: 10,
                      }}
                    >
                      {/* Close/Cross Button */}
                      <TouchableOpacity
                        onPress={() => setTempImageUri("")}
                        style={{
                          padding: 10,
                          marginRight: 0,
                        }}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        {/* Use Ionicons/MaterialIcons for icon or emoji ✕ */}
                        <Text style={{ color: "#fff", fontSize: 30 }}>✕</Text>
                      </TouchableOpacity>

                      {/* Spacer to push buttons to right */}
                      <View style={{ flex: 1 }} />

                      {/* Send Buttons Row */}
                      <View style={{ flexDirection: "row", alignItems: "center" }}>
                        <TouchableOpacity
                          onPress={async () => {
                            const uri = tempImageUri;
                            setTempImageUri("");
                            await uploadImage(uri);
                          }}
                          style={{
                            marginHorizontal: 6,
                            paddingVertical: 8,
                            paddingHorizontal: 14,
                            backgroundColor: "#333",
                            borderRadius: 20,
                            flexDirection: "row",
                            alignItems: "center",
                          }}
                        >
                          <Text style={{ color: "#fff", fontSize: 17, marginRight: 6 }}>📤</Text>
                          <Text style={{ color: "#fff", fontWeight: "bold" }}>Send</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          onPress={async () => {
                            const uri = tempImageUri;
                            setTempImageUri("");

                            const ocrText = await performOCR(uri);
                            let translatedText = null;

                            if (ocrText) {
                              const recipientId = chatUsers.find(
                                (uid) => uid !== userData.userId
                              );
                              const db = getDatabase();
                              const recipientSnap = await get(
                                ref(db, `users/${recipientId}`)
                              );
                              const recipientLang = recipientSnap.val()?.preferredLanguage;

                              if (
                                recipientLang &&
                                recipientLang !== "no_translation"
                              ) {
                                translatedText = await translateText(
                                  ocrText,
                                  recipientLang
                                );
                              }
                            }

                            await uploadImage(uri, translatedText, ocrText);
                          }}
                          style={{
                            marginLeft: 6,
                            paddingVertical: 8,
                            paddingHorizontal: 14,
                            backgroundColor: "#1976d2",
                            borderRadius: 20,
                            flexDirection: "row",
                            alignItems: "center",
                          }}
                        >
                          <Text style={{ color: "#fff", fontSize: 17, marginRight: 6 }}>🌐</Text>
                          <Text style={{ color: "#fff", fontWeight: "bold" }}>Translate & Send</Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Fullscreen Image Preview */}
                    <View
                      style={{
                        position: "absolute",
                        top: 50,
                        right: 10,

                        flex: 1,
                        justifyContent: "center",
                        alignItems: "center",
                        width: "100%",
                        height: "100%"
                      }}
                    >
                      {isLoading ? (
                        <ActivityIndicator size="large" color={colors.primary} />
                      ) : (
                        tempImageUri !== "" && <ImagePreview imageUri={tempImageUri} />
                      )}
                    </View>
                  </View>
                }
              />
            </>
          )}

        </View>
      </KeyboardAvoidingView>
      <Modal
        visible={attachmentMenuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAttachmentMenuVisible(false)}
      >
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPressOut={() => setAttachmentMenuVisible(false)}
        >
          <View style={styles.menuContainer}>
            <TouchableOpacity style={styles.menuItem} onPress={handleCamera}>
              <Ionicons name="camera" size={22} color={colors.red} />
              <Text style={styles.menuText}>Camera</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={handlePhotos}>
              <Ionicons name="image" size={22} color={colors.red} />
              <Text style={styles.menuText}>Photos & Images</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={handleVideo}>
              <Ionicons name="videocam" size={22} color={colors.red} />
              <Text style={styles.menuText}>Video</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={handleDocument}>
              <MaterialIcons name="insert-drive-file" size={22} color={colors.red} />
              <Text style={styles.menuText}>Document</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
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
  alertButtonRed: {
    backgroundColor: colors.red,
    padding: 10,
    marginTop: 6,
    borderRadius: 5,
    width: 200,
    alignItems: "center",
  },
  alertButtonGray: {
    backgroundColor: "#999",
    padding: 10,
    marginTop: 6,
    borderRadius: 5,
    width: 200,
    alignItems: "center",
  },
  alertButtonGreen: {
    backgroundColor: colors.primary,
    padding: 10,
    marginTop: 6,
    borderRadius: 5,
    width: 200,
    alignItems: "center",
  },
  alertButtonText: {
    color: "white",
    fontWeight: "bold",
  },
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  menuContainer: {
    backgroundColor: colors.nearlyWhite,
    padding: 18,
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
    elevation: 8,
  },
  recordingControls: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 0,
    paddingHorizontal: 16,
    backgroundColor: "#fff",
    borderRadius: 30,
    marginHorizontal: 10,
    elevation: 2,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
  },
  menuText: {
    marginLeft: 12,
    fontSize: 17,
    color: colors.red,
  }
});

export default ChatScreen;





