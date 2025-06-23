import { getDatabase, ref, set, update, get } from "firebase/database";
import { lastKnownScreenRef } from "../navigation/MainNavigator";
import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ImageBackground,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import colors from "../constants/colors";
import { logCallMessage } from "../utils/actions/chatActions";
import backgroundImage from "../assets/call-background.jpeg";
import defaultAvatar from "../assets/images/userImage-1.png";
import ZegoExpressEngine from "zego-express-engine-reactnative";
import { createEngine } from "../utils/zegoHelper";
import { destroyEngine } from "../utils/zegoHelper";

import { onValue } from "firebase/database";

const VoiceCallScreen = () => {
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const [callTime, setCallTime] = useState(0);
  const [remoteUserJoined, setRemoteUserJoined] = useState(false);
  const timerRef = useRef(null);

  const alreadyEnded = useRef(false);

  const navigation = useNavigation();
  const route = useRoute();

  const { chatId, receiverData, callerData, isCaller } = route.params;
  const userInfo = isCaller ? receiverData : callerData;

  const localUserId = isCaller ? callerData.userId : receiverData.userId;
  const remoteUserId = isCaller ? receiverData.userId : callerData.userId;
  const displayName = isCaller ? callerData.firstName : receiverData.firstName;

  const stringLocalUserId = String(localUserId);
  const stringRemoteUserId = String(remoteUserId);

  const localStreamId = `${chatId}_${stringLocalUserId}`;
  const remoteStreamId = `${chatId}_${stringRemoteUserId}`;

  useEffect(() => {
    const db = getDatabase();
    const callRef = ref(db, `calls/call_${chatId}`);

    const unsubscribe = onValue(callRef, (snapshot) => {
      const data = snapshot.val();

      if (data?.status === "connected") {
        if (!remoteUserJoined) {
          setRemoteUserJoined(true);
          startTimer();
        }

        (async () => {
          await createEngine(); // 🧠 Ensure engine is ready
          joinRoomAndStartCall(); // ✅ Both caller and receiver join
        })();
      }

      if (data?.status === "ended") {
        console.log("📴 Firebase status is 'ended', ending call...");
        setTimeout(() => {
          endCall();
        }, 200);
      }
    });

    if (isCaller) {
      (async () => {
        try {
          const db = getDatabase();
          const callId = `call_${chatId}`;

          // Write call data FIRST
          await set(ref(db, `calls/${callId}`), {
            callerId: callerData.userId,
            receiverId: receiverData.userId,
            chatId,
            status: "calling",
            statusHistory: ["calling"],
            timestamp: Date.now(),
          });

          console.log(
            "📡 Call data written to Firebase at:",
            `calls/${callId}`
          );

          // THEN start the engine + call
          await createEngine();
          await startCall();
        } catch (err) {
          console.error("❌ Caller setup failed:", err.message);
        }
      })();
    }

    let timeout;

    if (isCaller) {
      // ⏰ Set timeout to auto-end call if not picked in 60 seconds
      timeout = setTimeout(async () => {
        try {
          const snapshot = await get(ref(db, `calls/call_${chatId}`));
          const callData = snapshot.val();

          if (callData?.status === "calling") {
            console.log("⏰ Auto-ending call after 1 min");
            await update(ref(db, `calls/call_${chatId}`), { status: "ended" });
          }
        } catch (err) {
          console.warn("⚠️ Auto-end check failed:", err.message);
        }
      }, 60000); // 60 seconds
    }

    return () => {
      unsubscribe();
      cleanup();
      if (timeout) clearTimeout(timeout); // cancel timeout if user accepts/rejects
    };
  }, []);

  const startCall = async () => {
    try {
      const engine = ZegoExpressEngine.instance();

      engine.loginRoom(chatId, {
        userID: localUserId.toString(),
        userName: displayName,
      });

      engine.muteMicrophone(false);
      engine.setAudioRouteToSpeaker(false);

      engine.on("roomUserUpdate", (roomID, updateType, userList) => {
        if (updateType === "ADD") {
          setRemoteUserJoined(true);
          startTimer();
        }
      });

      engine.on("roomStreamUpdate", (roomID, updateType, streamList) => {
        if (updateType === "DELETE") {
          stopTimer();
          endCall();
        }
      });
    } catch (err) {
      console.error("🚨 Failed to start call:", err.message);
    }
  };

  const joinRoomAndStartCall = async () => {
    const engine = ZegoExpressEngine.instance();

    engine.loginRoom(chatId, {
      userID: localUserId.toString(),
      userName: displayName,
    });

    engine.setAudioRouteToSpeaker(false);

    engine.startPublishingStream(localStreamId);
    engine.startPlayingStream(remoteStreamId);
    engine.muteMicrophone(false); // Make sure mic is on

    engine.on("roomUserUpdate", (roomID, updateType, userList) => {
      if (updateType === "ADD") {
        setRemoteUserJoined(true);
        startTimer();
      }
    });

    engine.on("roomStreamUpdate", (roomID, updateType, streamList) => {
      if (updateType === "DELETE") {
        stopTimer();
        endCall();
      }
    });
  };

  const cleanup = async () => {
    stopTimer();

    try {
      const engine = ZegoExpressEngine.instance();
      engine.stopPublishingStream();
      engine.stopPlayingStream(chatId);
      engine.logoutRoom(chatId);
      await destroyEngine();
    } catch (err) {
      console.warn("⚠️ Engine cleanup failed:", err?.message);
    }
  };

  const startTimer = () => {
    timerRef.current = setInterval(() => {
      setCallTime((prevTime) => prevTime + 1);
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const endCall = async () => {
    if (alreadyEnded.current) return;
    alreadyEnded.current = true;

    stopTimer();

    try {
      const db = getDatabase();
      const callId = `call_${chatId}`;

      // ✅ Mark call ended in Firebase
      await update(ref(db, `calls/${callId}`), {
        status: "ended",
        statusHistory: ["calling", "connected", "ended"],
        endedAt: Date.now(),
      });

      // ✅ Log in chat
      await logCallMessage(
        chatId,
        isCaller ? callerData.userId : receiverData.userId,
        "Voice call ended",
        "ended"
      );

      console.log("✅ Firebase call status updated");
    } catch (error) {
      console.error("❌ Failed to update call status:", error.message);
    }

    try {
      await cleanup();
    } catch (err) {
      console.warn("⚠️ Cleanup skipped:", err.message);
    }

    // ✅ Smart Navigation Logic
    const routes = navigation.getState()?.routes;
    const current = routes?.[routes.length - 1]?.name;
    const previous = routes?.[routes.length - 2]?.name;

    console.log("📦 Current Route:", current);
    console.log("🔙 Previous Route:", previous);

    if (
      navigation.canGoBack() &&
      (current === "VoiceCall" || current === "IncomingCall")
    ) {
      navigation.goBack();
    } else if (
      previous &&
      previous !== "VoiceCall" &&
      previous !== "IncomingCall"
    ) {
      navigation.navigate(previous);
    } else {
      const lastScreen = lastKnownScreenRef.current;

      if (
        lastScreen &&
        lastScreen !== "VoiceCall" &&
        lastScreen !== "IncomingCall"
      ) {
        navigation.reset({
          index: 0,
          routes: [{ name: lastScreen }],
        });
      } else {
        navigation.reset({
          index: 1,
          routes: [
            { name: "Home" },
            {
              name: "ChatScreen",
              params: { userId: remoteUserId },
            },
          ],
        });
      }
    }
  };

  const toggleMute = () => {
    const newMute = !isMuted;
    setIsMuted(newMute);
    ZegoExpressEngine.instance().muteMicrophone(newMute);
  };

  const toggleSpeaker = () => {
    const newSpeaker = !isSpeakerOn;
    setIsSpeakerOn(newSpeaker);
    ZegoExpressEngine.instance().setAudioRouteToSpeaker(newSpeaker);
  };

  return (
    <ImageBackground source={backgroundImage} style={styles.container}>
      <Image
        source={
          userInfo.profilePicture
            ? { uri: userInfo.profilePicture }
            : defaultAvatar
        }
        style={styles.avatar}
      />
      <Text style={styles.name}>
        {userInfo.firstName} {userInfo.lastName}
      </Text>
      <Text style={styles.status}>
        {remoteUserJoined
          ? formatTime(callTime)
          : isCaller
          ? "Calling..."
          : "Ringing..."}
      </Text>

      <View style={styles.controls}>
        <TouchableOpacity onPress={toggleMute}>
          <Ionicons
            name={isMuted ? "mic-off" : "mic"}
            size={32}
            color={colors.grey}
            padding={12}
          />
        </TouchableOpacity>

        <TouchableOpacity onPress={endCall} style={styles.endCallButton}>
          <Ionicons name="call" size={32} color={colors.nearlyWhite} />
        </TouchableOpacity>

        <TouchableOpacity onPress={toggleSpeaker}>
          <Ionicons
            name={isSpeakerOn ? "volume-high" : "volume-mute"}
            size={32}
            color={colors.grey}
            padding={12}
          />
        </TouchableOpacity>
      </View>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    resizeMode: "cover",
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 20,
  },
  name: {
    fontSize: 24,
    color: "black",
    fontWeight: "bold",
  },
  status: {
    fontSize: 18,
    color: "red",
    marginTop: 8,
    marginBottom: 40,
  },
  controls: {
    flexDirection: "row",
    width: "70%",
    justifyContent: "space-between",
    paddingHorizontal: 20,
  },
  endCallButton: {
    backgroundColor: "red",
    padding: 12,
    borderRadius: 50,
  },
});

export default VoiceCallScreen;
