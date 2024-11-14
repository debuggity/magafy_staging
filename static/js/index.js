const canvas = document.getElementById("meme-canvas");
const ctx = canvas.getContext("2d");
//const ctx = canvas.getContext("2d", { willReadFrequently: true });

const laserImageTemplate = new Image();
laserImageTemplate.src = "https://dmagafy-staging.netlify.app/laser_large.png";
laserImageTemplate.crossOrigin = "anonymous";

let laserRadialImage = new Image();
laserRadialImage.src = "https://dmagafy-staging.netlify.app/laser_radial.png";
laserRadialImage.crossOrigin = "anonymous";

let laserTopImage = new Image();
laserTopImage.src = "https://dmagafy-staging.netlify.app/laser_top.png"; // Replace with your actual URL
laserTopImage.crossOrigin = "anonymous";

let radialTopImage = new Image();
radialTopImage.src = "https://dmagafy-staging.netlify.app/radial_top.png";
radialTopImage.crossOrigin = "anonymous";

let canvasImage = new Image();
let lasers = [];
let isDragging = false;
let currentLaser = null;
let offsetX, offsetY;

let maskCanvas = document.createElement('canvas');
let maskCtx = maskCanvas.getContext('2d');
let isMasking = false;
let brushSize = 20;
let brushShape = 'circle';

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

// Create an offscreen canvas for magnifier
const offscreenCanvas = document.createElement('canvas');
const offscreenCtx = offscreenCanvas.getContext('2d');

// Set magnifier properties
const magnifierSize = 150; // Diameter in pixels
const magnification = 1.5;   // Zoom level

offscreenCanvas.width = magnifierSize * magnification;
offscreenCanvas.height = magnifierSize * magnification;

// Magnifier Element
const magnifier = document.getElementById("magnifier");

let selectedLaserType = 'default';  // Default laser type

document.querySelectorAll('.laser-option').forEach(option => {
  option.addEventListener('click', function () {
    document.querySelectorAll('.laser-option').forEach(opt => opt.classList.remove('selected'));
    this.classList.add('selected');
    selectedLaserType = this.getAttribute('data-laser-type');
  });
});

// Function to convert canvas coordinates to client (screen) coordinates
function canvasToClient(canvas, x, y) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = rect.width / canvas.width;
  const scaleY = rect.height / canvas.height;
  return {
    clientX: x * scaleX + rect.left,
    clientY: y * scaleY + rect.top
  };
}

// Function to update the magnifier's background using the offscreen canvas
function updateMagnifierBackground(x, y) {
  // Determine the center of the selected object
  let objectCenterX, objectCenterY;
  if (currentLaser) {
    objectCenterX = currentLaser.x + currentLaser.width / 2;
    objectCenterY = currentLaser.y + currentLaser.height / 2;
  } else if (currentHat) {
    objectCenterX = currentHat.x + currentHat.width / 2;
    objectCenterY = currentHat.y + currentHat.height / 2;
  } else {
    return; // No object selected
  }

  // Calculate the area to capture from the main canvas
  const captureX = objectCenterX - (magnifierSize / 2 - 25) / magnification;
  const captureY = objectCenterY - (magnifierSize / 2 - 25) / magnification;

  // Clear the offscreen canvas
  offscreenCtx.clearRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);

  // Draw the captured area onto the offscreen canvas, scaling it up
  offscreenCtx.drawImage(
    canvas,
    captureX,
    captureY,
    magnifierSize / magnification,
    magnifierSize / magnification,
    0,
    0,
    magnifierSize * magnification,
    magnifierSize * magnification
  );

  // Update the magnifier's background with the offscreen canvas
  magnifier.style.backgroundImage = `url(${offscreenCanvas.toDataURL()})`;
  magnifier.style.backgroundSize = `${magnifierSize * magnification}px ${magnifierSize * magnification}px`;
}

// Function to show the magnifier, centered on the object's center but avoiding the touch point
function showMagnifier(x, y) {
  if (!currentLaser) {
    hideMagnifier(); // Only show magnifier for lasers, hide it for hats
    return;
  }

  magnifier.style.display = "block";
  const offset = 50; // Offset to position magnifier away from touch point

  let left = x + offset;
  let top = y + offset;

  // Prevent magnifier from going off-screen
  if (left + magnifierSize > window.innerWidth) {
    left = x - magnifierSize - offset;
  }
  if (top + magnifierSize > window.innerHeight) {
    top = y - magnifierSize - offset;
  }

  magnifier.style.left = `${left}px`;
  magnifier.style.top = `${top}px`;

  // Update magnifier background with current laser position
  updateMagnifierBackground(x, y);
}

