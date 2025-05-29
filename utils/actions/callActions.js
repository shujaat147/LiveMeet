import { getDatabase, ref, set } from 'firebase/database';
import { getFirebaseApp } from '../firebaseHelper';
import { sendPushNotificationForUsers } from './chatActions';


export const initiateCall = async ({ chatId, callerId, receiverId }) => {
  const app = getFirebaseApp();
  const db = getDatabase(app);

  const callId = `call_${chatId}`;

  const callData = {
    callerId,
    receiverId,
    chatId,
    status: 'calling',
    timestamp: Date.now()
  };

  await set(ref(db, `calls/${callId}`), callData);
};
