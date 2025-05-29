import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Vibration } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { getDatabase, ref, update } from 'firebase/database';
import { getFirebaseApp } from '../utils/firebaseHelper';
import colors from '../constants/colors';
import * as Notifications from 'expo-notifications';

const IncomingCallScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { callId, chatId, callerData } = route.params;

  useEffect(() => {
    // Vibrate and optionally play sound
    Vibration.vibrate([500, 500, 500], true);

    return () => Vibration.cancel();
  }, []);

  const handleReject = async () => {
    const app = getFirebaseApp();
    const db = getDatabase(app);

    await update(ref(db, `calls/${callId}`), { status: 'rejected' });
    navigation.goBack();
  };

  const handleAccept = async () => {
    const app = getFirebaseApp();
    const db = getDatabase(app);

    await update(ref(db, `calls/${callId}`), { status: 'accepted' });

    navigation.replace("VoiceCall", {
      chatId,
      callerData,
      receiverData: callerData, // Flip roles
      isCaller: false
    });
  };

  return (
    <View style={styles.container}>
      <Image source={{ uri: callerData.profilePicture }} style={styles.avatar} />
      <Text style={styles.name}>{callerData.firstName} {callerData.lastName}</Text>
      <Text style={styles.status}>Incoming Voice Call...</Text>

      <View style={styles.buttonsContainer}>
        <TouchableOpacity onPress={handleReject} style={[styles.circleButton, styles.red]}>
          <Ionicons name="close" size={32} color="white" />
        </TouchableOpacity>

        <TouchableOpacity onPress={handleAccept} style={[styles.circleButton, styles.green]}>
          <Ionicons name="call" size={32} color="white" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 140,
    height: 140,
    borderRadius: 70,
    marginBottom: 20,
  },
  name: {
    fontSize: 24,
    color: 'white',
    fontWeight: 'bold',
  },
  status: {
    fontSize: 18,
    color: 'white',
    marginTop: 8,
    marginBottom: 40,
  },
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '60%',
  },
  circleButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
  },
  red: {
    backgroundColor: '#e74c3c',
  },
  green: {
    backgroundColor: '#2ecc71',
  },
});

export default IncomingCallScreen;
