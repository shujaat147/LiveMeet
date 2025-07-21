import React, { useCallback, useEffect, useReducer, useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import DataItem from '../components/DataItem';
import Input from '../components/Input';
import PageContainer from '../components/PageContainer';
import PageTitle from '../components/PageTitle';
import ProfileImage from '../components/ProfileImage';
import SubmitButton from '../components/SubmitButton';
import colors from '../constants/colors';
import { addUsersToChat, removeUserFromChat, updateChatData, deleteGroup } from '../utils/actions/chatActions';
import { validateInput } from '../utils/actions/formActions';
import { reducer } from '../utils/reducers/formReducer';
import { removeChatData } from "../store/chatSlice";
import { selectChatById, selectStoredUsers, selectStarredMessagesByChatId } from "../store/selectors/chatSelectors";

const ChatSettingsScreen = props => {

    const [isLoading, setIsLoading] = useState(false);
    const [showSuccessMessage, setShowSuccessMessage] = useState(false);

    const chatId = props.route.params.chatId;
    const chatData = useSelector(state => selectChatById(state, chatId)) || {};
    const userData = useSelector(state => state.auth.userData);
    const storedUsers = useSelector(selectStoredUsers);
    const starredMessages = useSelector(state => selectStarredMessagesByChatId(state, chatId));
    const dispatch = useDispatch();

    const usersArray = useMemo(
        () => Array.isArray(chatData.users) ? chatData.users : [],
        [chatData.users]
    );

    const initialState = {
        inputValues: { chatName: chatData.chatName },
        inputValidities: { chatName: undefined },
        formIsValid: false
    }

    const [formState, dispatchFormState] = useReducer(reducer, initialState);

    const selectedUsers = props.route.params && props.route.params.selectedUsers;

    useEffect(() => {
        if (!selectedUsers) return;

        const run = async () => {
            const selectedUserData = [];

            selectedUsers.forEach(uid => {
                if (uid === userData.userId) return;
                if (!storedUsers[uid]) return;

                selectedUserData.push(storedUsers[uid]);
            });

            await addUsersToChat(userData, selectedUserData, chatData);
        };

        run();
    }, [selectedUsers]);

    const inputChangedHandler = useCallback((inputId, inputValue) => {
        const result = validateInput(inputId, inputValue);
        dispatchFormState({ inputId, validationResult: result, inputValue })
    }, [dispatchFormState]);

    const saveHandler = useCallback(async () => {
        const updatedValues = formState.inputValues;

        try {
            setIsLoading(true);
            await updateChatData(chatId, userData.userId, updatedValues);

            setShowSuccessMessage(true);

            setTimeout(() => {
                setShowSuccessMessage(false)
            }, 1500);
        } catch (error) {
            console.log(error);
        }
        finally {
            setIsLoading(false);
        }
    }, [formState]);

    const hasChanges = () => {
        const currentValues = formState.inputValues;
        return currentValues.chatName != chatData.chatName;
    }

    const leaveChat = useCallback(async () => {
        try {
            setIsLoading(true);

            await removeUserFromChat(userData, userData, chatData);

            props.navigation.popToTop();
        } catch (error) {
            console.log(error);
        }
        finally {
            setIsLoading(false);
        }
    }, [props.navigation, isLoading])

    const deleteGroupHandler = async () => {
        try {
            setIsLoading(true);
            await deleteGroup(chatId, chatData.users);
            dispatch(removeChatData(chatId)); // <-- REMOVE LOCALLY
            props.navigation.popToTop();
        } catch (error) {
            console.log(error);
        } finally {
            setIsLoading(false);
        }
    };

    const displayedUsers = useMemo(() => {
        return usersArray.slice(0, 4).map(uid => {
            const currentUser = storedUsers[uid];
            return {
                key: uid,
                image: currentUser?.profilePicture,
                title: `${currentUser?.firstName || ""} ${currentUser?.lastName || ""}`,
                subTitle: currentUser?.about,
                type: uid !== userData.userId && "link",
                onPress: () => uid !== userData.userId && props.navigation.navigate("Contact", { uid, chatId }),
            };
        });
    }, [usersArray, storedUsers, userData.userId, props.navigation, chatId]);

    return <PageContainer>
        <PageTitle text="Chat Settings" />

        <ScrollView contentContainerStyle={styles.scrollView}>
            <ProfileImage
                showEditButton={true}
                size={80}
                chatId={chatId}
                userId={userData.userId}
                uri={chatData.chatImage ? chatData.chatImage : chatData.groupImage }
            />

            <Input
                id="chatName"
                label="Chat name"
                autoCapitalize="none"
                initialValue={chatData.chatName}
                allowEmpty={false}
                onInputChanged={inputChangedHandler}
                errorText={formState.inputValidities["chatName"]}
            />


            <View style={styles.sectionContainer}>
                <Text style={styles.heading}>{chatData.users?.length} Participants</Text>

                <DataItem
                    title="Add users"
                    icon="plus"
                    type="button"
                    onPress={() => props.navigation.navigate("NewChat", { isGroupChat: true, existingUsers: chatData.users, chatId })}
                />

                {displayedUsers.map(item =>
                    <DataItem
                        key={item.key}
                        image={item.image}
                        title={item.title}
                        subTitle={item.subTitle}
                        type={item.type}
                        onPress={item.onPress}
                    />
                )}

                {
                    chatData.users?.length > 4 &&
                    <DataItem
                        type={"link"}
                        title="View all"
                        hideImage={true}
                        onPress={() => {
                            const participants = chatData.users
                                .map(uid => storedUsers[uid])
                                .filter(Boolean); // Remove any undefined users
                            props.navigation.navigate("DataList", { title: "Participants", data: participants, type: "users", chatId });
                        }}
                    />
                }
            </View>

            {showSuccessMessage && <Text>Saved!</Text>}
            {
                isLoading ?
                    <ActivityIndicator size={'small'} color={colors.primary} /> :
                    hasChanges() && <SubmitButton
                        title="Save changes"
                        color={colors.primary}
                        onPress={saveHandler}
                        disabled={!formState.formIsValid}
                    />
            }

            <DataItem
                type={"link"}
                title="Starred messages"
                hideImage={true}
                onPress={() => props.navigation.navigate("DataList", { title: "Starred messages", data: Object.values(starredMessages), type: "messages" })}
            />

        </ScrollView>
        {console.log("chatData:", chatData, "userData:", userData)}
        {
            chatData.isGroupChat && chatData.createdBy === userData.userId && (
                <SubmitButton
                    title="Delete Group"
                    color={colors.red}
                    onPress={() => deleteGroupHandler()}
                    style={{ marginBottom: 10 }}
                />
            )
        }

        {
            <SubmitButton
                title="Leave chat"
                color={colors.red}
                onPress={() => leaveChat()}
                style={{ marginBottom: 20 }}
            />
        }
    </PageContainer>
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center'
    },
    scrollView: {
        justifyContent: 'center',
        alignItems: 'center'
    },
    sectionContainer: {
        width: '100%',
        marginTop: 10
    },
    heading: {
        marginVertical: 8,
        color: colors.textColor,
        fontFamily: 'bold',
        letterSpacing: 0.3
    }
})

export default ChatSettingsScreen;