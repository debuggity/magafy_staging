const canvas = document.getElementById("meme-canvas");
const ctx = canvas.getContext("2d", { willReadFrequently: true });
const laserImageTemplate = new Image();
laserImageTemplate.src = "https://dmagafy.netlify.app/laser_large.png";
laserImageTemplate.crossOrigin = "anonymous";

let canvasImage = new Image();
let lasers = [];
let isDragging = false;
let currentLaser = null;
let offsetX, offsetY;
const MAX_WIDTH = 640;
const MAX_HEIGHT = 480;

let originalImageWidth, originalImageHeight;
let currentFilter = 'classic';

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
    document.getElementById("h1-title").style.display = "none";
    canvasImage.onload = function () {
      originalImageWidth = canvasImage.width;
      originalImageHeight = canvasImage.height;

      // Scale the image to fit within the specified limits
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
  reader.readAsDataURL(e.target.files[0]);
});

document.getElementById("add-laser-button").addEventListener("click", function () {
  const aspectRatio = laserImageTemplate.width / laserImageTemplate.height;
  
  let laserWidth = (canvas.width / 5) * 3; // Double the size
  let laserHeight = laserWidth / aspectRatio; // Adjust height based on aspect ratio

  if (laserHeight > canvas.height) {
    laserHeight = (canvas.height / 5) * 3;
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

document.getElementById("resize-slider").addEventListener("input", function (e) {
  const scale = e.target.value;
  lasers.forEach((laser) => {
    const aspectRatio = laser.image.width / laser.image.height;
    const centerX = laser.x + laser.width / 2;
    const centerY = laser.y + laser.height / 2;

    laser.width = (canvas.width / 5) * scale * 2;
    laser.height = laser.width / aspectRatio;

    laser.x = centerX - laser.width / 2;
    laser.y = centerY - laser.height / 2;
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
  currentLaser = null;
  let closestDistance = Infinity;

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
      laser.isDragging = true;
      offsetX = mouseX - laser.x;
      offsetY = mouseY - laser.y;
      currentLaser = laser;
      closestDistance = distance;
    }
  });

  if (currentLaser) {
    isDragging = true;
  }
});

canvas.addEventListener("mousemove", function (e) {
  if (isDragging && currentLaser) {
    const mouseX = e.offsetX;
    const mouseY = e.offsetY;
    currentLaser.x = mouseX - offsetX;
    currentLaser.y = mouseY - offsetY;
    drawCanvas();
  }
});

canvas.addEventListener("mouseup", function () {
  if (currentLaser) {
    currentLaser.isDragging = false;
    isDragging = false;
    currentLaser = null;
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
  currentLaser = null;
  let closestDistance = Infinity;

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
      laser.isDragging = true;
      offsetX = mouseX - laser.x;
      offsetY = mouseY - laser.y;
      currentLaser = laser;
      closestDistance = distance;
    }
  });

  if (currentLaser) {
    isDragging = true;
  }
});

canvas.addEventListener("touchmove", function (e) {
  if (isDragging && currentLaser) {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mouseX = (touch.clientX - rect.left) * scaleX;
    const mouseY = (touch.clientY - rect.top) * scaleY;
    currentLaser.x = mouseX - offsetX;
    currentLaser.y = mouseY - offsetY;
    drawCanvas();
  }
});

canvas.addEventListener("touchend", function () {
  if (currentLaser) {
    currentLaser.isDragging = false;
    isDragging = false;
    currentLaser = null;
  }
});

document.getElementById("download-button").addEventListener("click", function () {
  const fullResCanvas = document.createElement("canvas");
  fullResCanvas.width = originalImageWidth;
  fullResCanvas.height = originalImageHeight;
  const fullResCtx = fullResCanvas.getContext("2d", { willReadFrequently: true });

  // Draw the original image at full resolution
  fullResCtx.drawImage(canvasImage, 0, 0, fullResCanvas.width, fullResCanvas.height);

  // Apply the gradient map filter to the full resolution canvas
  applyFullResGradientMapFilter(fullResCtx, fullResCanvas.width, fullResCanvas.height);

  const scaleX = fullResCanvas.width / canvas.width;
  const scaleY = fullResCanvas.height / canvas.height;

  lasers.forEach((laser) => {
    fullResCtx.save();
    fullResCtx.translate(
      laser.x * scaleX + (laser.width * scaleX) / 2,
      laser.y * scaleY + (laser.height * scaleY) / 2
    );
    fullResCtx.rotate(laser.rotation);
    fullResCtx.drawImage(
      laser.image,
      -(laser.width * scaleX) / 2,
      -(laser.height * scaleY) / 2,
      laser.width * scaleX,
      laser.height * scaleY
    );
    fullResCtx.restore();
  });

  fullResCanvas.toBlob(function (blob) {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "dark_pfp_full_res.png";
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


function drawCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear the canvas before redrawing
  ctx.drawImage(canvasImage, 0, 0, canvas.width, canvas.height);

  if (currentFilter === 'dark') {
    applyGradientMapFilter(ctx, canvas.width, canvas.height);
  } else if (currentFilter === 'classic') {
    applyClassicRedFilter(ctx, canvas.width, canvas.height);
  } else if (currentFilter === 'light') {
    applyLightFilter(ctx, canvas.width, canvas.height);
  }

  lasers.forEach((laser) => {
    ctx.save();
    ctx.translate(laser.x + laser.width / 2, laser.y + laser.height / 2);
    ctx.rotate(laser.rotation);
    ctx.drawImage(
      laser.image,
      -laser.width / 2,
      -laser.height / 2,
      laser.width,
      laser.height
    );
    ctx.restore();
  });
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

function applyFullResGradientMapFilter(context, width, height) {
  if (currentFilter === 'dark') {
    applyGradientMapFilter(context, width, height);
  } else if (currentFilter === 'classic') {
    applyClassicRedFilter(context, width, height);
  } else if (currentFilter === 'light') {
    applyLightFilter(context, width, height);
  }
}
