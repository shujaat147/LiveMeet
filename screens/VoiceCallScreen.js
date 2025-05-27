import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ImageBackground,
} from 'react-native';
import RtcEngine from 'react-native-agora';
import { useRoute } from '@react-navigation/native';
import { Ionicons, MaterialIcons, Feather } from '@expo/vector-icons';

const appId = 'dd875cded7644ace82ed3cb3f4ed818a';
const uid = Math.floor(Math.random() * 10000);

const VoiceCallScreen = ({ navigation }) => {
  const route = useRoute();
  const { channelName, incoming, callerName, callerImage } = route.params;

  const [engine, setEngine] = useState(null);
  const [joined, setJoined] = useState(false);
  const [callAccepted, setCallAccepted] = useState(!incoming);
  const [muted, setMuted] = useState(false);
  const [speaker, setSpeaker] = useState(false);

  useEffect(() => {
    let rtcEngine;

    const init = async () => {
      rtcEngine = await RtcEngine.create(appId);
      await rtcEngine.enableAudio();

      rtcEngine.addListener('UserJoined', (uid, elapsed) => {
        console.log('Remote user joined:', uid);
      });

      rtcEngine.addListener('UserOffline', (uid, reason) => {
        console.log('User offline:', uid, 'Reason:', reason);
      });

      rtcEngine.addListener('JoinChannelSuccess', (channel, uid, elapsed) => {
        console.log(`Joined channel: ${channel} with uid: ${uid}`);
        setJoined(true);
      });

      setEngine(rtcEngine);

      if (!incoming) {
        await rtcEngine.joinChannel(null, channelName, null, uid);
      }
    };

    init();

    return () => {
      const cleanup = async () => {
        if (rtcEngine) {
          await rtcEngine.leaveChannel();
          rtcEngine.removeAllListeners();
          rtcEngine.destroy();
        }
      };
      cleanup();
    };
  }, [channelName, incoming]);

  const handleAccept = async () => {
    if (engine) {
      await engine.joinChannel(null, channelName, null, uid);
      setCallAccepted(true);
    }
  };

  const handleReject = () => {
    navigation.goBack();
  };

  const toggleMute = () => {
    if (engine) {
      engine.muteLocalAudioStream(!muted);
      setMuted(!muted);
    }
  };

  const toggleSpeaker = () => {
    if (engine) {
      engine.setEnableSpeakerphone(!speaker);
      setSpeaker(!speaker);
    }
  };

  return (
    <ImageBackground
      source={require('../assets/call-background.jpeg')} // use any dark patterned background
      style={styles.container}
      resizeMode="cover"
    >
      <View style={styles.header}>
        <Text style={styles.name}>{callerName || 'Calling...'}</Text>
        {joined && <Text style={styles.status}>00:04</Text>}
        {!joined && <Text style={styles.status}>Connecting...</Text>}
      </View>

      <Image
        source={{ uri: callerImage }}
        style={styles.avatar}
      />

      <View style={styles.controls}>
        <TouchableOpacity onPress={toggleMute} style={styles.iconButton}>
          <Feather name={muted ? 'mic-off' : 'mic'} size={24} color="white" />
        </TouchableOpacity>
        <TouchableOpacity onPress={toggleSpeaker} style={styles.iconButton}>
          <Ionicons name={speaker ? 'volume-high' : 'volume-mute'} size={26} color="white" />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleReject} style={[styles.iconButton, styles.endButton]}>
          <MaterialIcons name="call-end" size={26} color="white" />
        </TouchableOpacity>
      </View>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 80,
    backgroundColor: '#1e1e1e'
  },
  header: {
    alignItems: 'center',
    marginTop: 40,
  },
  name: {
    fontSize: 22,
    color: 'white',
    fontWeight: 'bold',
  },
  status: {
    marginTop: 8,
    fontSize: 16,
    color: '#ccc',
  },
  avatar: {
    width: 160,
    height: 160,
    borderRadius: 80,
    marginVertical: 20,
    borderWidth: 4,
    borderColor: 'white'
  },
  controls: {
    flexDirection: 'row',
    marginBottom: 40,
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '70%',
  },
  iconButton: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 40,
    padding: 15,
  },
  endButton: {
    backgroundColor: 'red',
  },
});

export default VoiceCallScreen;
