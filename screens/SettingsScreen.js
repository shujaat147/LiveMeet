import { Feather, FontAwesome } from '@expo/vector-icons';
import React, { useCallback, useMemo, useReducer, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ActivityIndicator,
    ScrollView,
    Modal,
    TextInput,
    TouchableOpacity,
    FlatList,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';

import DataItem from '../components/DataItem';
import Input from '../components/Input';
import PageContainer from '../components/PageContainer';
import PageTitle from '../components/PageTitle';
import ProfileImage from '../components/ProfileImage';
import SubmitButton from '../components/SubmitButton';
import colors from '../constants/colors';
import languageOptions from '../constants/languageOptions';

import { updateLoggedInUserData } from '../store/authSlice';
import { updateSignedInUserData, userLogout } from '../utils/actions/authActions';
import { validateInput } from '../utils/actions/formActions';
import { reducer } from '../utils/reducers/formReducer';

const SettingsScreen = (props) => {
    const dispatch = useDispatch();

    const [isLoading, setIsLoading] = useState(false);
    const [showSuccessMessage, setShowSuccessMessage] = useState(false);
    const [languageModalVisible, setLanguageModalVisible] = useState(false);
    const [languageQuery, setLanguageQuery] = useState('');

    const userData = useSelector((state) => state.auth.userData);
    const starredMessages = useSelector((state) => state.messages.starredMessages ?? {});

    const firstName = userData.firstName || '';
    const lastName = userData.lastName || '';
    const email = userData.email || '';
    const about = userData.about || '';
    const preferredLanguage = userData.preferredLanguage ?? null;

    const initialState = {
        inputValues: {
            firstName,
            lastName,
            email,
            about,
            preferredLanguage,
        },
        inputValidities: {
            firstName: undefined,
            lastName: undefined,
            email: undefined,
            about: undefined,
            preferredLanguage: undefined,
        },
        formIsValid: false,
    };

    const [formState, dispatchFormState] = useReducer(reducer, initialState);

    const sortedStarredMessages = useMemo(() => {
        let result = [];
        const chats = Object.values(starredMessages);
        chats.forEach((chat) => {
            const chatMessages = Object.values(chat);
            result = result.concat(chatMessages);
        });
        return result;
    }, [starredMessages]);

    const inputChangedHandler = useCallback((inputId, inputValue) => {
        const result = validateInput(inputId, inputValue);
        dispatchFormState({ inputId, validationResult: result, inputValue });
    }, []);

    const saveHandler = useCallback(async () => {
        const updatedValues = formState.inputValues;
        try {
            setIsLoading(true);
            await updateSignedInUserData(userData.userId, updatedValues);
            dispatch(updateLoggedInUserData({ newData: updatedValues }));
            setShowSuccessMessage(true);
            setTimeout(() => setShowSuccessMessage(false), 3000);
        } catch (error) {
            console.log(error);
        } finally {
            setIsLoading(false);
        }
    }, [formState, dispatch]);

    const hasChanges = () => {
        const currentValues = formState.inputValues;
        return (
            currentValues.firstName !== firstName ||
            currentValues.lastName !== lastName ||
            currentValues.email !== email ||
            currentValues.about !== about ||
            currentValues.preferredLanguage !== preferredLanguage
        );
    };

    const displayLanguage =
        languageOptions.find((item) => item.value === formState.inputValues.preferredLanguage)?.label ||
        (formState.inputValues.preferredLanguage === null ? 'No Translation' : '');

    const filteredLanguages = [
        { label: 'No Translation', value: null },
        ...languageOptions.filter((item) =>
            item.label.toLowerCase().includes(languageQuery.toLowerCase())
        ),
    ];

    const selectLanguage = (item) => {
        inputChangedHandler('preferredLanguage', item.value);
        setLanguageModalVisible(false);
        setLanguageQuery(item.label);
    };

    return (
        <PageContainer>
            <PageTitle text="Settings" />

            <ScrollView contentContainerStyle={styles.formContainer} keyboardShouldPersistTaps="handled">
                <ProfileImage
                    size={80}
                    userId={userData.userId}
                    uri={userData.profilePicture}
                    showEditButton={true}
                />

                <Input
                    id="firstName"
                    label="First name"
                    icon="user-o"
                    iconPack={FontAwesome}
                    onInputChanged={inputChangedHandler}
                    autoCapitalize="none"
                    errorText={formState.inputValidities['firstName']}
                    initialValue={firstName}
                />

                <Input
                    id="lastName"
                    label="Last name"
                    icon="user-o"
                    iconPack={FontAwesome}
                    onInputChanged={inputChangedHandler}
                    autoCapitalize="none"
                    errorText={formState.inputValidities['lastName']}
                    initialValue={lastName}
                />

                <Input
                    id="email"
                    label="Email"
                    icon="mail"
                    iconPack={Feather}
                    onInputChanged={inputChangedHandler}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    errorText={formState.inputValidities['email']}
                    initialValue={email}
                />

                <Input
                    id="about"
                    label="About"
                    icon="user-o"
                    iconPack={FontAwesome}
                    onInputChanged={inputChangedHandler}
                    autoCapitalize="none"
                    errorText={formState.inputValidities['about']}
                    initialValue={about}
                />

                <View style={styles.inputWrapper}>
                    <Text style={styles.label}>Preferred Language</Text>
                    <TouchableOpacity
                        style={styles.dropdownInput}
                        onPress={() => {
                            setLanguageModalVisible(true);
                            setLanguageQuery('');
                        }}
                    >
                        <Text style={{ color: displayLanguage ? 'black' : 'gray' }}>
                            {displayLanguage || 'Select Language'}
                        </Text>
                    </TouchableOpacity>
                </View>

                <Modal
                    visible={languageModalVisible}
                    transparent
                    animationType="fade"
                    onRequestClose={() => setLanguageModalVisible(false)}
                >
                    <View style={styles.modalContainer}>
                        <View style={styles.modalBox}>
                            <TextInput
                                placeholder="Search Language"
                                style={styles.modalSearchInput}
                                value={languageQuery}
                                onChangeText={setLanguageQuery}
                            />
                            <FlatList
                                data={filteredLanguages}
                                keyExtractor={(item, index) => `${item.value ?? 'none'}-${index}`}
                                renderItem={({ item }) => (
                                    <TouchableOpacity
                                        onPress={() => selectLanguage(item)}
                                        style={styles.dropdownItem}
                                    >
                                        <Text style={styles.dropdownItemText}>{item.label}</Text>
                                    </TouchableOpacity>
                                )}
                                style={styles.dropdownList}
                            />
                        </View>
                    </View>
                </Modal>

                <View style={{ marginTop: 20 }}>
                    {showSuccessMessage && <Text>Saved!</Text>}

                    {isLoading ? (
                        <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 10 }} />
                    ) : (
                        hasChanges() && (
                            <SubmitButton
                                title="Save"
                                onPress={saveHandler}
                                style={{ marginTop: 20 }}
                                disabled={!formState.formIsValid}
                            />
                        )
                    )}
                </View>

                <DataItem
                    type="link"
                    title="Starred messages"
                    hideImage={true}
                    onPress={() =>
                        props.navigation.navigate('DataList', {
                            title: 'Starred messages',
                            data: sortedStarredMessages,
                            type: 'messages',
                        })
                    }
                />

                <SubmitButton
                    title="Logout"
                    onPress={() => dispatch(userLogout(userData))}
                    style={{ marginTop: 20 }}
                    color={colors.red}
                />
            </ScrollView>
        </PageContainer>
    );
};

