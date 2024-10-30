const canvas = document.getElementById("meme-canvas");
const ctx = canvas.getContext("2d", { willReadFrequently: true });

const laserImageTemplate = new Image();
laserImageTemplate.src = "https://dmagafy.netlify.app/laser_large.png";
laserImageTemplate.crossOrigin = "anonymous";

let laserTopImage = new Image();
laserTopImage.src = "https://dmagafy.netlify.app/laser_top.png"; // Replace with your actual URL
laserTopImage.crossOrigin = "anonymous";

let canvasImage = new Image();
let lasers = [];
let isDragging = false;
let currentLaser = null;
let offsetX, offsetY;

let selectedHatImage = null;
let hats = [];
let currentHat = null;

const MAX_WIDTH = 640;
const MAX_HEIGHT = 480;

let originalImageWidth, originalImageHeight;
let currentFilter = 'classic';

let americanFlagImage = new Image();
americanFlagImage.src = "AmericanFlag.png";
americanFlagImage.crossOrigin = "anonymous";

let lightningImage = new Image();
lightningImage.src = "lightning.png";
lightningImage.crossOrigin = "anonymous";

let selectedBackgroundImage = americanFlagImage;  // Default to American Flag

let flagOpacity = .5; // Default opacity

let u2netSession;

// Load the ONNX model
async function loadModel() {
  u2netSession = await ort.InferenceSession.create('./u2netp.onnx');
}

// State variable to track if the flag is applied
let flagApplied = false;

async function addFlagWithBackgroundRemoval() {
  if (!canvasImage) return;

  const inputTensor = preprocessImageForONNX(canvasImage);

  // Perform inference with the ONNX model
  const output = await u2netSession.run({ 'input.1': inputTensor });
  const maskImage = postprocessONNXOutput(output[Object.keys(output)[0]], canvasImage);

  maskImage.onload = function () {
      // Set flagApplied to true since the user has added the flag
      flagApplied = true;

      // Save the mask image for later use in drawCanvas
      savedMaskImage = maskImage;

      // Redraw everything, including the flag and mask
      drawCanvas();
  };
}

// Event listeners for adding the flag
document.getElementById("add-background-button").addEventListener("click", function () {
  const selectedOption = document.querySelector('input[name="background"]:checked').value;
  if (selectedOption === "americanFlag") {
    selectedBackgroundImage = americanFlagImage;
  } else if (selectedOption === "lightning") {
    selectedBackgroundImage = lightningImage;
  }

  addFlagWithBackgroundRemoval();  // Re-use the existing function to apply the selected background
});

document.getElementById("flag-opacity-slider").addEventListener("input", function (e) {
  flagOpacity = parseFloat(e.target.value);
  drawCanvas(); // Redraw to reflect new opacity
});

// Event listener to remove the flag
document.getElementById("remove-flag-button").addEventListener("click", function () {
  flagApplied = false; // Set the flag state to false
  savedMaskImage = null; // Clear the saved mask image since the flag is removed
  drawCanvas(); // Redraw without the flag and mask, but keep other elements
});

// Load the ONNX model when the page loads
window.addEventListener('DOMContentLoaded', loadModel);

// Preprocessing function for the ONNX model input
function preprocessImageForONNX(imageElement) {
  const width = 320;
  const height = 320;

  // Create an offscreen canvas and draw the image onto it
  const offscreenCanvas = document.createElement('canvas');
  const offscreenCtx = offscreenCanvas.getContext('2d');
  offscreenCanvas.width = width;
  offscreenCanvas.height = height;
  offscreenCtx.drawImage(imageElement, 0, 0, width, height);

  // Get image data and convert to tensor
  const imageData = offscreenCtx.getImageData(0, 0, width, height);
  const tensorData = new Float32Array(1 * 3 * width * height);

  for (let i = 0; i < imageData.data.length; i += 4) {
      tensorData[i / 4] = imageData.data[i] / 255; // Red
      tensorData[(i / 4) + (width * height)] = imageData.data[i + 1] / 255; // Green
      tensorData[(i / 4) + (2 * width * height)] = imageData.data[i + 2] / 255; // Blue
  }

  return new ort.Tensor('float32', tensorData, [1, 3, width, height]);
}

