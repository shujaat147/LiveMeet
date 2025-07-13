import { Audio } from 'expo-av';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getApp } from 'firebase/app';

let recording = null;
let isNativeRecordingActive = false;

export const startRecording = async () => {
  if (isNativeRecordingActive) throw new Error("Recording in progress.");
  isNativeRecordingActive = true;
  try {
    if (recording) {
      try {
        await recording.stopAndUnloadAsync();
      } catch (e) {}
      recording = null;
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: false,
      });
    }

    await Audio.requestPermissionsAsync();
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });

    const { recording: newRecording } = await Audio.Recording.createAsync(
      Audio.RECORDING_OPTIONS_PRESET_HIGH_QUALITY
    );
    recording = newRecording;
  } catch (error) {
    isNativeRecordingActive = false;
    console.error("Start recording error:", error);
    throw error;
  }
};

export const stopRecordingAndUpload = async (chatId) => {
  try {
    if (!recording) {
      throw new Error("No active recording session.");
    }
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();

    const response = await fetch(uri);
    const blob = await response.blob();
    const filename = `${Date.now()}.m4a`;

    const firebaseStorage = getStorage(getApp());
    const fileRef = ref(firebaseStorage, `voiceMessages/${chatId}/${filename}`);
    await uploadBytes(fileRef, blob);
    const downloadURL = await getDownloadURL(fileRef);

    return downloadURL;
  } catch (error) {
    console.error("Stop/upload recording error:", error);
    return null;
  } finally {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: false,
      });
    } catch (e) {}
    recording = null;
    isNativeRecordingActive = false;
  }
};

export const cancelRecording = async () => {
  try {
    if (recording) {
      await recording.stopAndUnloadAsync();
    }
  } catch (e) {}
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: false,
    });
  } catch (e) {}
  recording = null;
  isNativeRecordingActive = false;
};
