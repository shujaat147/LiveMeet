import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import { getFirebaseApp } from './firebaseHelper';
import uuid from 'react-native-uuid';
import { getDownloadURL, getStorage, ref, uploadBytesResumable } from 'firebase/storage';
import { Image } from 'react-native-compressor';

export const launchImagePicker = async () => {
  await checkMediaPermissions();

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
  });

  if (!result.canceled && result.assets?.length > 0) {
    return result.assets[0].uri;
  }

  return null;
};

export const openCamera = async () => {
  const permissionResult = await ImagePicker.requestCameraPermissionsAsync();

  if (!permissionResult.granted) {
    console.log("No permission to access the camera");
    return null;
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
  });

  if (!result.canceled && result.assets?.length > 0) {
    return result.assets[0].uri;
  }

  return null;
};

export const uploadImageAsync = async (uri, isChatImage = false) => {
  const app = getFirebaseApp();

  const blob = await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = function () {
      resolve(xhr.response);
    };

    xhr.onerror = function (e) {
      console.log(e);
      reject(new TypeError("Network request failed"));
    };

    xhr.responseType = "blob";
    xhr.open("GET", uri, true);
    xhr.send();
  });

  const pathFolder = isChatImage ? 'chatImages' : 'profilePics';
  const storageRef = ref(getStorage(app), `${pathFolder}/${uuid.v4()}`);

  await uploadBytesResumable(storageRef, blob);

  blob.close();

  return await getDownloadURL(storageRef);
};

const checkMediaPermissions = async () => {
  if (Platform.OS !== 'web') {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionResult.granted === false) {
      return Promise.reject("We need permission to access your photos");
    }
  }

  return Promise.resolve();
};

export const performOCR = async (imageUri) => {
  console.log("Original image URI:", imageUri);

  try {
    const compressedUri = await Image.compress(imageUri, {
      compressionMethod: 'auto',
      maxSize: 0.9, // Target ~900 KB
    });

    console.log("Compressed URI:", compressedUri);

    const getFileInfo = (uri) => {
      const fileName = uri.split("/").pop();
      const match = /\.(\w+)$/.exec(fileName || "");
      const ext = match?.[1];
      const type = ext ? `image/${ext === "jpg" ? "jpeg" : ext}` : `image`;

      return { name: fileName || "image", type };
    };

    const { name, type } = getFileInfo(compressedUri);

    const formData = new FormData();
    formData.append("file", {
      uri: compressedUri,
      name,
      type,
    });
    formData.append("language", "eng");
    formData.append("isOverlayRequired", "false");

    const response = await fetch("https://api.ocr.space/parse/image", {
      method: "POST",
      headers: {
        apikey: "K83084712288957",
      },
      body: formData,
    });

    const result = await response.json();
    console.log("OCR raw result:", JSON.stringify(result, null, 2));

    const text = result?.ParsedResults?.[0]?.ParsedText?.trim();

    if (text) return text;

    console.warn("No text found in image.");
    return null;
  } catch (err) {
    console.error("OCR failed:", err);
    return null;
  }
};