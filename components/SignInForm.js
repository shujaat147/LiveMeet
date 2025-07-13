import React, { useCallback, useEffect, useReducer, useState } from 'react';
import { TouchableOpacity, Alert, Text, ActivityIndicator, View, Modal } from 'react-native';
import Input from '../components/Input';
import SubmitButton from '../components/SubmitButton';
import { Feather } from '@expo/vector-icons';

import { validateInput } from '../utils/actions/formActions';
import { reducer } from '../utils/reducers/formReducer';
import { signIn } from '../utils/actions/authActions';
import { useDispatch } from 'react-redux';
import colors from '../constants/colors';
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../utils/firebaseHelper";

const isTestMode = false;

const initialState = {
    inputValues: {
        email: isTestMode ? "shujaathussain@gmail.com" : "",
        password: isTestMode ? "123456" : "",
    },
    inputValidities: {
        email: isTestMode,
        password: isTestMode,
    },
    formIsValid: isTestMode
}

const SignInForm = props => {
    const dispatch = useDispatch();

    const [error, setError] = useState();
    const [isLoading, setIsLoading] = useState(false);
    const [formState, dispatchFormState] = useReducer(reducer, initialState);
    const [showForgot, setShowForgot] = useState(false);
    const [forgotEmail, setForgotEmail] = useState("");

    const inputChangedHandler = useCallback((inputId, inputValue) => {
        const result = validateInput(inputId, inputValue);
        dispatchFormState({ inputId, validationResult: result, inputValue })
    }, [dispatchFormState]);

    useEffect(() => {
        if (error) {
            Alert.alert("An error occured", error, [{ text: "Okay" }]);
        }
    }, [error])

    const authHandler = useCallback(async () => {
        try {
            setIsLoading(true);

            const action = signIn(
                formState.inputValues.email,
                formState.inputValues.password,
            );
            setError(null);
            await dispatch(action);
        } catch (error) {
            console.log("SIGN-IN ERROR CODE:", error.code);

            let message = "Something went wrong. Please try again.";

            if (error.code === "auth/invalid-login-credentials") {
                message = "The email or password is incorrect.";
            } else if (error.code === "auth/invalid-email") {
                message = "Invalid email format.";
            }

            setError(message);
            setIsLoading(false);
        }


    }, [dispatch, formState]);

    const handleForgotPassword = async () => {
        if (!forgotEmail) {
            Alert.alert("Error", "Please enter your email.");
            return;
        }
        try {
            await sendPasswordResetEmail(auth, forgotEmail.trim());
            Alert.alert(
                "Password Reset",
                "A password reset link has been sent to your email."
            );
            setShowForgot(false);
            setForgotEmail("");
        } catch (error) {
            Alert.alert("Error", error.message);
        }
    };

    return (
        <>
            <Input
                id="email"
                label="Email address"
                icon="mail"
                iconPack={Feather}
                autoCapitalize="none"
                keyboardType="email-address"
                onInputChanged={inputChangedHandler}
                initialValue={formState.inputValues.email}
                errorText={formState.inputValidities["email"]} />

            <Input
                id="password"
                label="Your password"
                icon="lock"
                iconPack={Feather}
                autoCapitalize="none"
                secureTextEntry
                onInputChanged={inputChangedHandler}
                initialValue={formState.inputValues.password}
                errorText={formState.inputValidities["password"]} />

            <TouchableOpacity onPress={() => setShowForgot(true)}>
                <Text style={{ color: colors.primary, marginTop: 12, marginBottom: -8, alignSelf: "flex-end" }}>
                    Forgot Password?
                </Text>
            </TouchableOpacity>

            {
                isLoading ?
                    <ActivityIndicator size={'small'} color={colors.red} style={{ marginTop: 10 }} /> :
                    <SubmitButton
                        title="Sign In"
                        onPress={authHandler}
                        style={{ marginTop: 20, paddingVertical: 15 }}
                        disabled={!formState.formIsValid} />
            }

            {showForgot && (
                <Modal
                    visible={showForgot}
                    animationType="fade"
                    transparent
                    onRequestClose={() => setShowForgot(false)}
                >
                    <View style={{
                        flex: 1,
                        backgroundColor: "#0008",
                        justifyContent: "center",
                        alignItems: "center"
                    }}>
                        <View style={{
                            backgroundColor: "white",
                            padding: 24,
                            borderRadius: 14,
                            width: "85%"
                        }}>
                            <Text style={{ fontSize: 18, fontWeight: "bold", marginBottom: 12 }}>Reset Password</Text>
                            <Input
                                id="forgotEmail"
                                label="Email"
                                icon="mail"
                                iconPack={Feather}
                                value={forgotEmail}
                                autoCapitalize="none"
                                keyboardType="email-address"
                                onInputChanged={(_, val) => setForgotEmail(val)}
                                initialValue={forgotEmail}
                                errorText={true}
                            />
                            <SubmitButton
                                title="Send Reset Link"
                                onPress={handleForgotPassword}
                                style={{ marginTop: 18 }}
                            />
                            <SubmitButton
                                title="Cancel"
                                color={colors.red}
                                onPress={() => setShowForgot(false)}
                                style={{ marginTop: 6 }}
                            />
                        </View>
                    </View>
                </Modal>
            )}

        </>
    )
};

export default SignInForm;