// Postprocessing function for the ONNX model output
function postprocessONNXOutput(output, imageElement) {
  const width = imageElement.width;
  const height = imageElement.height;

  // Create an offscreen canvas to draw the masked output
  const offscreenCanvas = document.createElement('canvas');
  const offscreenCtx = offscreenCanvas.getContext('2d');
  offscreenCanvas.width = width;
  offscreenCanvas.height = height;

  // Resize the mask data to match the original image size
  const maskData = output.data;
  const scaledMaskCanvas = document.createElement('canvas');
  scaledMaskCanvas.width = 320;
  scaledMaskCanvas.height = 320;
  const scaledMaskCtx = scaledMaskCanvas.getContext('2d');

  // Create ImageData object for the mask
  const maskImageData = scaledMaskCtx.createImageData(320, 320);

  // Fill the mask data into the ImageData object
  for (let i = 0; i < maskData.length; i++) {
    const value = maskData[i] * 255;
    maskImageData.data[i * 4 + 3] = value; // Set alpha channel
    maskImageData.data[i * 4] = 0;
    maskImageData.data[i * 4 + 1] = 0;
    maskImageData.data[i * 4 + 2] = 0;
  }
  scaledMaskCtx.putImageData(maskImageData, 0, 0);

  // Draw the resized mask to the offscreen canvas at the original size
  offscreenCtx.drawImage(scaledMaskCanvas, 0, 0, 320, 320, 0, 0, width, height);

  // Draw the original image over the resized mask, preserving high resolution
  offscreenCtx.globalCompositeOperation = 'source-in';
  offscreenCtx.drawImage(imageElement, 0, 0, width, height);

  // Create a new image element with the background removed
  const newImgElement = new Image();
  newImgElement.src = offscreenCanvas.toDataURL();
  return newImgElement;
}




window.addEventListener('DOMContentLoaded', () => {
  // Set resize slider to the middle
  const resizeSlider = document.getElementById('resize-slider');
  resizeSlider.value = '1.25';  // Middle value between 0.5 and 2

  // Set rotate slider to the middle
  const rotateSlider = document.getElementById('rotate-slider');
  rotateSlider.value = '0';  // Middle value between 0 and 360
});

document.getElementById("image-upload").addEventListener("change", function (e) {
  const reader = new FileReader();
  reader.onload = function (event) {
      // Hide any previous titles or placeholders
      document.getElementById("h1-title").style.display = "none";
      
      // Reset the flag and mask state when a new image is uploaded
      flagApplied = false;
      savedMaskImage = null;

      canvasImage.onload = function () {
          originalImageWidth = canvasImage.width;
          originalImageHeight = canvasImage.height;

          // Scale the image to fit within the specified limits
          const scale = Math.min(
              MAX_WIDTH / canvasImage.width,
              MAX_HEIGHT / canvasImage.height,
              1
          );

          // Set canvas dimensions based on the scaled image
          canvas.width = canvasImage.width * scale;
          canvas.height = canvasImage.height * scale;

          // Clear the canvas before drawing the new image
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          drawCanvas(); // Redraw with the new image and reset state

          // Display the button container for further actions
          document.querySelector(".button-container").style.display = "flex";
      };

      // Set the new image source, which triggers the onload event
      canvasImage.src = event.target.result;
  };

  // Read the file as a data URL
  reader.readAsDataURL(e.target.files[0]);
});


document.getElementById("add-laser-button").addEventListener("click", function () {
  const aspectRatio = laserImageTemplate.width / laserImageTemplate.height;

  // Use a higher percentage of the canvas size to determine the initial laser size
  let laserWidth = canvas.width * 0.5; // Increased to 50% of the canvas width
  let laserHeight = laserWidth / aspectRatio;

  // Ensure the laser fits within the canvas bounds
  if (laserHeight > canvas.height) {
    laserHeight = canvas.height * 0.5; // 50% of canvas height if it's taller
    laserWidth = laserHeight * aspectRatio;
  }

  const laser = {
    image: laserImageTemplate,
    width: laserWidth,
    height: laserHeight,
    x: canvas.width / 2 - laserWidth / 2,
    y: canvas.height / 2 - laserHeight / 2,
    rotation: 0,
  };
  lasers.push(laser);
  drawCanvas();
});


