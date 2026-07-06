export default function atlasImageIntake({
    imageBuffer = null,
    imageMimeType = null,
    backImageBuffer = null,
    backImageMimeType = null,
    source = "upload",
  } = {}) {
    const frontImageAvailable = !!imageBuffer;
    const backImageAvailable = !!backImageBuffer;
  
    const frontSizeBytes = imageBuffer?.length || 0;
    const backSizeBytes = backImageBuffer?.length || 0;
  
    const warnings = [];
  
    if (!frontImageAvailable) {
      warnings.push("Front image is missing.");
    }
  
    if (frontImageAvailable && frontSizeBytes > 10 * 1024 * 1024) {
      warnings.push("Front image is larger than recommended.");
    }
  
    if (backImageAvailable && backSizeBytes > 10 * 1024 * 1024) {
      warnings.push("Back image is larger than recommended.");
    }
  
    if (frontImageAvailable && !isSupportedImageType(imageMimeType)) {
      warnings.push("Front image type may not be supported.");
    }
  
    if (backImageAvailable && !isSupportedImageType(backImageMimeType)) {
      warnings.push("Back image type may not be supported.");
    }
  
    if (!backImageAvailable) {
      warnings.push("Back image not provided.");
    }
  
    return {
      stage: "image_intake",
      source,
      frontImageAvailable,
      backImageAvailable,
      frontImageType: imageMimeType || null,
      backImageType: backImageMimeType || null,
      frontSizeBytes,
      backSizeBytes,
      warnings,
      healthy: frontImageAvailable && warnings.length === 0,
    };
  }
  
  function isSupportedImageType(mimeType) {
    return ["image/jpeg", "image/png", "image/webp"].includes(mimeType);
  }