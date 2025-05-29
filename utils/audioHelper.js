import { Audio } from 'expo-av';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getApp } from 'firebase/app';

let recording = null;

export const startRecording = async () => {
 try {
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
  console.error("Start recording error:", error);
 }
};

export const stopRecordingAndUpload = async (chatId) => {
 try {
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
 } finally {
  recording = null;
 }
};
