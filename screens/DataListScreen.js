import React, { useEffect, useState, } from 'react';
import { FlatList, Text, Alert, TouchableOpacity, View } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import DataItem from '../components/DataItem';
import PageContainer from '../components/PageContainer';
import { decryptMessage } from "../utils/encryptionHelper";
import { starMessage } from "../utils/actions/chatActions"; // your toggle action
import { Feather } from '@expo/vector-icons'; // or MaterialIcons
import colors from '../constants/colors';

const DataListScreen = props => {

    const storedUsers = useSelector(state => state.users.storedUsers);
    const userData = useSelector(state => state.auth.userData);
    const messagesData = useSelector(state => state.messages.messagesData);
    const starredMessages = useSelector(state => state.messages.starredMessages ?? {});

    const sortedStarredMessages = React.useMemo(() => {
        let result = [];
        const chats = Object.values(starredMessages);
        chats.forEach((chat) => {
            const chatMessages = Object.values(chat);
            result = result.concat(chatMessages);
        });
        // You can sort here if desired
        return result;
    }, [starredMessages]);

    const dispatch = useDispatch();
    const handleRemoveStar = (chatId, messageId) => {
        Alert.alert(
            "Remove Star",
            "Remove this message from your starred messages?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Remove",
                    style: "destructive",
                    onPress: () => {
                        dispatch(starMessage(chatId, messageId)); // toggles off star in DB + Redux
                    }
                }
            ]
        );
    };

    const [decryptedStarred, setDecryptedStarred] = useState([]);

    useEffect(() => {
        async function decryptAll() {
            const processed = await Promise.all(sortedStarredMessages.map(async item => {
                const { chatId, messageId } = item;
                const messagesForChat = messagesData?.[chatId];
                const messageData = messagesForChat?.[messageId];
                if (!messageData) return null;

                let decrypted = messageData.text;
                if (messageData.iv) {
                    try {
                        decrypted = await decryptMessage(messageData.text, messageData.iv);
                    } catch {
                        decrypted = "[Decrypting error]";
                    }
                }
                return {
                    ...item,
                    text: decrypted,
                    sentBy: messageData.sentBy,
                    name: (messageData.sentBy && storedUsers[messageData.sentBy])
                        ? `${storedUsers[messageData.sentBy].firstName} ${storedUsers[messageData.sentBy].lastName}`
                        : "",
                    image: (messageData.sentBy && storedUsers[messageData.sentBy])
                        ? storedUsers[messageData.sentBy].profilePicture
                        : null,
                    date: messageData.sentAt || messageData.timestamp || null, // <-- add this
                };
            }));
            setDecryptedStarred(processed.filter(Boolean));
        }
        decryptAll();
    }, [sortedStarredMessages, messagesData, storedUsers]);

    const { title, type, chatId } = props.route.params;

    useEffect(() => {
        props.navigation.setOptions({ headerTitle: title })
    }, [title])

    function formatDate(date) {
        if (!date) return "";
        const d = new Date(date);
        // Example output: "13 Jul 2025"
        return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    }

    return (
        <PageContainer>
            <FlatList
                data={type === "users" ? props.route.params.data : decryptedStarred}
                keyExtractor={item => {
                    // For users, key by userId, fallback to item if string
                    if (type === "users") {
                        if (typeof item === "string") return item;
                        return item.userId || item._id || String(Math.random());
                    }
                    // For messages
                    return item.messageId || String(Math.random());
                }}
                renderItem={(itemData) => {
                    if (type === "users") {
                        // Support both uid string and user object
                        const user = typeof itemData.item === "string"
                            ? storedUsers[itemData.item]
                            : itemData.item;
                        if (!user) return null;
                        const isLoggedInUser = user.userId === userData.userId;

                        return (
                            <DataItem
                                key={user.userId}
                                image={user.profilePicture}
                                title={`${user.firstName || ""} ${user.lastName || ""}`}
                                subTitle={user.about}
                                type={isLoggedInUser ? undefined : "link"}
                                onPress={isLoggedInUser ? undefined : () =>
                                    props.navigation.navigate("Contact", { uid: user.userId, chatId })
                                }
                            />
                        );
                    }
                    // Existing starred messages rendering
                    else if (type === "messages") {
                        const starData = itemData.item;

                        return (
                            <DataItem
                                key={starData.messageId}
                                image={starData.image}
                                onPress={() => {
                                    props.navigation.navigate("ChatScreen", {
                                        chatId: starData.chatId,
                                        scrollToMessageId: starData.messageId,
                                    });
                                }}
                                title={
                                    starData.sentBy === userData.userId
                                        ? `${starData.name} (You)`
                                        : starData.name
                                }
                                subTitle={starData.text}
                                rightContent={
                                    <View style={{ alignItems: "flex-end" }}>
                                        <Text style={{
                                            color: "#888",
                                            fontSize: 12,
                                            marginBottom: 3,
                                            fontFamily: "regular",
                                            textAlign: "right"
                                        }}>
                                            {formatDate(starData.date)}
                                        </Text>
                                        <TouchableOpacity
                                            onPress={() => handleRemoveStar(starData.chatId, starData.messageId)}
                                            style={{ alignSelf: "flex-end", marginTop: 2 }}
                                        >
                                            <Feather name="trash-2" size={22} color={colors.red} />
                                        </TouchableOpacity>
                                    </View>
                                }
                            />
                        );
                    }
                }}
            />
        </PageContainer>
    );
}

export default DataListScreen;