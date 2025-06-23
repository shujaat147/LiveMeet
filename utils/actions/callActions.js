import { getDatabase, ref, set } from 'firebase/database';
import { getFirebaseApp } from '../firebaseHelper';

export const initiateCall = async ({ chatId, callerId, receiverId }) => {
  try {
    const app = getFirebaseApp();
    const db = getDatabase(app);

    const callId = `call_${chatId}`;

    const callData = {
      callId,
      callerId,
      receiverId,
      chatId,
      status: 'calling',
      statusHistory: ['calling'],
      timestamp: Date.now()
    };

    await set(ref(db, `calls/${callId}`), callData);
    console.log('📡 Call data written to Firebase at:', `calls/${callId}`);

  } catch (error) {
    console.error('❌ Failed to initiate call:', error);
  }
};