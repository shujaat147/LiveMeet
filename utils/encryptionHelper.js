import RNSimpleCrypto from 'react-native-simple-crypto';

const SECRET_KEY = 'finalYearProjectLiveMeet'; // Keep this in sync everywhere!

export async function decryptMessage(cipherBase64, ivBase64) {
 const keyBuffer = await RNSimpleCrypto.utils.convertUtf8ToArrayBuffer(SECRET_KEY);
 const cipherBuffer = await RNSimpleCrypto.utils.convertBase64ToArrayBuffer(cipherBase64);
 const ivBuffer = await RNSimpleCrypto.utils.convertBase64ToArrayBuffer(ivBase64);

 const decryptedBuffer = await RNSimpleCrypto.AES.decrypt(cipherBuffer, keyBuffer, ivBuffer);
 const decryptedText = RNSimpleCrypto.utils.convertArrayBufferToUtf8(decryptedBuffer);

 return decryptedText;
}