document.getElementById("add-hat-button").addEventListener("click", function () {
  if (!selectedHatImage) return;

  const aspectRatio = selectedHatImage.width / selectedHatImage.height;
  
  let hatWidth = (canvas.width / 5) * 2;
  let hatHeight = hatWidth / aspectRatio;

  if (hatHeight > canvas.height) {
    hatHeight = (canvas.height / 5) * 2;
    hatWidth = hatHeight * aspectRatio;
  }

  const hat = {
    image: selectedHatImage,
    width: hatWidth,
    height: hatHeight,
    x: canvas.width / 2 - hatWidth / 2,
    y: canvas.height / 2 - hatHeight / 2,
    rotation: 0,
  };
  hats.push(hat);
  drawCanvas();
});

document.getElementById("resize-slider").addEventListener("input", function (e) {
  const scale = Math.max(parseFloat(e.target.value), 0.5); // Keep a minimum of 0.5 to avoid negatives
  lasers.forEach((laser) => {
    const aspectRatio = laser.image.width / laser.image.height;
    const centerX = laser.x + laser.width / 2;
    const centerY = laser.y + laser.height / 2;

    // Increase the multiplier to allow larger lasers
    laser.width = (MAX_WIDTH / 5) * scale * 2;
    laser.height = laser.width / aspectRatio;

    laser.x = centerX - laser.width / 2;
    laser.y = centerY - laser.height / 2;
  });
  drawCanvas();
});


document.getElementById("hat-resize-slider").addEventListener("input", function (e) {
  const scale = e.target.value;
  hats.forEach((hat) => {
    const aspectRatio = hat.image.width / hat.image.height;
    const centerX = hat.x + hat.width / 2;
    const centerY = hat.y + hat.height / 2;

    hat.width = (canvas.width / 5) * scale * 2;
    hat.height = hat.width / aspectRatio;

    hat.x = centerX - hat.width / 2;
    hat.y = centerY - hat.height / 2;
  });
  drawCanvas();
});

document.getElementById("rotate-slider").addEventListener("input", function (e) {
  const rotation = (e.target.value * Math.PI) / 180;
  lasers.forEach((laser) => {
    laser.rotation = rotation;
  });
  drawCanvas();
});

document.getElementById("hat-rotate-slider").addEventListener("input", function (e) {
  const rotation = (e.target.value * Math.PI) / 180;
  hats.forEach((hat) => {
    hat.rotation = rotation;
  });
  drawCanvas();
});


document.querySelectorAll('.hat-option').forEach(option => {
  option.addEventListener('click', function () {
    document.querySelectorAll('.hat-option').forEach(opt => opt.classList.remove('selected'));
    this.classList.add('selected');

    selectedHatImage = new Image();
    
    // Set the URL of the hat image
    const hatUrl = {
      'hat1': "https://dmagafy.netlify.app/hat_front_1.png",
      'hat2': "https://dmagafy.netlify.app/hat_front_2.png",
      'hatLeft': "https://dmagafy.netlify.app/hat_left.png",
      'hatRight': "https://dmagafy.netlify.app/hat_right.png",
      'goth1': "https://dmagafy.netlify.app/goth-front-hat.png",
      'gothLeft': "https://dmagafy.netlify.app/goth-side-hat.png"
    };

    const hatType = this.getAttribute('data-hat');
    selectedHatImage.src = hatUrl[hatType];
    selectedHatImage.crossOrigin = 'anonymous';  // Add this if images are hosted on a different domain
  });
});

document.querySelectorAll('.filter-option').forEach(option => {
  option.addEventListener('click', function () {
    document.querySelectorAll('.filter-option').forEach(opt => opt.classList.remove('selected'));
    this.classList.add('selected');
    currentFilter = this.getAttribute('data-filter');
    drawCanvas();
  });
});

canvas.addEventListener("mousedown", function (e) {
  const mouseX = e.offsetX;
  const mouseY = e.offsetY;
  let closestDistance = Infinity;
  currentLaser = null;
  currentHat = null;

  // Check lasers for closest
  lasers.forEach((laser) => {
    const centerX = laser.x + laser.width / 2;
    const centerY = laser.y + laser.height / 2;
    const distance = Math.sqrt(
      Math.pow(mouseX - centerX, 2) + Math.pow(mouseY - centerY, 2)
    );

    if (
      mouseX > laser.x &&
      mouseX < laser.x + laser.width &&
      mouseY > laser.y &&
      mouseY < laser.y + laser.height &&
      distance < closestDistance
    ) {
      closestDistance = distance;
      currentLaser = laser;
      currentHat = null; // Reset currentHat to ensure only one is selected
      offsetX = mouseX - laser.x;
      offsetY = mouseY - laser.y;
    }
  });

  // Check hats for closest, only if closer than the closest laser
  hats.forEach((hat) => {
    const centerX = hat.x + hat.width / 2;
    const centerY = hat.y + hat.height / 2;
    const distance = Math.sqrt(
      Math.pow(mouseX - centerX, 2) + Math.pow(mouseY - centerY, 2)
    );

    if (
      mouseX > hat.x &&
      mouseX < hat.x + hat.width &&
      mouseY > hat.y &&
      mouseY < hat.y + hat.height &&
      distance < closestDistance
    ) {
      closestDistance = distance;
      currentHat = hat;
      currentLaser = null; // Reset currentLaser to ensure only one is selected
      offsetX = mouseX - hat.x;
      offsetY = mouseY - hat.y;
    }
  });

  // Set dragging flag if either laser or hat is selected
  if (currentLaser || currentHat) {
    isDragging = true;
  }
});