// Function to move the magnifier as the object is dragged
function moveMagnifier(x, y) {
  const offset = 20; // Offset to position magnifier away from touch point

  let left = x + offset;
  let top = y + offset;

  // Prevent magnifier from going off-screen
  if (left + magnifierSize > window.innerWidth) {
    left = x - magnifierSize - offset;
  }
  if (top + magnifierSize > window.innerHeight) {
    top = y - magnifierSize - offset;
  }

  magnifier.style.left = `${left}px`;
  magnifier.style.top = `${top}px`;

  // Update magnifier background
  updateMagnifierBackground(x, y);
}

// Function to hide the magnifier
function hideMagnifier() {
  magnifier.style.display = "none";
}

let modelLoaded = false;
const loadingOverlay = document.getElementById("loading-overlay");
const errorIndicator = document.getElementById("error-indicator");

let u2netSession = null; // Initialize only once

async function loadModel() {
  if (u2netSession) return; // Avoid reloading if already loaded

  try {
    u2netSession = await ort.InferenceSession.create('./u2netp.onnx');
    modelLoaded = true;
  } catch (error) {
    console.error("Failed to load ONNX model:", error);
    showErrorIndicator();
  }
}

// Call this only once during page load
window.addEventListener('DOMContentLoaded', loadModel);

// Show loading overlay only during background removal
function showLoadingOverlay() {
  loadingOverlay.classList.remove("hidden");
  loadingOverlay.style.display = "flex";
}

// Hide loading overlay after background removal completes
function hideLoadingOverlay() {
  loadingOverlay.classList.add("hidden");
  loadingOverlay.style.display = "none";
}

// Show error indicator if the model fails
function showErrorIndicator() {
  errorIndicator.classList.remove("hidden");
}

// Hide error indicator once the model is loaded
function hideErrorIndicator() {
  errorIndicator.classList.add("hidden");
}

// State variable to track if the flag is applied
let flagApplied = false;

// Updated addFlagWithBackgroundRemoval function to handle loading states
async function addFlagWithBackgroundRemoval() {
  if (!modelLoaded) {
    showErrorIndicator();  // Show "X" if the model is not loaded
    return;
  }

  hideErrorIndicator(); // Hide error if model is loaded

  if (!canvasImage) return;

  const inputTensor = preprocessImageForONNX(canvasImage);

  // Show loading animation while processing
  showLoadingOverlay();

  try {
    // Perform inference with the ONNX model
    const output = await u2netSession.run({ 'input.1': inputTensor });
    const maskImage = postprocessONNXOutput(output[Object.keys(output)[0]], canvasImage);

    maskImage.onload = function () {
      // Set flagApplied to true since the user has added the flag
      flagApplied = true;
      savedMaskImage = maskImage;

      drawCanvas();  // Redraw everything, including the flag and mask
    };

    // Dispose of input and output tensors
    inputTensor.dispose();
    Object.values(output).forEach(tensor => tensor.dispose());

  } catch (error) {
    console.error("Error during background removal:", error);
    showErrorIndicator();
  } finally {
    // Hide loading overlay after processing completes
    hideLoadingOverlay();
  }
}

