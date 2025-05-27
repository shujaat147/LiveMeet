import { StyleSheet, Text, TextInput, View } from "react-native"
import { FontAwesome } from '@expo/vector-icons';

import colors from "../constants/colors";
import { useState } from "react";

const Input = props => {

    const [value, setValue] = useState(props.initialValue)

    const onChangeText = text => {
        setValue(text);
        props.onInputChanged(props.id, text);
    }

    return <View style={styles.container}>
        <Text style={styles.label}>{props.label}</Text>

        <View style={styles.inputContainer}>
            {
                props.icon && <props.iconPack
                    name={props.icon}
                    size={props.iconSize || 15 }
                    style={styles.icon} />
            }
            <TextInput
                { ...props }
                style={styles.input}
                onChangeText={onChangeText}
                value={value}/>
        </View>

        {
            props.errorText &&
            <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{props.errorText[0]}</Text>
            </View>
        }

    </View>
};

const styles = StyleSheet.create({
    container: {
        width: '100%'
    },
    label: {
        marginVertical: 8,
        fontFamily: 'regular',
        letterSpacing: 0.5,
        color: "#666666",
        fontSize: 16
    },
    inputContainer: {
        width: '100%',
        backgroundColor: 'white',
        paddingHorizontal: 10,
        paddingVertical: 8,
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#FF3B30',
        borderStyle: 'solid',
    },
    icon: {
        marginRight: 10,
        color: colors.red,
        paddingBottom: 0,
        fontSize: 20
    },
    input: {
        color: colors.textColor,
        flex: 1,
        fontFamily: 'regular',
        letterSpacing: 0.3,
        paddingTop: 0,
        fontSize: 16,
        padding: 0,
        margin: 0
    },
    errorContainer: {
        marginVertical: 5
    },
    errorText: {
        color: 'red',
        fontSize: 13,
        fontFamily: 'regular',
        letterSpacing: 0.3
    }
})

export default Input;