canvas.addEventListener("mousemove", function (e) {
  if (isDragging) {
    const mouseX = e.offsetX;
    const mouseY = e.offsetY;

    // If dragging a laser
    if (currentLaser) {
      currentLaser.x = mouseX - offsetX;
      currentLaser.y = mouseY - offsetY;
    }

    // If dragging a hat
    if (currentHat) {
      currentHat.x = mouseX - offsetX;
      currentHat.y = mouseY - offsetY;
    }

    drawCanvas(); // Redraw canvas with updated positions
  }
});

canvas.addEventListener("mouseup", function () {
  if (isDragging) {
    if (currentLaser) {
      currentLaser.isDragging = false;
    }

    if (currentHat) {
      currentHat.isDragging = false;
    }

    isDragging = false;
    currentLaser = null;
    currentHat = null; // Reset everything after mouse release
  }
});

// Add touch event listeners
canvas.addEventListener("touchstart", function (e) {
  e.preventDefault();
  const touch = e.touches[0];
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const mouseX = (touch.clientX - rect.left) * scaleX;
  const mouseY = (touch.clientY - rect.top) * scaleY;

  let closestDistance = Infinity;
  currentLaser = null;
  currentHat = null;

  // Check lasers for closest
  lasers.forEach((laser) => {
    const centerX = laser.x + laser.width / 2;
    const centerY = laser.y + laser.height / 2;
    const distance = Math.sqrt(
      Math.pow(mouseX - centerX, 2) + Math.pow(mouseY - centerY, 2)
    );

    if (
      mouseX > laser.x &&
      mouseX < laser.x + laser.width &&
      mouseY > laser.y &&
      mouseY < laser.y + laser.height &&
      distance < closestDistance
    ) {
      closestDistance = distance;
      currentLaser = laser;
      currentHat = null; // Ensure no hat is selected if a laser is closer
      offsetX = mouseX - laser.x;
      offsetY = mouseY - laser.y;
    }
  });

  // Check hats for closest, but only if no closer laser is found
  hats.forEach((hat) => {
    const centerX = hat.x + hat.width / 2;
    const centerY = hat.y + hat.height / 2;
    const distance = Math.sqrt(
      Math.pow(mouseX - centerX, 2) + Math.pow(mouseY - centerY, 2)
    );

    if (
      mouseX > hat.x &&
      mouseX < hat.x + hat.width &&
      mouseY > hat.y &&
      mouseY < hat.y + hat.height &&
      distance < closestDistance
    ) {
      closestDistance = distance;
      currentHat = hat;
      currentLaser = null; // Ensure no laser is selected if a hat is closer
      offsetX = mouseX - hat.x;
      offsetY = mouseY - hat.y;
    }
  });

  if (currentLaser || currentHat) {
    isDragging = true;
  }
});

canvas.addEventListener("touchmove", function (e) {
  if (isDragging) {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mouseX = (touch.clientX - rect.left) * scaleX;
    const mouseY = (touch.clientY - rect.top) * scaleY;

    if (currentLaser) {
      currentLaser.x = mouseX - offsetX;
      currentLaser.y = mouseY - offsetY;
    }

    if (currentHat) {
      currentHat.x = mouseX - offsetX;
      currentHat.y = mouseY - offsetY;
    }

    drawCanvas();  // Redraw canvas with updated positions
  }
});

canvas.addEventListener("touchend", function () {
  if (currentLaser) {
    currentLaser.isDragging = false;
    isDragging = false;
    currentLaser = null;
  }
});

