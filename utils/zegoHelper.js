import ZegoExpressEngine, { ZegoScenario } from 'zego-express-engine-reactnative';

const appID = 472229515;
const appSign = 'a0dfab6fbc7fe6aed34218a9c88690edac1ce26f45c301b4e3e69eb9d0db8205';

let engineCreated = false; // 🧠 Track engine creation

export const createEngine = async () => {
  try {
    if (engineCreated) {
      console.log("ℹ️ Zego engine already created. Skipping re-initialization.");
      return;
    }

    const profile = {
      appID,
      appSign,
      scenario: ZegoScenario.General,
    };

    await ZegoExpressEngine.createEngineWithProfile(profile);
    engineCreated = true;
    console.log('✅ Zego engine created successfully');
  } catch (error) {
    console.error('❌ Failed to create Zego engine:', error);
  }
};

export const destroyEngine = async () => {
  try {
    await ZegoExpressEngine.destroyEngine();
    engineCreated = false;
    console.log("🧹 Zego engine destroyed");
  } catch (error) {
    console.warn("⚠️ Failed to destroy Zego engine:", error);
  }
};
