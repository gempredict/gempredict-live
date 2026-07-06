export default function atlasImageNormalization(imageIntake = {}) {
    const qualityFlags = [];
    const recommendations = [];
  
    if (!imageIntake.frontImageAvailable) {
      qualityFlags.push("front_missing");
      recommendations.push("Upload a front image.");
    }
  
    if (!imageIntake.backImageAvailable) {
      qualityFlags.push("back_missing");
      recommendations.push("Add a back image when possible for better verification.");
    }
  
    if (imageIntake.frontSizeBytes > 8 * 1024 * 1024) {
      qualityFlags.push("large_front_image");
      recommendations.push("Compress or resize the front image if upload is slow.");
    }
  
    if (
      imageIntake.frontImageType &&
      !["image/jpeg", "image/png", "image/webp"].includes(imageIntake.frontImageType)
    ) {
      qualityFlags.push("unsupported_front_type");
      recommendations.push("Use JPEG, PNG, or WebP.");
    }
  
    return {
      stage: "image_normalization",
      normalized: imageIntake.frontImageAvailable,
      qualityFlags,
      recommendations,
      readyForRecognition:
        imageIntake.frontImageAvailable &&
        !qualityFlags.includes("unsupported_front_type"),
    };
  }