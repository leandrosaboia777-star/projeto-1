export default {
  expo: {
    owner: "leandrosaboias-team",
    name: "Saboia Cleaning",
    slug: "saboia-cleaning",
    scheme: "saboiacleaning",
    version: "1.0.0",
    orientation: "portrait",
    userInterfaceStyle: "automatic",
    icon: "./assets/icon.png",
    ios: {
      appleTeamId: process.env.APPLE_TEAM_ID || "7MWAZDHJCJ",
      entitlements: {
        "com.apple.security.application-groups": [
          "group.com.saboiacleaning.app",
        ],
      },
      supportsTablet: true,
      bundleIdentifier: "com.saboiacleaning.app",
      infoPlist: {
        NSPhotoLibraryUsageDescription:
          "Choose property and completion photos for your cleaning workspace.",
        NSMicrophoneUsageDescription:
          "Dictate instructions to your cleaning assistant.",
        NSSpeechRecognitionUsageDescription:
          "Turn your spoken cleaning instructions into text.",
      },
    },
    android: {
      package: "com.saboiacleaning.app",
      adaptiveIcon: {
        foregroundImage: "./assets/icon.png",
        backgroundColor: "#315E4F",
      },
    },
    web: { favicon: "./assets/icon.png", bundler: "metro" },
    plugins: [
      "./scripts/fix-ios-deployment.cjs",
      "./scripts/iphone.cjs",
      "@bacons/apple-targets",
      "expo-secure-store",
      "expo-notifications",
      [
        "expo-image-picker",
        {
          photosPermission:
            "Share property and cleaning completion photos with your authorized team.",
        },
      ],
      [
        "expo-speech-recognition",
        {
          microphonePermission: "Dictate cleaning instructions.",
          speechRecognitionPermission: "Recognize your cleaning instructions.",
        },
      ],
    ],
    splash: {
      image: "./assets/icon.png",
      resizeMode: "contain",
      backgroundColor: "#F5F5F0",
    },
    extra: {
      eas: {
        projectId: "4fbec1be-289f-4f57-b6ba-08ede8c06f6b",
      },
    },
  },
};