// Updated download button handler
document.getElementById("download-button").addEventListener("click", function () {
  // Create a temporary canvas for exporting the full resolution image
  const fullResCanvas = document.createElement("canvas");
  fullResCanvas.width = originalImageWidth;
  fullResCanvas.height = originalImageHeight;
  const fullResCtx = fullResCanvas.getContext("2d");

  // Draw the original image at full resolution
  fullResCtx.drawImage(canvasImage, 0, 0, fullResCanvas.width, fullResCanvas.height);

  // Apply the selected filter directly to the fullResCanvas
  if (currentFilter === 'dark') {
    applyGradientMapFilter(fullResCtx, fullResCanvas.width, fullResCanvas.height);
  } else if (currentFilter === 'classic') {
    applyClassicRedFilter(fullResCtx, fullResCanvas.width, fullResCanvas.height);
  } else if (currentFilter === 'light') {
    applyLightFilter(fullResCtx, fullResCanvas.width, fullResCanvas.height);
  }

  // Apply contrast and redness adjustments
  applyContrastAndRedness(fullResCtx, fullResCanvas.width, fullResCanvas.height);

  // Draw the background if it is applied
  if (flagApplied && savedMaskImage) {
    const backgroundAspectRatio = selectedBackgroundImage.width / selectedBackgroundImage.height;
    let backgroundWidth, backgroundHeight;

    if (fullResCanvas.width / fullResCanvas.height > backgroundAspectRatio) {
      backgroundWidth = fullResCanvas.width;
      backgroundHeight = backgroundWidth / backgroundAspectRatio;
    } else {
      backgroundHeight = fullResCanvas.height;
      backgroundWidth = backgroundHeight * backgroundAspectRatio;
    }

    // Center the background on the canvas
    const backgroundX = (fullResCanvas.width - backgroundWidth) / 2;
    const backgroundY = (fullResCanvas.height - backgroundHeight) / 2;

    fullResCtx.globalAlpha = flagOpacity;
    fullResCtx.drawImage(selectedBackgroundImage, backgroundX, backgroundY, backgroundWidth, backgroundHeight);
    fullResCtx.globalAlpha = 1;
  }

  // Draw the masked image on top of the background (if applied)
  if (flagApplied && savedMaskImage) {
    fullResCtx.drawImage(savedMaskImage, 0, 0, fullResCanvas.width, fullResCanvas.height);
  }

  // Calculate scale factors for full resolution
  const scaleX = fullResCanvas.width / canvas.width;
  const scaleY = fullResCanvas.height / canvas.height;

  // Draw lasers at full resolution in two passes
  lasers.forEach((laser) => {
    const scaledLaser = {
      ...laser,
      x: laser.x * scaleX,
      y: laser.y * scaleY,
      width: laser.width * scaleX,
      height: laser.height * scaleY
    };
    drawLaser(scaledLaser, fullResCtx);
  });

  lasers.forEach((laser) => {
    const scaledLaser = {
      ...laser,
      x: laser.x * scaleX,
      y: laser.y * scaleY,
      width: laser.width * scaleX,
      height: laser.height * scaleY
    };
    drawLaserCenter(scaledLaser, fullResCtx);
  });

  // Draw hats at full resolution
  hats.forEach((hat) => {
    fullResCtx.save();
    fullResCtx.translate(
      (hat.x + hat.width / 2) * scaleX,
      (hat.y + hat.height / 2) * scaleY
    );
    fullResCtx.rotate(hat.rotation);
    fullResCtx.drawImage(
      hat.image,
      -hat.width * scaleX / 2,
      -hat.height * scaleY / 2,
      hat.width * scaleX,
      hat.height * scaleY
    );
    fullResCtx.restore();
  });

  // Export the final image as a PNG
  fullResCanvas.toBlob(function (blob) {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "dark_pfp_with_background.png";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, 'image/png');
});

window.addEventListener("paste", function (e) {
  const items = e.clipboardData.items;
  for (let i = 0; i < items.length; i++) {
    if (items[i].type.indexOf("image") !== -1) {
      const file = items[i].getAsFile();
      const reader = new FileReader();
      reader.onload = function (event) {
        document.getElementById("h1-title").style.display = "none";
        canvasImage.onload = function () {
          originalImageWidth = canvasImage.width;
          originalImageHeight = canvasImage.height;

          const scale = Math.min(
            MAX_WIDTH / canvasImage.width,
            MAX_HEIGHT / canvasImage.height,
            1
          );
          canvas.width = canvasImage.width * scale;
          canvas.height = canvasImage.height * scale;
          drawCanvas();
          document.querySelector(".button-container").style.display = "flex";
        };
        canvasImage.src = event.target.result;
      };
      reader.readAsDataURL(file);
      break;  // Exit loop after processing first image item
    }
  }
});

canvas.addEventListener("dragover", function (e) {
  e.preventDefault();  // Prevent default to allow drop
});

canvas.addEventListener("drop", function (e) {
  e.preventDefault();
  const file = e.dataTransfer.files[0];
  if (file && file.type.indexOf("image") !== -1) {
    const reader = new FileReader();
    reader.onload = function (event) {
      document.getElementById("h1-title").style.display = "none";
      canvasImage.onload = function () {
        originalImageWidth = canvasImage.width;
        originalImageHeight = canvasImage.height;

        const scale = Math.min(
          MAX_WIDTH / canvasImage.width,
          MAX_HEIGHT / canvasImage.height,
          1
        );
        canvas.width = canvasImage.width * scale;
        canvas.height = canvasImage.height * scale;
        drawCanvas();
        document.querySelector(".button-container").style.display = "flex";
      };
      canvasImage.src = event.target.result;
    };
    reader.readAsDataURL(file);
  }
});

document.getElementById("contrast-slider").addEventListener("input", function (e) {
  contrastValue = e.target.value;
  drawCanvas();
});

document.getElementById("redness-slider").addEventListener("input", function (e) {
  rednessValue = e.target.value;
  drawCanvas();
});

// Reset adjustments
document.getElementById("reset-adjustments-button").addEventListener("click", function () {
  contrastValue = 1;
  rednessValue = 1;
  document.getElementById("contrast-slider").value = 1;
  document.getElementById("redness-slider").value = 1;
  drawCanvas();
});


let contrastValue = 1;  // Default contrast value
let rednessValue = 1;   // Default redness value

function drawCanvas() {
  // Clear the canvas before drawing
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw the base image (the original uploaded image)
  ctx.drawImage(canvasImage, 0, 0, canvas.width, canvas.height);

  // Apply the selected filter (if any)
  if (currentFilter === 'dark') {
    applyGradientMapFilter(ctx, canvas.width, canvas.height);
  } else if (currentFilter === 'classic') {
    applyClassicRedFilter(ctx, canvas.width, canvas.height);
  } else if (currentFilter === 'light') {
    applyLightFilter(ctx, canvas.width, canvas.height);
  }

  // Apply contrast and redness adjustments
  applyContrastAndRedness(ctx, canvas.width, canvas.height);

  // Draw the flag and masked image if the flag is applied
  if (flagApplied && savedMaskImage) {
    const backgroundAspectRatio = selectedBackgroundImage.width / selectedBackgroundImage.height;
    let backgroundWidth, backgroundHeight;

    if (canvas.width / canvas.height > backgroundAspectRatio) {
      backgroundWidth = canvas.width;
      backgroundHeight = backgroundWidth / backgroundAspectRatio;
    } else {
      backgroundHeight = canvas.height;
      backgroundWidth = backgroundHeight * backgroundAspectRatio;
    }

    const backgroundX = (canvas.width - backgroundWidth) / 2;
    const backgroundY = (canvas.height - backgroundHeight) / 2;

    ctx.globalAlpha = flagOpacity;
    ctx.drawImage(selectedBackgroundImage, backgroundX, backgroundY, backgroundWidth, backgroundHeight);
    ctx.globalAlpha = 1;

    ctx.drawImage(savedMaskImage, 0, 0, canvas.width, canvas.height);
  }

  // Draw lasers in two passes
  lasers.forEach(laser => {
    drawLaser(laser, ctx);  // First pass: draw laser with hole
  });
  
  lasers.forEach(laser => {
    drawLaserCenter(laser, ctx);  // Second pass: draw centers
  });

  // Draw hats on top of everything
  hats.forEach(hat => {
    ctx.save();
    ctx.translate(hat.x + hat.width / 2, hat.y + hat.height / 2);
    ctx.rotate(hat.rotation);
    ctx.drawImage(hat.image, -hat.width / 2, -hat.height / 2, hat.width, hat.height);
    ctx.restore();
  });
}

function drawLaser(laser, context) {
  context.save();
  context.translate(laser.x + laser.width / 2, laser.y + laser.height / 2);
  context.rotate(laser.rotation);

  // Draw the laser image onto the main context (no cutout here anymore)
  context.drawImage(laser.image, -laser.width / 2, -laser.height / 2, laser.width, laser.height);
  
  context.restore();
}

function drawLaserCenter(laser, context) {
  context.save();
  context.translate(laser.x + laser.width / 2, laser.y + laser.height / 2);
  context.rotate(laser.rotation);

  // Calculate the width and height of the laserTopImage to match the laser size
  const topWidth = laser.width;
  const topHeight = laser.height;

  // Draw the laser center directly, without additional temporary canvas or composite operations
  context.drawImage(
    laserTopImage,
    -topWidth / 2,
    -topHeight / 2,
    topWidth,
    topHeight
  );

  context.restore();
}

function drawCanvas() {
  // Clear the canvas before drawing
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw the base image (the original uploaded image)
  ctx.drawImage(canvasImage, 0, 0, canvas.width, canvas.height);

  // Apply the selected filter (if any)
  if (currentFilter === 'dark') {
    applyGradientMapFilter(ctx, canvas.width, canvas.height);
  } else if (currentFilter === 'classic') {
    applyClassicRedFilter(ctx, canvas.width, canvas.height);
  } else if (currentFilter === 'light') {
    applyLightFilter(ctx, canvas.width, canvas.height);
  }

  // Apply contrast and redness adjustments
  applyContrastAndRedness(ctx, canvas.width, canvas.height);

  // Draw the flag and masked image if the flag is applied
  if (flagApplied && savedMaskImage) {
    const backgroundAspectRatio = selectedBackgroundImage.width / selectedBackgroundImage.height;
    let backgroundWidth, backgroundHeight;

    if (canvas.width / canvas.height > backgroundAspectRatio) {
      backgroundWidth = canvas.width;
      backgroundHeight = backgroundWidth / backgroundAspectRatio;
    } else {
      backgroundHeight = canvas.height;
      backgroundWidth = backgroundHeight * backgroundAspectRatio;
    }

    const backgroundX = (canvas.width - backgroundWidth) / 2;
    const backgroundY = (canvas.height - backgroundHeight) / 2;

    ctx.globalAlpha = flagOpacity;
    ctx.drawImage(selectedBackgroundImage, backgroundX, backgroundY, backgroundWidth, backgroundHeight);
    ctx.globalAlpha = 1;

    ctx.drawImage(savedMaskImage, 0, 0, canvas.width, canvas.height);
  }

  // Draw lasers in two passes
  lasers.forEach(laser => {
    drawLaser(laser, ctx);  // First pass: draw laser with hole
  });
  
  lasers.forEach(laser => {
    drawLaserCenter(laser, ctx);  // Second pass: draw centers
  });

  // Draw hats on top of everything
  hats.forEach(hat => {
    ctx.save();
    ctx.translate(hat.x + hat.width / 2, hat.y + hat.height / 2);
    ctx.rotate(hat.rotation);
    ctx.drawImage(hat.image, -hat.width / 2, -hat.height / 2, hat.width, hat.height);
    ctx.restore();
  });
}

function applyContrastAndRedness(context, width, height) {
  const imageData = context.getImageData(0, 0, width, height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    // Apply contrast adjustment
    data[i] = ((data[i] - 128) * contrastValue + 128);  // Red channel
    data[i + 1] = ((data[i + 1] - 128) * contrastValue + 128);  // Green channel
    data[i + 2] = ((data[i + 2] - 128) * contrastValue + 128);  // Blue channel

    // Calculate average intensity (grayscale value)
    const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;

    // Apply saturation adjustment (rednessValue now represents saturation)
    data[i] = avg + (data[i] - avg) * rednessValue;  // Red channel
    data[i + 1] = avg + (data[i + 1] - avg) * rednessValue;  // Green channel
    data[i + 2] = avg + (data[i + 2] - avg) * rednessValue;  // Blue channel
  }

  context.putImageData(imageData, 0, 0);
}

function applyGradientMapFilter(context, width, height) {
  const imageData = context.getImageData(0, 0, width, height);
  const data = imageData.data;

  const redColor = [243, 4, 13]; // #f3040d
  const blueColor = [7, 11, 40]; // #070b28

  // Apply gradient map
  for (let i = 0; i < data.length; i += 4) {
    const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;

    const factor = brightness / 255;
    const adjustedFactor = Math.pow(factor, 0.9);

    data[i] = blueColor[0] + adjustedFactor * (redColor[0] - blueColor[0]);
    data[i + 1] =
      blueColor[1] + adjustedFactor * (redColor[1] - blueColor[1]);
    data[i + 2] =
      blueColor[2] + adjustedFactor * (redColor[2] - blueColor[2]);
  }

  context.putImageData(imageData, 0, 0);
}

function applyClassicRedFilter(context, width, height) {
  const imageData = context.getImageData(0, 0, width, height);
  const data = imageData.data;

  // Adjusted colors with reduced saturation
  const redColor = [210, 50, 60]; // Slightly desaturated and darkened red
  const blueColor = [5, 8, 20];   // Darker blue

  // Apply gradient map
  for (let i = 0; i < data.length; i += 4) {
    const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;

    const factor = brightness / 255;
    const adjustedFactor = Math.pow(factor, 0.8); // Slightly adjusted gamma for more contrast

    data[i] = blueColor[0] + adjustedFactor * (redColor[0] - blueColor[0]);
    data[i + 1] =
      blueColor[1] + adjustedFactor * (redColor[1] - blueColor[1]);
    data[i + 2] =
      blueColor[2] + adjustedFactor * (redColor[2] - blueColor[2]);
  }

  context.putImageData(imageData, 0, 0);
}

function applyLightFilter(context, width, height) {
  const imageData = context.getImageData(0, 0, width, height);
  const data = imageData.data;

  // Adjust these values to fine-tune the effect
  const redFlareStrength = 0.4;   // Strength of the red flare (0-1)
  const blueHintStrength = 0.1;   // Strength of the blue hints (0-1)
  const saturationBoost = 1.2;    // Increase overall color saturation
  const contrastBoost = 1.1;      // Slight increase in contrast

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    // Apply contrast boost
    r = Math.min(255, Math.max(0, (r - 128) * contrastBoost + 128));
    g = Math.min(255, Math.max(0, (g - 128) * contrastBoost + 128));
    b = Math.min(255, Math.max(0, (b - 128) * contrastBoost + 128));

    // Calculate luminance
    const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
    
    // Apply red flare
    r = Math.min(255, r + (255 - r) * redFlareStrength);
    
    // Apply subtle blue hints to darker areas
    const blueFactor = Math.pow(1 - luminance / 255, 2) * blueHintStrength;
    b = Math.min(255, b + (255 - b) * blueFactor);

    // Boost saturation
    const avg = (r + g + b) / 3;
    r = Math.min(255, avg + (r - avg) * saturationBoost);
    g = Math.min(255, avg + (g - avg) * saturationBoost);
    b = Math.min(255, avg + (b - avg) * saturationBoost);

    // Set the new pixel values
    data[i] = Math.round(r);
    data[i + 1] = Math.round(g);
    data[i + 2] = Math.round(b);
  }

  context.putImageData(imageData, 0, 0);
}

