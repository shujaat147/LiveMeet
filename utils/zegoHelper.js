import ZegoExpressEngine, { ZegoScenario } from 'zego-express-engine-reactnative';

const appID = 732545649;
const appSign = '55baaeb85501194da632e36d05962f1ccaf621d59ccdb7bafff1739da4e02188';

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