// Event listener for the "Add Background" button
document.getElementById("add-background-button").addEventListener("click", function () {
  const selectedOption = document.querySelector('input[name="background"]:checked').value;
  if (selectedOption === "americanFlag") {
    selectedBackgroundImage = americanFlagImage;
  } else if (selectedOption === "lightning") {
    selectedBackgroundImage = lightningImage;
  }

  addFlagWithBackgroundRemoval();  // Run background removal only when button is clicked
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

document.querySelector(".upload-btn").addEventListener("click", () => {
  document.getElementById("image-upload").click();
});

document.getElementById("image-upload").addEventListener("change", function (e) {
  const reader = new FileReader();
  reader.onload = function (event) {
    // Hide the initial load screen
    document.getElementById("initial-load-screen").style.display = "none";

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

      maskCanvas.width = canvas.width;
      maskCanvas.height = canvas.height;
      clearMask();  // Clears any existing mask for a fresh start

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
  const aspectRatio = (selectedLaserType === 'radial') 
    ? laserRadialImage.width / laserRadialImage.height
    : laserImageTemplate.width / laserImageTemplate.height;

  let laserWidth = canvas.width * 0.5; // Increased to 50% of the canvas width
  let laserHeight = laserWidth / aspectRatio;

  if (laserHeight > canvas.height) {
    laserHeight = canvas.height * 0.5;
    laserWidth = laserHeight * aspectRatio;
  }

  const laser = {
    image: (selectedLaserType === 'radial') ? laserRadialImage : laserImageTemplate,
    width: laserWidth,
    height: laserHeight,
    x: canvas.width / 2 - laserWidth / 2,
    y: canvas.height / 2 - laserHeight / 2,
    rotation: 0,
    topImage: (selectedLaserType === 'radial') ? radialTopImage : laserTopImage
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
      'hat1': "https://dmagafy-staging.netlify.app/hat_front_1.png",
      'hat2': "https://dmagafy-staging.netlify.app/hat_front_2.png",
      'hatLeft': "https://dmagafy-staging.netlify.app/hat_left.png",
      'hatRight': "https://dmagafy-staging.netlify.app/hat_right.png",
      'goth1': "https://dmagafy-staging.netlify.app/goth-front-hat.png",
      'gothLeft': "https://dmagafy-staging.netlify.app/goth-side-hat.png"
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
  // Check if we are masking
  if (document.querySelector('.tab-link[data-tab="tab-5"]').classList.contains('current')) {
    isMasking = true;
    applyMask(e.offsetX, e.offsetY);
  } else {
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
  }
});

canvas.addEventListener("mousemove", function (e) {
  if (isMasking) {
    applyMask(e.offsetX, e.offsetY);
  } else if (isDragging) {
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
  if (isMasking) {
    isMasking = false;
  }
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

canvas.addEventListener("mouseleave", function (e) {
  if (isMasking) {
    isMasking = false;
  }
});

// Touch Start Event - Shows magnifier only for lasers, but allows dragging for hats too
canvas.addEventListener("touchstart", function (e) {
  if (document.querySelector('.tab-link[data-tab="tab-5"]').classList.contains('current')) {
    const touch = e.touches[0];
    applyMask(touch.clientX - canvas.getBoundingClientRect().left, touch.clientY - canvas.getBoundingClientRect().top);
    isMasking = true;
  } else {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const touchX = (touch.clientX - rect.left) * scaleX;
    const touchY = (touch.clientY - rect.top) * scaleY;

    let closestDistance = Infinity;
    currentLaser = null;
    currentHat = null;

    // Identify the closest laser
    lasers.forEach((laser) => {
      const centerX = laser.x + laser.width / 2;
      const centerY = laser.y + laser.height / 2;
      const distance = Math.sqrt(
        Math.pow(touchX - centerX, 2) + Math.pow(touchY - centerY, 2)
      );

      if (
        touchX > laser.x &&
        touchX < laser.x + laser.width &&
        touchY > laser.y &&
        touchY < laser.y + laser.height &&
        distance < closestDistance
      ) {
        closestDistance = distance;
        currentLaser = laser;
        currentHat = null;
        offsetX = touchX - laser.x;
        offsetY = touchY - laser.y;
      }
    });

    // Identify the closest hat if no closer laser is found
    hats.forEach((hat) => {
      const centerX = hat.x + hat.width / 2;
      const centerY = hat.y + hat.height / 2;
      const distance = Math.sqrt(
        Math.pow(touchX - centerX, 2) + Math.pow(touchY - centerY, 2)
      );

      if (
        touchX > hat.x &&
        touchX < hat.x + hat.width &&
        touchY > hat.y &&
        touchY < hat.y + hat.height &&
        distance < closestDistance
      ) {
        closestDistance = distance;
        currentHat = hat;
        currentLaser = null;
        offsetX = touchX - hat.x;
        offsetY = touchY - hat.y;
      }
    });

    // Set dragging flag and show magnifier only if a laser is selected
    if (currentLaser || currentHat) {
      isDragging = true;

      // Show magnifier only if a laser is selected
      if (currentLaser) {
        // Calculate the center of the selected laser
        const objectCenterX = currentLaser.x + currentLaser.width / 2;
        const objectCenterY = currentLaser.y + currentLaser.height / 2;

        // Convert canvas coordinates to client (screen) coordinates
        const clientPos = canvasToClient(canvas, objectCenterX, objectCenterY);

        // Show the magnifier centered on the laser's center
        showMagnifier(clientPos.clientX, clientPos.clientY);
      }
    }
  }
});

// Touch Move Event
canvas.addEventListener("touchmove", function (e) {
  if (isMasking) {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const offsetX = touch.clientX - rect.left;
    const offsetY = touch.clientY - rect.top;
    applyMask(offsetX, offsetY);
  } else if (isDragging) {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const touchX = (touch.clientX - rect.left) * scaleX;
    const touchY = (touch.clientY - rect.top) * scaleY;

    // Update positions of the selected element
    if (currentLaser) {
      currentLaser.x = touchX - offsetX;
      currentLaser.y = touchY - offsetY;
    }

    if (currentHat) {
      currentHat.x = touchX - offsetX;
      currentHat.y = touchY - offsetY;
    }

    // Redraw the canvas with updated positions
    drawCanvas();

    // Calculate the new center of the selected object
    let objectCenterX, objectCenterY;
    if (currentLaser) {
      objectCenterX = currentLaser.x + currentLaser.width / 2;
      objectCenterY = currentLaser.y + currentLaser.height / 2;
    } else if (currentHat) {
      objectCenterX = currentHat.x + currentHat.width / 2;
      objectCenterY = currentHat.y + currentHat.height / 2;
    }

    // Convert canvas coordinates to client (screen) coordinates
    if (objectCenterX && objectCenterY) {
      const clientPos = canvasToClient(canvas, objectCenterX, objectCenterY);
      // Update the magnifier's background to reflect the current canvas state
      updateMagnifierBackground(clientPos.clientX, clientPos.clientY);
    }
  }
});

// Touch End Event - Hide magnifier regardless of item type
canvas.addEventListener("touchend", function () {
  if (isMasking) {
    isMasking = false;
  }
  if (isDragging) {
    if (currentLaser) {
      currentLaser.isDragging = false;
    }

    if (currentHat) {
      currentHat.isDragging = false;
    }

    isDragging = false;
    currentLaser = null;
    currentHat = null;

    // Hide the magnifier when dragging ends
    hideMagnifier();
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

  // Apply the negative space mask on the full-resolution canvas
  // Inverse the mask area to not apply filters
  const maskData = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
  const scaledMaskCanvas = document.createElement('canvas');
  scaledMaskCanvas.width = fullResCanvas.width;
  scaledMaskCanvas.height = fullResCanvas.height;
  const scaledMaskCtx = scaledMaskCanvas.getContext('2d');
  scaledMaskCtx.drawImage(maskCanvas, 0, 0, fullResCanvas.width, fullResCanvas.height);
  const fullResMaskData = scaledMaskCtx.getImageData(0, 0, fullResCanvas.width, fullResCanvas.height);

  // Create a new canvas to store final compositing
  const finalCanvas = document.createElement("canvas");
  finalCanvas.width = fullResCanvas.width;
  finalCanvas.height = fullResCanvas.height;
  const finalCtx = finalCanvas.getContext("2d");

  // Draw original filtered image
  finalCtx.drawImage(fullResCanvas, 0, 0);

  // Remove filtered areas where mask is applied
  finalCtx.globalCompositeOperation = 'destination-out';
  finalCtx.drawImage(scaledMaskCanvas, 0, 0);
  finalCtx.globalCompositeOperation = 'source-over';

  // Draw original image over these areas
  finalCtx.globalCompositeOperation = 'destination-over';
  finalCtx.drawImage(canvasImage, 0, 0, fullResCanvas.width, fullResCanvas.height);

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
    drawLaser(scaledLaser, finalCtx);
  });

  lasers.forEach((laser) => {
    const scaledLaser = {
      ...laser,
      x: laser.x * scaleX,
      y: laser.y * scaleY,
      width: laser.width * scaleX,
      height: laser.height * scaleY
    };
    drawLaserCenter(scaledLaser, finalCtx);
  });

  // Draw hats at full resolution
  hats.forEach((hat) => {
    finalCtx.save();
    finalCtx.translate(
      (hat.x + hat.width / 2) * scaleX,
      (hat.y + hat.height / 2) * scaleY
    );
    finalCtx.rotate(hat.rotation);
    finalCtx.drawImage(
      hat.image,
      -hat.width * scaleX / 2,
      -hat.height * scaleY / 2,
      hat.width * scaleX,
      hat.height * scaleY
    );
    finalCtx.restore();
  });

  // Export the final image as a PNG
  finalCanvas.toBlob(function (blob) {
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

          // Ensure maskCanvas matches the main canvas dimensions
          maskCanvas.width = canvas.width;
          maskCanvas.height = canvas.height;

          clearMask();  // Clears any existing mask for a fresh start

          // Clear the canvas before drawing the new image
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          drawCanvas(); // Redraw with the new image and reset state

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

        // Ensure maskCanvas matches the main canvas dimensions
        maskCanvas.width = canvas.width;
        maskCanvas.height = canvas.height;

        clearMask();  // Clears any existing mask for a fresh start

        // Clear the canvas before drawing the new image
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawCanvas(); // Redraw with the new image and reset state

        document.querySelector(".button-container").style.display = "flex";
      };
      canvasImage.src = event.target.result;
    };
    reader.readAsDataURL(file);
  }
});

// For mask drawing (negative space)
canvas.addEventListener("mousedown", function (e) {
  if (document.querySelector('.tab-link[data-tab="tab-5"]').classList.contains('current')) {
    isMasking = true;
    applyMask(e.offsetX, e.offsetY);
  }
});

canvas.addEventListener("mousemove", function (e) {
  if (isMasking) {
    applyMask(e.offsetX, e.offsetY);
  }
});

canvas.addEventListener("mouseup", function (e) {
  if (isMasking) {
    isMasking = false;
  }
});

canvas.addEventListener("mouseleave", function (e) {
  if (isMasking) {
    isMasking = false;
  }
});

// Touch events for masking
canvas.addEventListener("touchstart", function (e) {
  if (document.querySelector('.tab-link[data-tab="tab-5"]').classList.contains('current')) {
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const offsetX = touch.clientX - rect.left;
    const offsetY = touch.clientY - rect.top;
    isMasking = true;
    applyMask(offsetX, offsetY);
  }
});

canvas.addEventListener("touchmove", function (e) {
  if (isMasking) {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const offsetX = touch.clientX - rect.left;
    const offsetY = touch.clientY - rect.top;
    applyMask(offsetX, offsetY);
  }
});

canvas.addEventListener("touchend", function (e) {
  if (isMasking) {
    isMasking = false;
  }
});

function applyMask(x, y) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = maskCanvas.width / rect.width;
  const scaleY = maskCanvas.height / rect.height;
  const adjustedX = x * scaleX;
  const adjustedY = y * scaleY;

  maskCtx.globalCompositeOperation = 'destination-out';
  maskCtx.fillStyle = '#000';
  if (brushShape === 'circle') {
    maskCtx.beginPath();
    maskCtx.arc(adjustedX, adjustedY, brushSize * scaleX, 0, 2 * Math.PI);
    maskCtx.fill();
  } else if (brushShape === 'square') {
    maskCtx.fillRect(adjustedX - brushSize * scaleX / 2, adjustedY - brushSize * scaleY / 2, brushSize * scaleX, brushSize * scaleY);
  }
  maskCtx.globalCompositeOperation = 'source-over';
  drawCanvas();
}

function clearMask() {
  maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
}

// Mask tab event listeners
document.querySelectorAll('input[name="brushShape"]').forEach(radio => {
  radio.addEventListener('change', (e) => {
    brushShape = e.target.value;
  });
});

document.getElementById("brush-size-slider").addEventListener("input", function (e) {
  brushSize = parseInt(e.target.value, 10);
});

document.getElementById("clear-mask-button").addEventListener("click", function () {
  clearMask();
  drawCanvas();
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

  // **1.** Apply the mask to the image to show the original image in masked areas (removing filters)
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.drawImage(maskCanvas, 0, 0, canvas.width, canvas.height);
  ctx.restore();

  // **2.** Apply the selected filter (if any) to the canvas
  if (currentFilter === 'dark') {
    applyGradientMapFilter(ctx, canvas.width, canvas.height);
  } else if (currentFilter === 'classic') {
    applyClassicRedFilter(ctx, canvas.width, canvas.height);
  } else if (currentFilter === 'light') {
    applyLightFilter(ctx, canvas.width, canvas.height);
  }

  // **3.** Apply contrast and redness adjustments
  applyContrastAndRedness(ctx, canvas.width, canvas.height);

  // **4.** Apply the mask again to restore original image in masked areas
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.drawImage(maskCanvas, 0, 0, canvas.width, canvas.height);
  ctx.restore();

  // **5.** Draw the flag and masked image if the flag is applied
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

  // **6.** Draw lasers in two passes
  lasers.forEach(laser => {
    drawLaser(laser, ctx);  // First pass: draw laser
  });

  lasers.forEach(laser => {
    drawLaserCenter(laser, ctx);  // Second pass: draw laser center
  });

  // **7.** Draw hats on top of everything
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
  if (!laser.topImage) return;  // Skip if no top image

  context.save();
  context.translate(laser.x + laser.width / 2, laser.y + laser.height / 2);
  context.rotate(laser.rotation);

  const topWidth = laser.width;
  const topHeight = laser.height;

  context.drawImage(
    laser.topImage,
    -topWidth / 2,
    -topHeight / 2,
    topWidth,
    topHeight
  );

  context.restore();
}
