import React, { useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import { HeaderButtons, Item } from 'react-navigation-header-buttons';
import { useDispatch, useSelector } from 'react-redux';
import CustomHeaderButton from '../components/CustomHeaderButton';
import DataItem from '../components/DataItem';
import PageContainer from '../components/PageContainer';
import PageTitle from '../components/PageTitle';
import colors from '../constants/colors';
import { deleteEntireChatForUser } from '../utils/actions/userActions'; // ✅
import { removeChatData } from '../store/chatSlice'; // ✅
import { selectUserChats } from '../store/selectors/chatSelectors';

const ChatListScreen = props => {
    const dispatch = useDispatch();

    const selectedUser = props.route?.params?.selectedUserId;
    const selectedUserList = props.route?.params?.selectedUsers;
    const chatName = props.route?.params?.chatName;

    const userData = useSelector(state => state.auth.userData);
    const storedUsers = useSelector(state => state.users.storedUsers);

    const userChats = useSelector(selectUserChats);

    useEffect(() => {
        props.navigation.setOptions({
            headerRight: () => (
                <HeaderButtons HeaderButtonComponent={CustomHeaderButton}>
                    <Item
                        title="New chat"
                        iconName="create-outline"
                        onPress={() => props.navigation.navigate("NewChat")}
                    />
                </HeaderButtons>
            )
        });
    }, [props.navigation]);

    useEffect(() => {
        if (!selectedUser && !selectedUserList) return;

        let chatData;
        let navigationProps;

        if (selectedUser) {
            chatData = userChats.find(cd => !cd.isGroupChat && cd.users.includes(selectedUser));
        }

        if (chatData) {
            navigationProps = { chatId: chatData.key };
        } else {
            const chatUsers = selectedUserList || [selectedUser];
            if (!chatUsers.includes(userData.userId)) {
                chatUsers.push(userData.userId);
            }

            navigationProps = {
                newChatData: {
                    users: chatUsers,
                    isGroupChat: selectedUserList !== undefined,
                    chatName
                }
            };
        }

        props.navigation.navigate("ChatScreen", navigationProps);

        props.navigation.setParams({
            selectedUserId: undefined,
            selectedUsers: undefined,
            chatName: undefined
        });

    }, [props.route?.params, userChats]);

    // ✅ Handle delete confirmation
    const handleDeleteChat = (chatId) => {
        Alert.alert("Delete Chat", "Are you sure you want to delete this chat?", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Delete",
                style: "destructive",
                onPress: async () => {
                    await deleteEntireChatForUser(userData.userId, chatId);
                    dispatch(removeChatData(chatId));
                }
            }
        ]);
    };

    return (
        <PageContainer>
            <PageTitle text="Chats" />

            <View>
                <TouchableOpacity onPress={() => props.navigation.navigate("NewChat", { isGroupChat: true })}>
                    <Text style={styles.newGroupText}>New Group</Text>
                </TouchableOpacity>
            </View>

            <FlatList
                data={userChats}
                keyExtractor={(item) => item.key}
                renderItem={({ item }) => {
                    const chatData = item;
                    const chatId = chatData.key;
                    const isGroupChat = chatData.isGroupChat;

                    let title = "";
                    const subTitle = chatData.latestMessageText || "New chat";
                    let image = "";

                    if (isGroupChat) {
                        title = chatData.chatName;
                        image = chatData.chatImage
                            // ? chatData.chatImage
                            // : require("../assets/images/groupImage-1.png");
                    } else {
                        const otherUserId = chatData.users.find(uid => uid !== userData.userId);
                        const otherUser = storedUsers[otherUserId];

                        if (!otherUser) return null;

                        title = `${otherUser.firstName} ${otherUser.lastName}`;
                        image = otherUser.profilePicture;
                    }

                    return (
                        <DataItem
                            title={title}
                            subTitle={subTitle}
                            image={image}
                            onPress={() => props.navigation.navigate("ChatScreen", { chatId })}
                            onLongPress={() => handleDeleteChat(chatId)} // ✅ Added
                        />
                    );
                }}
            />
        </PageContainer>
    );
};

const styles = StyleSheet.create({
    newGroupText: {
        color: colors.blue,
        fontSize: 17,
        marginBottom: 5
    }
});

export default ChatListScreen;
