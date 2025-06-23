import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import React, { useEffect, useRef, useState } from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";

import ChatSettingsScreen from "../screens/ChatSettingsScreen";
import SettingsScreen from "../screens/SettingsScreen";
import ChatListScreen from "../screens/ChatListScreen";
import ChatScreen from "../screens/ChatScreen";
import NewChatScreen from "../screens/NewChatScreen";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useDispatch, useSelector } from "react-redux";
import { getFirebaseApp } from "../utils/firebaseHelper";
import { child, get, getDatabase, off, onValue, ref } from "firebase/database";
import { setChatsData } from "../store/chatSlice";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  View,
} from "react-native";
import colors from "../constants/colors";
import commonStyles from "../constants/commonStyles";
import { setStoredUsers } from "../store/userSlice";
import { setChatMessages, setStarredMessages } from "../store/messagesSlice";
import ContactScreen from "../screens/ContactScreen";
import DataListScreen from "../screens/DataListScreen";
import VoiceCallScreen from "../screens/VoiceCallScreen";
import { StackActions, useNavigation } from "@react-navigation/native";
import IncomingCallScreen from "../screens/IncomingCallScreen";
import FullScreenImageScreen from "../screens/FullScreenImageScreen";

export const lastKnownScreenRef = { current: null };

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const TabNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerTitle: "",
        headerShadowVisible: false,
      }}
    >
      <Tab.Screen
        name="ChatList"
        component={ChatListScreen}
        options={{
          tabBarLabel: "Chats",
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="chatbubble-outline"
              size={size}
              color={colors.red}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarLabel: "Settings",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size} color={colors.red} />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

const StackNavigator = () => {
  return (
    <Stack.Navigator>
      <Stack.Group>
        <Stack.Screen
          name="Home"
          component={TabNavigator}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="ChatScreen"
          component={ChatScreen}
          options={{
            headerTitle: "",
            headerBackTitle: "Back",
          }}
        />
        <Stack.Screen
          name="ChatSettings"
          component={ChatSettingsScreen}
          options={{
            headerTitle: "",
            headerBackTitle: "Back",
            headerShadowVisible: false,
          }}
        />
        <Stack.Screen
          name="Contact"
          component={ContactScreen}
          options={{
            headerTitle: "Contact info",
            headerBackTitle: "Back",
          }}
        />
        <Stack.Screen
          name="DataList"
          component={DataListScreen}
          options={{
            headerTitle: "",
            headerBackTitle: "Back",
          }}
        />
        <Stack.Screen
          name="VoiceCall"
          component={VoiceCallScreen}
          options={{
            headerTitle: "Voice Call",
            headerBackVisible: false, // ✅ Hide back button only
            gestureEnabled: false, // 🚫 Optional: Prevent swipe back
          }}
        />
        <Stack.Screen
          name="IncomingCall"
          component={IncomingCallScreen}
          options={{
            headerShown: false,
            presentation: "fullScreenModal",
          }}
        />
      </Stack.Group>

      <Stack.Group screenOptions={{ presentation: "containedModal" }}>
        <Stack.Screen name="NewChat" component={NewChatScreen} />
      </Stack.Group>
      <Stack.Screen
        name="FullScreenImage"
        component={FullScreenImageScreen}
        options={{
          headerShown: false,
          presentation: "transparentModal",
        }}
      />
    </Stack.Navigator>
  );
};

let isIncomingCallScreenVisible = false;

const MainNavigator = ({ isNavigationReady }) => {
  const dispatch = useDispatch();
  const navigation = useNavigation();

  const hasNavigatedToVoiceCall = useRef(false);
  const callHasAlreadyEnded = useRef(false);

  const [isLoading, setIsLoading] = useState(true);

  const userData = useSelector((state) => state.auth.userData);
  const storedUsers = useSelector((state) => state.users.storedUsers);

  const [expoPushToken, setExpoPushToken] = useState("");
  const notificationListener = useRef();
  const responseListener = useRef();

  const hasShownIncomingCallOnce = useRef(false);
  const debounceTimer = useRef(null);

  useEffect(() => {
    registerForPushNotificationsAsync().then((token) =>
      setExpoPushToken(token)
    );

    notificationListener.current =
      Notifications.addNotificationReceivedListener((notification) => {
        // Handle received notification
      });

    responseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const { data } = response.notification.request.content;
        const chatId = data["chatId"];

        const currentRoute = navigation.getState()?.routes?.slice(-1)[0]?.name;

        // ⛔ Prevent navigating if already on VoiceCall or IncomingCall
        if (
          chatId &&
          currentRoute !== "VoiceCall" &&
          currentRoute !== "IncomingCall"
        ) {
          const pushAction = StackActions.push("ChatScreen", { chatId });
          navigation.dispatch(pushAction);
        } else {
          console.log(
            "🚫 Skipped navigating to ChatScreen due to current screen:",
            currentRoute
          );
        }
      });

    return () => {
      Notifications.removeNotificationSubscription(
        notificationListener.current
      );
      Notifications.removeNotificationSubscription(responseListener.current);
    };
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener("state", () => {
      const navState = navigation.getState();
      const routes = navState?.routes;
      const currentRoute = routes?.[routes.length - 1]?.name;

      isIncomingCallScreenVisible = routes?.some(
        (r) => r.name === "IncomingCall"
      );

      if (
        currentRoute !== "VoiceCall" &&
        currentRoute !== "IncomingCall" &&
        currentRoute !== lastKnownScreenRef.current
      ) {
        lastKnownScreenRef.current = currentRoute;
      }
    });

    return unsubscribe;
  }, [navigation]);

  const previousRouteRef = useRef(null);

  useEffect(() => {
    if (!userData?.userId) {
      console.log("⏳ userData not ready, delaying call listener setup...");
      return;
    }

    console.log("✅ Firebase listeners initializing for:", userData.userId);

    const app = getFirebaseApp();
    const dbRef = ref(getDatabase(app));
    const db = getDatabase(app);

    const userChatsRef = child(dbRef, `userChats/${userData.userId}`);
    const refs = [userChatsRef];

    onValue(userChatsRef, (querySnapshot) => {
      const chatIdsData = querySnapshot.val() || {};
      const chatIds = Object.values(chatIdsData);

      if (chatIds.length === 0) {
        setIsLoading(false); // 🛠️ Unblock loading for new users
        return;
      }

      const chatsData = {};
      let chatsFoundCount = 0;

      for (let i = 0; i < chatIds.length; i++) {
        const chatId = chatIds[i];
        const chatRef = child(dbRef, `chats/${chatId}`);
        refs.push(chatRef);

        onValue(chatRef, (chatSnapshot) => {
          chatsFoundCount++;
          const data = chatSnapshot.val();

          if (data) {
            if (!data.users.includes(userData.userId)) return;

            data.key = chatSnapshot.key;

            data.users.forEach((userId) => {
              if (storedUsers[userId]) return;

              const userRef = child(dbRef, `users/${userId}`);
              get(userRef).then((userSnapshot) => {
                const userSnapshotData = userSnapshot.val();
                dispatch(
                  setStoredUsers({ newUsers: { [userId]: userSnapshotData } })
                );
              });

              refs.push(userRef);
            });

            chatsData[chatSnapshot.key] = data;
          }

          if (chatsFoundCount >= chatIds.length) {
            dispatch(setChatsData({ chatsData }));
            setIsLoading(false);
          }
        });

        const messagesRef = child(dbRef, `messages/${chatId}`);
        refs.push(messagesRef);

        onValue(messagesRef, (messagesSnapshot) => {
          const messagesData = messagesSnapshot.val();
          dispatch(setChatMessages({ chatId, messagesData }));
        });

        if (chatsFoundCount === 0) {
          setIsLoading(false);
        }
      }
    });

    const userStarredMessagesRef = child(
      dbRef,
      `userStarredMessages/${userData.userId}`
    );
    refs.push(userStarredMessagesRef);

    onValue(userStarredMessagesRef, (querySnapshot) => {
      const starredMessages = querySnapshot.val() ?? {};
      dispatch(setStarredMessages({ starredMessages }));
    });

    // 🔊 Incoming Call Listener
    const callRef = ref(db, "calls");
    refs.push(callRef);

    onValue(callRef, (snapshot) => {
      const callsData = snapshot.val();
      if (!callsData) return;

      if (!hasShownIncomingCallOnce.current) {
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        debounceTimer.current = setTimeout(() => {
          hasShownIncomingCallOnce.current = true;
          detectAndHandleCallEvents(callsData);
        }, 1000);
      } else {
        detectAndHandleCallEvents(callsData);
      }
    });

    const detectAndHandleCallEvents = (callsData) => {
      const navState = navigation.getState();
      const currentRouteName =
        navState?.routes?.[navState.routes.length - 1]?.name;
      previousRouteRef.current = currentRouteName;

      // 📲 Incoming call for receiver
      const incomingCallEntry = Object.entries(callsData).find(
        ([id, call]) =>
          call.receiverId === userData.userId &&
          call.callerId !== userData.userId &&
          call.status === "calling"
      );

      if (incomingCallEntry) {
        const [callId, call] = incomingCallEntry;
        const { chatId, callerId } = call;

        const caller = storedUsers[callerId];
        if (!caller) {
          const userRef = child(ref(getDatabase()), `users/${callerId}`);
          get(userRef).then((snap) => {
            const userSnapshotData = snap.val();
            if (userSnapshotData) {
              dispatch(
                setStoredUsers({ newUsers: { [callerId]: userSnapshotData } })
              );
              setTimeout(() => {
                if (!isIncomingCallScreenVisible && navigation.isReady()) {
                  navigation.navigate("IncomingCall", {
                    callId,
                    chatId,
                    callerData: userSnapshotData,
                    receiverData: userData,
                  });
                }
              }, 300);
            }
          });
        } else if (!isIncomingCallScreenVisible && navigation.isReady()) {
          navigation.navigate("IncomingCall", {
            callId,
            chatId,
            callerData: caller,
            receiverData: userData,
          });
        }
      }

      // ✅ Call connected → show VoiceCallScreen
      const connectedCallEntry = Object.entries(callsData).find(
        ([id, call]) =>
          call.callerId === userData.userId && call.status === "connected"
      );

      if (connectedCallEntry) {
        const [callId, call] = connectedCallEntry;
        const { chatId, receiverId } = call;
        const receiver = storedUsers[receiverId];

        const routes = navigation.getState()?.routes;
        const currentRoute = routes?.[routes.length - 1];

        const alreadyInVoiceCall =
          currentRoute?.name === "VoiceCall" ||
          currentRoute?.name === "IncomingCall";

        if (
          receiver &&
          !alreadyInVoiceCall &&
          !hasNavigatedToVoiceCall.current
        ) {
          hasNavigatedToVoiceCall.current = true;
          console.log(
            "✅ Receiver accepted the call — navigating to VoiceCall screen"
          );

          setTimeout(() => {
            navigation.navigate("VoiceCall", {
              chatId,
              callId,
              callerData: userData,
              receiverData: receiver,
              isCaller: true,
            });
          }, 300);
        }
      }

      // 📴 Call ended
      const endedCallEntry = Object.entries(callsData).find(([id, call]) => {
        const isRelevantUser =
          call.receiverId === userData.userId ||
          call.callerId === userData.userId;

        const currentRoute = navigation.getState()?.routes?.slice(-1)[0]?.name;

        const isActiveScreen =
          currentRoute === "VoiceCall" || currentRoute === "IncomingCall";

        const isRecentEnough = Date.now() - (call.timestamp || 0) > 3000;

        if (call.status === "calling") return false;

        return (
          isRelevantUser &&
          call.status === "ended" &&
          isActiveScreen &&
          isRecentEnough
        );
      });

      if (endedCallEntry && !callHasAlreadyEnded.current) {
        const [callId, call] = endedCallEntry;

        const callDuration = Date.now() - (call.timestamp || 0);
        if (callDuration < 5000) {
          console.log("🛑 Ignoring quick disconnect to avoid false end.");
          return;
        }

        console.log("📴 Call ended remotely — navigating back");
        callHasAlreadyEnded.current = true;

        setTimeout(() => {
          const wasOnCallScreen =
            previousRouteRef.current === "VoiceCall" ||
            previousRouteRef.current === "IncomingCall";

          const currentRoute = navigation
            .getState()
            ?.routes?.slice(-1)[0]?.name;

          if (navigation.canGoBack() && wasOnCallScreen) {
            navigation.goBack();
          } else if (
            previousRouteRef.current &&
            previousRouteRef.current !== "VoiceCall" &&
            previousRouteRef.current !== "IncomingCall"
          ) {
            navigation.navigate(previousRouteRef.current);
          } else {
            navigation.reset({ index: 0, routes: [{ name: "Home" }] });
          }
        }, 500);
      }
    };

    return () => {
      console.log("🧹 Unsubscribing Firebase listeners");
      refs.forEach((refNode) => off(refNode));
    };
  }, [userData, storedUsers]);

  if (isLoading) {
    return (
      <View style={commonStyles.center}>
        <ActivityIndicator size={"large"} color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <StackNavigator />
    </KeyboardAvoidingView>
  );
};

export default MainNavigator;

async function registerForPushNotificationsAsync() {
  let token;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#FF231F7C",
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") {
      alert("Failed to get push token for push notification!");
      return;
    }
    token = (await Notifications.getExpoPushTokenAsync()).data;
  } else {
    console.log("Must use physical device for Push Notifications");
  }

  return token;
}
