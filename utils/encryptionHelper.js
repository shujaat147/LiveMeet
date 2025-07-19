import RNSimpleCrypto from 'react-native-simple-crypto';

const SECRET_KEY = 'finalYearProjectLiveMeet'; // Keep this in sync everywhere!

function toBase64(str) {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(str, "utf-8").toString("base64");
  }
  // Polyfill fallback for older RN, but Buffer always exists in RN >=0.56+
  if (typeof btoa !== "undefined") {
    return btoa(unescape(encodeURIComponent(str)));
  }
  throw new Error("No base64 encoder available!");
}

function fromBase64(str) {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(str, "base64").toString("utf-8");
  }
  if (typeof atob !== "undefined") {
    return decodeURIComponent(escape(atob(str)));
  }
  throw new Error("No base64 decoder available!");
}

export async function decryptMessage(cipherBase64, ivBase64) {
  const keyBuffer = await RNSimpleCrypto.utils.convertUtf8ToArrayBuffer(SECRET_KEY);
  const cipherBuffer = await RNSimpleCrypto.utils.convertBase64ToArrayBuffer(cipherBase64);
  const ivBuffer = await RNSimpleCrypto.utils.convertBase64ToArrayBuffer(ivBase64);

  const decryptedBuffer = await RNSimpleCrypto.AES.decrypt(cipherBuffer, keyBuffer, ivBuffer);
  const decryptedBase64 = RNSimpleCrypto.utils.convertArrayBufferToUtf8(decryptedBuffer);

  // Now decode base64 back to real text (emoji-safe!)
  return fromBase64(decryptedBase64);
}

export { toBase64, fromBase64 };
