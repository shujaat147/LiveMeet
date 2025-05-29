import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import RtcEngine, { RtcLocalView, RtcRemoteView, VideoRenderMode, ClientRole } from 'react-native-agora';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import colors from '../constants/colors';
import { logCallMessage } from '../utils/actions/chatActions';
import { ImageBackground } from 'react-native';
import backgroundImage from '../assets/call-background.jpeg';
import defaultAvatar from '../assets/images/userImage-1.png';



const APP_ID = "3baa3524be2c48d08ea9380ae162e499";
const TEMP_TOKEN = "007eJxTYDj2dHeS8Y9VKSdDDrJqX8ybteGd7Jx9zCHejFb+/5/wGF5TYDBOSkw0NjUySUo1SjaxSDGwSE20NLYwSEw1NDNKNbG0nNJjntEQyMhw1yCZmZEBAkF8boaS1OKS5MScHEMjYwYGAHWKIfQ=";

const VoiceCallScreen = () => {
  const [joined, setJoined] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const [callTime, setCallTime] = useState(0);
  const [remoteUserId, setRemoteUserId] = useState(null);
  const timerRef = useRef(null);

  const engineRef = useRef(null);
  const navigation = useNavigation();
  const route = useRoute();

  const { chatId, receiverData, callerData, isCaller } = route.params;

  useEffect(() => {
    const init = async () => {
      const engine = await RtcEngine.create(APP_ID);
      engineRef.current = engine;

      await engine.enableAudio();

      engine.addListener('UserJoined', (uid) => {
        console.log('Remote user joined:', uid);
        setRemoteUserId(uid);
        startTimer();
      });

      engine.addListener('UserOffline', () => {
        console.log('Remote user left');
        stopTimer();
        endCall();
      });

      engine.addListener('JoinChannelSuccess', () => {
        console.log('Joined channel successfully');
        setJoined(true);
      });

      await engine.joinChannel(TEMP_TOKEN, chatId, null, 0);
    };

    init();

    return () => {
      engineRef.current?.leaveChannel();
      engineRef.current?.destroy();
      stopTimer();
    };
  }, []);

  const startTimer = () => {
    timerRef.current = setInterval(() => {
      setCallTime((prev) => prev + 1);
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const endCall = async () => {
    stopTimer();

    // ✅ Add this line:
    await logCallMessage(chatId, isCaller ? callerData.userId : receiverData.userId, "Voice call ended", "ended");

    navigation.goBack();
  };


  const toggleMute = () => {
    const newMute = !isMuted;
    setIsMuted(newMute);
    engineRef.current?.muteLocalAudioStream(newMute);
  };

  const toggleSpeaker = () => {
    const newSpeaker = !isSpeakerOn;
    setIsSpeakerOn(newSpeaker);
    engineRef.current?.setEnableSpeakerphone(newSpeaker);
  };

  const userInfo = isCaller ? receiverData : callerData;

  return (

    <ImageBackground source={backgroundImage} style={styles.container}>
      <Image
        source={userInfo.profilePicture ? { uri: userInfo.profilePicture } : defaultAvatar}
        style={styles.avatar}
      />
      <Text style={styles.name}>{userInfo.firstName} {userInfo.lastName}</Text>
      <Text style={styles.status}>
        {remoteUserId ? formatTime(callTime) : isCaller ? 'Calling...' : 'Ringing...'}
      </Text>

      <View style={styles.controls}>
        <TouchableOpacity onPress={toggleMute}>
          <Ionicons name={isMuted ? 'mic-off' : 'mic'} size={32} color={colors.grey} padding={12} />
        </TouchableOpacity>

        <TouchableOpacity onPress={endCall} style={styles.endCallButton}>
          <Ionicons name="call" size={32} color={colors.nearlyWhite} />
        </TouchableOpacity>

        <TouchableOpacity onPress={toggleSpeaker}>
          <Ionicons name={isSpeakerOn ? 'volume-high' : 'volume-mute'} size={32} color={colors.grey} padding={12} />
        </TouchableOpacity>
      </View>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    resizeMode: 'cover', // optional
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 20,
  },
  name: {
    fontSize: 24,
    color: 'black',
    fontWeight: 'bold',
  },
  status: {
    fontSize: 18,
    color: 'red',
    marginTop: 8,
    marginBottom: 40,
  },
  controls: {
    flexDirection: 'row',
    width: '70%',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  endCallButton: {
    backgroundColor: 'red',
    padding: 12,
    borderRadius: 50,
  },
});

export default VoiceCallScreen;
