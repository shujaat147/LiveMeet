import React, { useCallback, useEffect, useReducer, useState } from 'react';
import Input from '../components/Input';
import SubmitButton from '../components/SubmitButton';
import { Feather, FontAwesome } from '@expo/vector-icons';

import { validateInput } from '../utils/actions/formActions';
import { reducer } from '../utils/reducers/formReducer';
import { signUp } from '../utils/actions/authActions';
import { ActivityIndicator, Alert, Text, TouchableOpacity } from 'react-native';
import colors from '../constants/colors';
import { useDispatch } from 'react-redux';

const initialState = {
    inputValues: {
        firstName: "",
        lastName: "",
        email: "",
        password: "",
        confirmPassword: "",
    },
    inputValidities: {
        firstName: false,
        lastName: false,
        email: false,
        password: false,
        confirmPassword: false,
    },
    formIsValid: false
};

const SignUpForm = props => {
    const dispatch = useDispatch();

    const [error, setError] = useState();
    const [isLoading, setIsLoading] = useState(false);
    const [formState, dispatchFormState] = useReducer(reducer, initialState);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const inputChangedHandler = useCallback((inputId, inputValue) => {
        const result = validateInput(inputId, inputValue);
        dispatchFormState({ inputId, validationResult: result, inputValue });
    }, []);

    useEffect(() => {
        if (error) {
            Alert.alert("An error occurred", error, [{ text: "Okay" }]);
        }
    }, [error]);

    const authHandler = useCallback(async () => {
        if (formState.inputValues.password !== formState.inputValues.confirmPassword) {
            Alert.alert("Password Mismatch", "Passwords do not match", [{ text: "Okay" }]);
            return;
        }

        try {
            setIsLoading(true);
            const action = signUp(
                formState.inputValues.firstName,
                formState.inputValues.lastName,
                formState.inputValues.email,
                formState.inputValues.password
            );
            setError(null);
            await dispatch(action);
        } catch (error) {
            setError(error.message);
            setIsLoading(false);
        }
    }, [dispatch, formState]);

    const password = formState.inputValues.password;
    const confirmPassword = formState.inputValues.confirmPassword;
    const passwordsMatch = password === confirmPassword;

    const isFormReady = formState.formIsValid && passwordsMatch;

    return (
        <>
            <Input
                id="firstName"
                label="First name"
                icon="user-o"
                iconPack={FontAwesome}
                onInputChanged={inputChangedHandler}
                autoCapitalize="none"
                errorText={formState.inputValidities["firstName"]}
            />

            <Input
                id="lastName"
                label="Last name"
                icon="user-o"
                iconPack={FontAwesome}
                onInputChanged={inputChangedHandler}
                autoCapitalize="none"
                errorText={formState.inputValidities["lastName"]}
            />

            <Input
                id="email"
                label="Email"
                icon="mail"
                iconPack={Feather}
                onInputChanged={inputChangedHandler}
                keyboardType="email-address"
                autoCapitalize="none"
                errorText={formState.inputValidities["email"]}
            />

            <Input
                id="password"
                label="Password"
                icon="lock"
                autoCapitalize="none"
                secureTextEntry={!showPassword}
                iconPack={Feather}
                onInputChanged={inputChangedHandler}
                errorText={formState.inputValidities["password"]}
                rightIcon={
                    <TouchableOpacity onPress={() => setShowPassword(prev => !prev)}>
                        <Feather
                            name={showPassword ? "eye-off" : "eye"}
                            size={20}
                            color={colors.red}
                        />
                    </TouchableOpacity>
                }
            />

            <Input
                id="confirmPassword"
                label="Confirm Password"
                icon="lock"
                autoCapitalize="none"
                secureTextEntry={!showConfirmPassword}
                iconPack={Feather}
                onInputChanged={inputChangedHandler}
                errorText={formState.inputValidities["confirmPassword"]}
                rightIcon={
                    <TouchableOpacity onPress={() => setShowConfirmPassword(prev => !prev)}>
                        <Feather
                            name={showConfirmPassword ? "eye-off" : "eye"}
                            size={20}
                            color={colors.red}
                        />
                    </TouchableOpacity>
                }
            />

            {
                confirmPassword.length > 0 && !passwordsMatch && (
                    <Text style={{ color: 'red', marginTop: 4, marginBottom: 12, marginLeft: 5, fontSize: 13 }}>
                        Passwords do not match
                    </Text>

                )
            }

            {isLoading ? (
                <ActivityIndicator size={'small'} color={colors.red} style={{ marginTop: 10 }} />
            ) : (
                <SubmitButton
                    title="Sign up"
                    onPress={authHandler}
                    style={{ marginTop: 20, paddingVertical: 15 }}
                    disabled={!isFormReady}
                />
            )}
        </>
    );
};

export default SignUpForm;