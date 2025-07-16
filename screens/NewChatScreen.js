import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Button,
  TextInput,
  ActivityIndicator,
  FlatList,
} from "react-native";
import { HeaderButtons, Item } from "react-navigation-header-buttons";
import CustomHeaderButton from "../components/CustomHeaderButton";
import PageContainer from "../components/PageContainer";
import { FontAwesome } from "@expo/vector-icons";
import colors from "../constants/colors";
import commonStyles from "../constants/commonStyles";
import { searchUsers } from "../utils/actions/userActions";
import DataItem from "../components/DataItem";
import { useDispatch, useSelector } from "react-redux";
import { setStoredUsers } from "../store/userSlice";
import ProfileImage from "../components/ProfileImage";
import { createChat } from "../utils/actions/chatActions";

const NewChatScreen = ({ navigation, route }) => {
  const dispatch = useDispatch();

  const [isLoading, setIsLoading] = useState(false);
  const [users, setUsers] = useState();
  const [noResultsFound, setNoResultsFound] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [chatName, setChatName] = useState("");
  const [selectedUsers, setSelectedUsers] = useState([]);

  const userData = useSelector((state) => state.auth.userData);
  const storedUsers = useSelector((state) => state.users.storedUsers);
  const storedChats = useSelector((state) => state.chats.chatsData || {});

  const selectedUsersFlatList = useRef();

  const chatId = route.params && route.params.chatId;
  const existingUsers = route.params && route.params.existingUsers;
  const isGroupChat = route?.params?.isGroupChat ?? false;
  const isNewChat = !chatId;
  const isGroupChatDisabled =
    selectedUsers.length === 0 || (isNewChat && chatName === "");
  const [isNavigating, setIsNavigating] = useState(false);

  useEffect(() => {
    const openChatForUser = async () => {
      const selectedUserId = route.params?.selectedUserId;
      if (!selectedUserId) return;

      const currentUserId = userData.userId;

      // 🔍 Try to find existing chat
      let existingChatId = null;
      for (const id in chatsData) {
        const chat = chatsData[id];
        if (
          !chat.isGroupChat &&
          chat.users.includes(selectedUserId) &&
          chat.users.includes(currentUserId)
        ) {
          existingChatId = id;
          break;
        }
      }

      if (existingChatId) {
        navigation.navigate("ChatScreen", { chatId: existingChatId });
      } else {
        navigation.navigate("ChatScreen", {
          newChatData: {
            users: [currentUserId, selectedUserId],
            isGroupChat: false,
            chatName: undefined,
          },
        });
      }
    };

    openChatForUser();
  }, [route.params?.selectedUserId]);

  useEffect(() => {
    navigation.setOptions({
      headerLeft: () => {
        return (
          <HeaderButtons HeaderButtonComponent={CustomHeaderButton}>
            <Item title="Close" onPress={() => navigation.goBack()} />
          </HeaderButtons>
        );
      },
      headerRight: () => {
        return (
          <HeaderButtons HeaderButtonComponent={CustomHeaderButton}>
            {isGroupChat && (
              <Item
                title={isNewChat ? "Create" : "Add"}
                disabled={isGroupChatDisabled}
                color={isGroupChatDisabled ? colors.lightGrey : undefined}
                onPress={async () => {
                  if (isNewChat) {
                    // create group chat now
                    const groupChatData = {
                      users: [userData.userId, ...selectedUsers],
                      isGroupChat: true,
                      chatName,
                    };
                    setIsNavigating(true);
                    try {
                      const newChatId = await createChat(
                        userData.userId,
                        groupChatData
                      );
                      navigation.navigate("ChatScreen", {
                        chatId: newChatId,
                        newChatData: groupChatData,
                      });
                    } catch (err) {
                      console.log("❌ Failed to create group chat:", err);
                    } finally {
                      setIsNavigating(false);
                    }
                  } else {
                    // existing group logic
                    navigation.navigate("ChatSettings", {
                      selectedUsers,
                      chatName,
                      chatId,
                    });
                  }
                }}
              />
            )}
          </HeaderButtons>
        );
      },
      headerTitle: isGroupChat ? "Add participants" : "New chat",
    });
  }, [chatName, selectedUsers]);

  useEffect(() => {
    const delaySearch = setTimeout(async () => {
      if (!searchTerm || searchTerm === "") {
        setUsers();
        setNoResultsFound(false);
        return;
      }

      setIsLoading(true);

      const usersResult = await searchUsers(searchTerm);
      delete usersResult[userData.userId];
      setUsers(usersResult);

      if (Object.keys(usersResult).length === 0) {
        setNoResultsFound(true);
      } else {
        setNoResultsFound(false);

        dispatch(setStoredUsers({ newUsers: usersResult }));
      }

      setIsLoading(false);
    }, 500);

    return () => clearTimeout(delaySearch);
  }, [searchTerm]);

  const userPressed = async (userId) => {
    console.log("🔍 User pressed:", userId);

    if (isNavigating || !userId || userId === userData?.userId) return;
    setIsNavigating(true);

    if (isGroupChat) {
      const newSelectedUsers = selectedUsers.includes(userId)
        ? selectedUsers.filter((id) => id !== userId)
        : selectedUsers.concat(userId);

      setSelectedUsers(newSelectedUsers);
      setIsNavigating(false);
      return;
    }

    const existingChat = Object.values(storedChats).find(
      (chat) =>
        !chat.isGroupChat &&
        chat.users.length === 2 &&
        chat.users.includes(userId) &&
        chat.users.includes(userData.userId)
    );

    if (existingChat) {
      console.log("✅ Found existing chat:", existingChat.key);
      navigation.navigate("ChatScreen", {
        chatId: existingChat.key,
        chatData: existingChat,
      });
      setIsNavigating(false);
      return;
    }

    navigation.navigate("ChatScreen", {
      newChatData: {
        users: [userData.userId, userId],
        isGroupChat: false,
        chatName: undefined,
      },
    });
    setIsNavigating(false);
  };
  return (
    <PageContainer>
      {isNewChat && isGroupChat && (
        <View style={styles.chatNameContainer}>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.textbox}
              placeholder="Enter a name for your chat"
              autoCorrect={false}
              autoComplete="off"
              onChangeText={(text) => setChatName(text)}
            />
          </View>
        </View>
      )}

      {isGroupChat && (
        <View style={styles.selectedUsersContainer}>
          <FlatList
            style={styles.selectedUsersList}
            data={selectedUsers}
            horizontal={true}
            keyExtractor={(item) => item}
            contentContainerStyle={{ alignItems: "center" }}
            ref={(ref) => (selectedUsersFlatList.current = ref)}
            onContentSizeChange={() =>
              selectedUsersFlatList.current.scrollToEnd()
            }
            renderItem={(itemData) => {
              const userId = itemData.item;
              const userData = storedUsers[userId];
              return (
                <ProfileImage
                  style={styles.selectedUserStyle}
                  size={40}
                  uri={userData.profilePicture}
                  onPress={() => userPressed(userId)}
                  showRemoveButton={true}
                />
              );
            }}
          />
        </View>
      )}

      <View style={styles.searchContainer}>
        <FontAwesome name="search" size={15} color={colors.red} />

        <TextInput
          placeholder="Search"
          style={styles.searchBox}
          onChangeText={(text) => setSearchTerm(text)}
        />
      </View>

      {isLoading && (
        <View style={commonStyles.center}>
          <ActivityIndicator size={"large"} color={colors.primary} />
        </View>
      )}

      {!isLoading && !noResultsFound && users && (
        <FlatList
          data={Object.keys(users)}
          renderItem={(itemData) => {
            const userId = itemData.item;
            const userData = users[userId];

            if (existingUsers && existingUsers.includes(userId)) {
              return;
            }

            return (
              <DataItem
                title={`${userData.firstName} ${userData.lastName}`}
                subTitle={userData.email}
                image={userData.profilePicture}
                onPress={() => userPressed(userId)}
                type={isGroupChat ? "checkbox" : ""}
                isChecked={selectedUsers.includes(userId)}
              />
            );
          }}
        />
      )}

      {!isLoading && noResultsFound && (
        <View style={commonStyles.center}>
          <FontAwesome
            name="question"
            size={55}
            color={colors.red}
            style={styles.noResultsIcon}
          />
          <Text style={styles.noResultsText}>No users found!</Text>
        </View>
      )}

      {!isLoading && !users && (
        <View style={commonStyles.center}>
          <FontAwesome
            name="users"
            size={55}
            color={colors.red}
            style={styles.noResultsIcon}
          />
          <Text style={styles.noResultsText}>
            Enter a name to search for a user!
          </Text>
        </View>
      )}
    </PageContainer>
  );
};

const styles = StyleSheet.create({
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.extraLightGrey,
    height: 40,
    marginVertical: 8,
    paddingHorizontal: 8,
    paddingVertical: 0,
    borderRadius: 5,
  },
  searchBox: {
    marginLeft: 8,
    fontSize: 15,
    width: "100%",
  },
  noResultsIcon: {
    marginBottom: 20,
  },
  noResultsText: {
    color: colors.red,
    fontFamily: "regular",
    letterSpacing: 0.3,
  },
  chatNameContainer: {
    paddingVertical: 10,
  },
  inputContainer: {
    width: "100%",
    paddingHorizontal: 10,
    paddingVertical: 15,
    backgroundColor: colors.nearlyWhite,
    flexDirection: "row",
    borderRadius: 2,
  },
  textbox: {
    color: colors.textColor,
    width: "100%",
    fontFamily: "regular",
    letterSpacing: 0.3,
  },
  selectedUsersContainer: {
    height: 50,
    justifyContent: "center",
  },
  selectedUsersList: {
    height: "100%",
    paddingTop: 10,
  },
  selectedUserStyle: {
    marginRight: 10,
    marginBottom: 10,
  },
});

export default NewChatScreen;