function applyFullResContrastAndRedness(context, width, height) {
  const imageData = context.getImageData(0, 0, width, height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    // Apply contrast adjustment
    data[i] = ((data[i] - 128) * contrastValue + 128);  // Red channel
    data[i + 1] = ((data[i + 1] - 128) * contrastValue + 128);  // Green channel
    data[i + 2] = ((data[i + 2] - 128) * contrastValue + 128);  // Blue channel

    // Apply redness adjustment
    data[i] = data[i] * rednessValue;  // Only adjust red channel
  }

  context.putImageData(imageData, 0, 0);
}


function applyFullResGradientMapFilter(context, width, height) {
  if (currentFilter === 'dark') {
    applyGradientMapFilter(context, width, height);
  } else if (currentFilter === 'classic') {
    applyClassicRedFilter(context, width, height);
  } else if (currentFilter === 'light') {
    applyLightFilter(context, width, height);
  }
}

// Tab functionality
document.querySelectorAll('.tab-link').forEach(tab => {
  tab.addEventListener('click', function() {
    const tab_id = this.getAttribute('data-tab');

    document.querySelectorAll('.tab-link').forEach(tab => {
      tab.classList.remove('current');
    });
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.remove('current');
    });

    this.classList.add('current');
    document.getElementById(tab_id).classList.add('current');
  });
});

document.getElementById("remove-all-lasers-button").addEventListener("click", function () {
  lasers = [];
  drawCanvas();
});

document.getElementById("remove-all-hats-button").addEventListener("click", function () {
  hats = [];
  drawCanvas();
});