const styles = StyleSheet.create({
    formContainer: {
        alignItems: 'center',
        paddingBottom: 20,
    },
    inputWrapper: {
        width: '100%',
        marginTop: 10,
    },
    label: {
        marginVertical: 8,
        fontFamily: 'regular',
        letterSpacing: 0.5,
        color: colors.grey,
        fontSize: 16
    },
    dropdownInput: {
        borderWidth: 1,
        borderColor: colors.red,
        borderRadius: 5,
        paddingVertical: 12,
        paddingHorizontal: 10,
        backgroundColor: 'white',
    },
    modalContainer: {
        flex: 1,
        backgroundColor: '#000000aa',
        justifyContent: 'center',
        paddingHorizontal: 20,
    },
    modalBox: {
        backgroundColor: 'white',
        borderRadius: 10,
        padding: 10,
        maxHeight: '80%',
    },
    modalSearchInput: {
        borderBottomWidth: 1,
        borderBottomColor: '#ccc',
        marginBottom: 10,
        paddingHorizontal: 8,
        paddingVertical: 6,
        fontSize: 22
    },
    dropdownItem: {
        paddingVertical: 10,
        paddingHorizontal: 10,
    },
    dropdownItemText: {
        fontSize: 18,
    },
    dropdownList: {
        maxHeight: 300,
    },
});

export default SettingsScreen;
