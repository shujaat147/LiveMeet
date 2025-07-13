import React, { useRef, useState, useEffect } from "react";
import {
  Image,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
  TouchableOpacity,
  Modal,
} from "react-native";
import colors from "../constants/colors";
import {
  Menu,
  MenuTrigger,
  MenuOptions,
  MenuOption,
} from "react-native-popup-menu";
import uuid from "react-native-uuid";
import * as Clipboard from "expo-clipboard";
import {
  Feather,
  FontAwesome,
  Ionicons,
  MaterialIcons,
  FontAwesome5
} from "@expo/vector-icons";
import { starMessage } from "../utils/actions/chatActions";
import { useDispatch, useSelector } from "react-redux";
import { hideMessage } from "../store/messagesSlice";
import { Audio, Video } from "expo-av";
import * as Linking from "expo-linking";
import RNSimpleCrypto from 'react-native-simple-crypto';
console.log('Rendering bubble')

const SECRET_KEY = 'finalYearProjectLiveMeet'; //AES 16, 24, or 32 bytes

async function decryptMessage(cipherBase64, ivBase64) {
  const keyBuffer = await RNSimpleCrypto.utils.convertUtf8ToArrayBuffer(SECRET_KEY);
  const cipherBuffer = await RNSimpleCrypto.utils.convertBase64ToArrayBuffer(cipherBase64);
  const ivBuffer = await RNSimpleCrypto.utils.convertBase64ToArrayBuffer(ivBase64);

  const decryptedBuffer = await RNSimpleCrypto.AES.decrypt(cipherBuffer, keyBuffer, ivBuffer);
  const decryptedText = RNSimpleCrypto.utils.convertArrayBufferToUtf8(decryptedBuffer);

  return decryptedText;
}

function formatAmPm(dateString) {
  const date = new Date(dateString);
  let hours = date.getHours();
  let minutes = date.getMinutes();
  const ampm = hours >= 12 ? "pm" : "am";
  hours = hours % 12 || 12;
  minutes = minutes < 10 ? "0" + minutes : minutes;
  return hours + ":" + minutes + " " + ampm;
}

const MenuItem = (props) => {
  const Icon = props.iconPack ?? Feather;
  return (
    <MenuOption onSelect={props.onSelect} text="">
      <View style={styles.menuItemContainer}>
        <Text style={styles.menuText}>{props.text}</Text>
        <Icon name={props.icon} size={18} />
      </View>
    </MenuOption>
  );
};

