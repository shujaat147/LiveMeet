import React from 'react';
import { View, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Octicons, Ionicons } from '@expo/vector-icons';
import {
 Gesture,
 GestureDetector,
} from 'react-native-gesture-handler';
import Animated, {
 useSharedValue,
 useAnimatedStyle,
} from 'react-native-reanimated';
import colors from '../constants/colors';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';

const FullScreenImageScreen = ({ route, navigation }) => {
 const { imageUrl } = route.params;

 const scale = useSharedValue(1);

 // 🧠 Pinch gesture using modern API
 const pinchGesture = Gesture.Pinch()
  .onUpdate((event) => {
   scale.value = Math.max(event.scale, 1); // clamp to minimum scale of 1
  });

 const animatedStyle = useAnimatedStyle(() => ({
  transform: [{ scale: scale.value }],
 }));

 const handleDownload = async () => {
  const { status } = await MediaLibrary.requestPermissionsAsync();
  if (status !== 'granted') {
   Alert.alert('Permission required to save images');
   return;
  }

  try {
   let fileName = imageUrl.split('/').pop().replace(/[^a-zA-Z0-9.\-_]/g, '');

   if (!fileName.includes('.')) {
    fileName += '.jpg';
   }

   const folderUri = FileSystem.documentDirectory + 'chatImages/';
   const folderInfo = await FileSystem.getInfoAsync(folderUri);
   if (!folderInfo.exists) {
    await FileSystem.makeDirectoryAsync(folderUri, { intermediates: true });
   }

   const fileUri = folderUri + fileName;

   const downloadResumable = FileSystem.createDownloadResumable(imageUrl, fileUri);
   const { uri } = await downloadResumable.downloadAsync();

   const asset = await MediaLibrary.createAssetAsync(uri);
   await MediaLibrary.createAlbumAsync('Download', asset, false);

   Alert.alert('Image downloaded successfully!');
  } catch (error) {
   console.log('🔥 Download error:', error);
   Alert.alert('Download failed. See console for details.');
  }
 };

 return (
  <View style={styles.container}>
   <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
    <Ionicons name="arrow-back" size={28} color={colors.nearlyWhite} />
   </TouchableOpacity>

   <TouchableOpacity style={styles.downloadBtn} onPress={handleDownload}>
    <Octicons name="download" size={28} color={colors.nearlyWhite} />
   </TouchableOpacity>

   <GestureDetector gesture={pinchGesture}>
    <Animated.Image
     source={{ uri: imageUrl }}
     style={[styles.image, animatedStyle]}
     resizeMode="contain"
    />
   </GestureDetector>
  </View>
 );
};

export default FullScreenImageScreen;

const styles = StyleSheet.create({
 container: {
  flex: 1,
  backgroundColor: "#212121",
 },
 image: {
  width: '100%',
  height: '100%',
 },
 backBtn: {
  position: 'absolute',
  top: 40,
  left: 20,
  zIndex: 10,
 },
 downloadBtn: {
  position: 'absolute',
  top: 40,
  right: 20,
  zIndex: 10,
 },
});