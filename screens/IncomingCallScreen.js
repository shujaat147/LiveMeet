import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Vibration,
} from "react-native";
import { Audio } from "expo-av";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { getDatabase, ref, update, onValue } from "firebase/database";
import { getFirebaseApp } from "../utils/firebaseHelper";
import colors from "../constants/colors";
import ringtone from "../assets/voicecall.mp3";

const IncomingCallScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { callId, chatId, callerData, receiverData } = route.params;
  const ringtoneSound = useRef(null);

  if (!callId || !chatId || !callerData || !receiverData) {
    return (
      <View style={styles.container}>
        <Text style={styles.status}>Invalid call data</Text>
      </View>
    );
  }

  useEffect(() => {
    const playRingtone = async () => {
      try {
        ringtoneSound.current = new Audio.Sound();
        await ringtoneSound.current.loadAsync(ringtone);
        await ringtoneSound.current.setIsLoopingAsync(true);
        await ringtoneSound.current.playAsync();
      } catch (err) {
        console.log("❌ Error playing ringtone:", err);
      }
    };

    playRingtone();
    Vibration.vibrate([500, 500, 500], true);

    const app = getFirebaseApp();
    const db = getDatabase(app);
    const callRef = ref(db, `calls/${callId}`);

    const unsubscribe = onValue(callRef, (snapshot) => {
      const data = snapshot.val();
      if (data?.status === "ended") {
        Vibration.cancel();
        navigation.goBack(); // Exit IncomingCallScreen
      }
    });

    return () => {
      Vibration.cancel();
      if (ringtoneSound.current) {
        ringtoneSound.current.stopAsync();
        ringtoneSound.current.unloadAsync();
      }
      unsubscribe();
    };
  }, []);

  const handleReject = async () => {
    const app = getFirebaseApp();
    const db = getDatabase(app);
    await update(ref(db, `calls/${callId}`), { status: "ended" });
    Vibration.cancel();
    if (ringtoneSound.current) {
      await ringtoneSound.current.stopAsync();
      await ringtoneSound.current.unloadAsync(); // optional: free memory
    }
    navigation.goBack();
  };

  const handleAccept = async () => {
    const app = getFirebaseApp();
    const db = getDatabase(app);
    await update(ref(db, `calls/${callId}`), { status: "connected" });
    Vibration.cancel();
    if (ringtoneSound.current) {
      await ringtoneSound.current.stopAsync();
      await ringtoneSound.current.unloadAsync();
    }

    navigation.replace("VoiceCall", {
      chatId,
      callerData,
      receiverData,
      isCaller: false,
    });
  };

  return (
    <View style={styles.container}>
      <Image
        source={
          callerData.profilePicture
            ? { uri: callerData.profilePicture }
            : require("../assets/images/userImage-1.png")
        }
        style={styles.avatar}
      />
      <Text style={styles.name}>
        {callerData.firstName} {callerData.lastName}
      </Text>
      <Text style={styles.status}>Incoming Voice Call...</Text>

      <View style={styles.buttonsContainer}>
        <TouchableOpacity
          onPress={handleReject}
          style={[styles.circleButton, styles.red]}
        >
          <Ionicons name="close" size={32} color="white" />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleAccept}
          style={[styles.circleButton, styles.green]}
        >
          <Ionicons name="call" size={32} color="white" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.grey,
    alignItems: "center",
    justifyContent: "center",
  },
  avatar: {
    width: 210,
    height: 210,
    borderRadius: 100,
    marginBottom: 20,
  },
  name: {
    fontSize: 24,
    color: "white",
    fontWeight: "bold",
  },
  status: {
    fontSize: 18,
    color: "white",
    marginTop: 8,
    marginBottom: 40,
  },
  buttonsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "60%",
  },
  circleButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: "center",
    alignItems: "center",
  },
  red: {
    backgroundColor: "#e74c3c",
  },
  green: {
    backgroundColor: "#2ecc71",
  },
});

export default IncomingCallScreen;