const Bubble = (props) => {
  const {
    text,
    type,
    messageId,
    chatId,
    userId,
    date,
    setReply,
    replyingTo,
    name,
    imageUrl,
    audioUrl,
    onImagePress,
    translatedText,
    translatedTextFromImage,
    videoUrl,
    documentUrl,
    fileName,
    thumbnailUrl,
    fileSize,
    fileType,
    iv
  } = props;

  const [decryptedText, setDecryptedText] = useState('');

  useEffect(() => {
    let mounted = true;
    async function runDecrypt() {
      if (text && iv) {
        try {
          const result = await decryptMessage(text, iv);
          if (mounted) setDecryptedText(result);
        } catch (e) {
          if (mounted) setDecryptedText(text); // fallback to raw text
        }
      } else if (text) {
        setDecryptedText(text); // Show raw for old msgs
      }
    }
    runDecrypt();
    return () => { mounted = false; }
  }, [text, iv]);

  const getDocIcon = (type = "", fileName = "") => {
    const lower = (type + " " + fileName).toLowerCase();
    // Excel (check before Word)
    if (
      lower.includes("excel") ||
      lower.includes("spreadsheet") ||
      lower.endsWith(".xls") ||
      lower.endsWith(".xlsx") ||
      lower.match(/\.(xls|xlsx)$/)
    ) {
      return <FontAwesome5 name="file-excel" size={32} color="#388e3c" />;
    }
    // PowerPoint (check before Word)
    if (
      lower.includes("powerpoint") ||
      lower.endsWith(".ppt") ||
      lower.endsWith(".pptx") ||
      lower.match(/\.(ppt|pptx)$/)
    ) {
      return <FontAwesome5 name="file-powerpoint" size={32} color="#f9a825" />;
    }
    // Word (check "msword", "wordprocessingml", or .doc/.docx)
    if (
      lower.includes("msword") ||
      lower.includes("wordprocessingml") ||
      lower.endsWith(".doc") ||
      lower.endsWith(".docx") ||
      lower.match(/\.(doc|docx)$/)
    ) {
      return <FontAwesome5 name="file-word" size={32} color="#1976d2" />;
    }
    if (lower.includes("pdf") || lower.endsWith(".pdf")) {
      return <MaterialIcons name="picture-as-pdf" size={36} color="#d32f2f" />;
    }
    if (
      lower.includes("image") ||
      lower.match(/\.(jpg|jpeg|png|gif|webp|bmp)$/)
    ) {
      return <FontAwesome5 name="file-image" size={32} color="#1976d2" />;
    }
    if (
      lower.includes("video") ||
      lower.match(/\.(mp4|mov|wmv|avi|flv|webm|mkv)$/)
    ) {
      return <FontAwesome5 name="file-video" size={32} color="#7c4dff" />;
    }
    if (lower.includes("apk") || lower.endsWith(".apk")) {
      return <FontAwesome5 name="android" size={32} color="#43a047" />;
    }
    return <MaterialIcons name="insert-drive-file" size={36} color="#888" />;
  };

  const dispatch = useDispatch();
  const starredMessages =
    useSelector((state) => state.messages.starredMessages[chatId]) || {};
  const storedUsers = useSelector((state) => state.users.storedUsers);

  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const playbackRef = useRef(null);
  const [showVideoModal, setShowVideoModal] = useState(false);

  useEffect(() => {
    return () => {
      if (playbackRef.current) {
        playbackRef.current.unloadAsync();
      }
    };
  }, []);

  const playSound = async (uri) => {
    try {
      setIsPlaying(true);
      const { sound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true },
        onPlaybackStatusUpdate
      );
      playbackRef.current = sound;
      await sound.playAsync();
    } catch (error) {
      console.log("Error playing sound:", error);
    }
  };

  const onPlaybackStatusUpdate = (status) => {
    if (status.isLoaded) {
      if (status.didJustFinish) {
        setIsPlaying(false);
        setPlaybackProgress(0);
        playbackRef.current?.unloadAsync();
      } else {
        setPlaybackProgress(Math.floor(status.positionMillis / 1000));
      }
    }
  };

  const copyToClipboard = async (text) => {
    try {
      await Clipboard.setStringAsync(text);
    } catch (error) {
      console.log(error);
    }
  };

  const handleDeleteForMe = () => {
    dispatch(hideMessage({ chatId, messageId }));
  };

  const bubbleStyle = { ...styles.container };
  const textStyle = { ...styles.text };
  const wrapperStyle = { ...styles.wrapperStyle };

  const BubbleImage = ({ imageUrl, onImagePress }) => {
    const FIXED_WIDTH = 250;  // WhatsApp style: 210px wide
    const FIXED_HEIGHT = 300; // WhatsApp style: 270px tall

    return (
      <TouchableOpacity onPress={() => onImagePress(imageUrl)}>
        <Image
          source={{ uri: imageUrl }}
          style={{
            width: FIXED_WIDTH,
            height: FIXED_HEIGHT,
            borderRadius: 10,
            marginBottom: 5,
            alignSelf: "flex-start",
            backgroundColor: "#212121",
          }}
          resizeMode="contain" // or 'contain' if you prefer, but 'cover' is like WhatsApp
        />
      </TouchableOpacity>
    );
  };

  const menuRef = useRef(null);
  const id = useRef(uuid.v4());

  let Container = View;
  let isUserMessage = false;
  const dateString = date && formatAmPm(date);

  switch (type) {
    case "system":
      textStyle.color = "#65644A";
      bubbleStyle.backgroundColor = colors.beige;
      bubbleStyle.alignItems = "center";
      bubbleStyle.marginTop = 10;
      break;
    case "error":
      bubbleStyle.backgroundColor = colors.red;
      textStyle.color = "white";
      bubbleStyle.marginTop = 10;
      break;
    case "myMessage":
      wrapperStyle.justifyContent = "flex-end";
      bubbleStyle.backgroundColor = "#E7FED6";
      bubbleStyle.maxWidth = "90%";
      Container = TouchableWithoutFeedback;
      isUserMessage = true;
      break;
    case "theirMessage":
      wrapperStyle.justifyContent = "flex-start";
      bubbleStyle.maxWidth = "90%";
      Container = TouchableWithoutFeedback;
      isUserMessage = true;
      break;
    case "reply":
      bubbleStyle.backgroundColor = "#F2F2F2";
      break;
    case "info":
      bubbleStyle.backgroundColor = "white";
      bubbleStyle.alignItems = "center";
      textStyle.color = colors.textColor;
      break;
    default:
      break;
  }

  const isStarred = isUserMessage && starredMessages[messageId] !== undefined;
  const replyingToUser = replyingTo && storedUsers[replyingTo.sentBy];

  if (type === "info") {
    return (
      <View style={styles.infoMessageWrapper}>
        <Text style={styles.infoMessageText}>{text}</Text>
      </View>
    );
  }

  return (
    <View style={wrapperStyle}>
      <Container
        onLongPress={() =>
          menuRef.current?.props?.ctx?.menuActions?.openMenu(id.current)
        }
        style={{ width: "100%" }}
      >
        <View style={bubbleStyle}>
          {name && type !== "info" && <Text style={styles.name}>{name}</Text>}

          {replyingToUser && (
            <Bubble
              type="reply"
              text={replyingTo.text}
              name={`${replyingToUser.firstName} ${replyingToUser.lastName}`}
            />
          )}

          {audioUrl && !imageUrl && (
            <TouchableWithoutFeedback
              onPress={() => {
                if (!isPlaying) {
                  playSound(audioUrl);
                }
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginVertical: 5,
                }}
              >
                <FontAwesome
                  name={isPlaying ? "pause-circle" : "play-circle"}
                  size={28}
                  color={colors.red}
                />
                <Text style={{ marginLeft: 10 }}>
                  {isPlaying ? `${playbackProgress}s` : "Voice Message"}
                </Text>
              </View>
            </TouchableWithoutFeedback>
          )}

          {videoUrl && (
            <>
              <TouchableOpacity
                onPress={() => setShowVideoModal(true)}
                style={{
                  alignItems: "center",
                  marginVertical: 8,
                }}
              >
                {thumbnailUrl ? (
                  <View style={{ width: 300, height: 200, borderRadius: 8 }}>
                    <Image
                      source={{ uri: thumbnailUrl }}
                      style={{
                        width: 300,
                        height: 200,
                        borderRadius: 8,
                        position: "absolute",
                        top: 0,
                        left: 0,
                        backgroundColor: "#212121"
                      }}
                      resizeMode="contain"
                    />
                    <View
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: 300,
                        height: 200,
                        justifyContent: "center",
                        alignItems: "center",
                        backgroundColor: "rgba(0, 0, 0, 0.03)", // slight overlay for visibility
                        borderRadius: 8,
                      }}
                    >
                      <Ionicons name="play-circle" size={64} color="#fff" />
                    </View>
                  </View>
                ) : (
                  <Ionicons name="videocam" size={48} color={colors.red} />
                )}
              </TouchableOpacity>
              <Modal
                visible={showVideoModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowVideoModal(false)}
              >
                <View
                  style={{
                    flex: 1,
                    backgroundColor: "'rgba(0,0,0,0.85)'",
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <TouchableOpacity
                    style={{
                      position: "absolute",
                      top: 40,
                      right: 25,
                      zIndex: 2,
                    }}
                    onPress={() => setShowVideoModal(false)}
                  >
                    <Ionicons name="close-circle" size={40} color={colors.nearlyWhite} />
                  </TouchableOpacity>
                  <Video
                    source={{ uri: videoUrl }}
                    useNativeControls
                    resizeMode="contain"
                    style={{ width: '100%', height: '100%', backgroundColor: 'transparent' }}
                    shouldPlay
                  />
                </View>
              </Modal>
            </>
          )}

          {/* ---- Document Message ---- */}
          {documentUrl && (
            <TouchableOpacity
              style={[styles.bubble, { width: 250 }]}
              onPress={() => Linking.openURL(documentUrl)}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                {getDocIcon(fileType)}
                <View style={{ marginLeft: 12, flex: 1 }}>
                  <Text
                    style={{ color: colors.textColor, flexShrink: 1, flexWrap: "wrap" }}
                  >
                    {fileName || "Document"}
                  </Text>
                  {(fileSize || fileType) && (
                    <Text style={{ fontSize: 12, color: "#888" }}>
                      {fileSize ? `${(fileSize / 1024).toFixed(1)} KB` : ""}
                    </Text>
                  )}
                  <Text style={styles.attachmentLabel}>Tap to open</Text>
                </View>
              </View>
            </TouchableOpacity>

          )}

          {/* ---- Standard Text Message ---- */}
          {!audioUrl && !imageUrl && !videoUrl && !documentUrl && (
            <View>
              <Text style={textStyle}>{decryptedText || "[Decrypting...]"}</Text>
            </View>
          )}

          {imageUrl && (
            <BubbleImage imageUrl={imageUrl} onImagePress={onImagePress} />
          )}

          {type !== "myMessage" && (
            <>
              {translatedText && (
                <Text
                  style={[
                    textStyle,
                    { fontStyle: "italic", color: "gray", marginTop: 4, fontSize: 15 },
                  ]}
                >
                  {translatedText}
                </Text>
              )}
              {translatedTextFromImage && (
                <Text style={styles.translatedText}>
                  {translatedTextFromImage}
                </Text>
              )}
            </>
          )}

          {dateString && type !== "info" && (
            <View style={styles.timeContainer}>
              {isStarred && (
                <FontAwesome
                  name="star"
                  size={14}
                  color={colors.textColor}
                  style={{ marginRight: 5 }}
                />
              )}
              <Text style={styles.time}>{dateString}</Text>
            </View>
          )}

          <Menu name={id.current} ref={menuRef}>
            <MenuTrigger />
            <MenuOptions>
              <MenuItem
                text="Copy to clipboard"
                icon="copy"
                onSelect={() => copyToClipboard(text)}
              />
              <MenuItem
                text={`${isStarred ? "Unstar" : "Star"} message`}
                icon={isStarred ? "star-o" : "star"}
                iconPack={FontAwesome}
                onSelect={() => starMessage(messageId, chatId, userId)}
              />
              <MenuItem
                text="Reply"
                icon="arrow-left-circle"
                onSelect={setReply}
              />
              <MenuItem
                text="Delete for me"
                icon="trash"
                onSelect={handleDeleteForMe}
              />
            </MenuOptions>
          </Menu>
        </View>
      </Container>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapperStyle: {
    flexDirection: "row",
    justifyContent: "center",
  },
  container: {
    backgroundColor: "white",
    borderRadius: 6,
    padding: 5,
    marginBottom: 10,
    borderColor: "#E2DACC",
    borderWidth: 1,
  },
  text: {
    fontFamily: "regular",
    letterSpacing: 0.3,
    fontSize: 15
  },
  menuItemContainer: {
    flexDirection: "row",
    padding: 5,
  },
  menuText: {
    flex: 1,
    fontFamily: "regular",
    letterSpacing: 0.3,
    fontSize: 16,
  },
  timeContainer: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  time: {
    fontFamily: "regular",
    letterSpacing: 0.3,
    color: colors.grey,
    fontSize: 12,
  },
  name: {
    fontFamily: "medium",
    letterSpacing: 0.3,
  },
  image: {
    maxWidth: 230,
    maxHeight: 350,
    minWidth: 180,
    minHeight: 200,
    borderRadius: 10,
    marginBottom: 5,
    alignSelf: "flex-start",
    backgroundColor: "#000" // adds a black border if image is narrow
  },
  infoMessageWrapper: {
    marginVertical: 10,
    paddingHorizontal: 16,
    paddingVertical: 6,
    alignItems: "center",
    backgroundColor: "#f0f0f0",
    borderRadius: 10,
    alignSelf: "center",
    maxWidth: "100%",
  },
  infoMessageText: {
    fontStyle: "italic",
    fontSize: 13,
    color: "#444",
    textAlign: "center",
  },
});

export default React.memo(Bubble);




