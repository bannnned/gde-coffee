function normalizeQuarterTurns(value: number): 0 | 1 | 2 | 3 {
  const normalized = ((Math.trunc(value) % 4) + 4) % 4;
  if (normalized === 0 || normalized === 1 || normalized === 2 || normalized === 3) {
    return normalized;
  }
  return 0;
}

function resolveOutputType(inputType: string): string {
  if (inputType === "image/jpeg" || inputType === "image/png" || inputType === "image/webp") {
    return inputType;
  }
  return "image/jpeg";
}

function buildOutputFileName(inputName: string, outputType: string): string {
  const baseName = inputName.replace(/\.[^.]+$/, "");
  const extension = outputType === "image/png" ? "png" : outputType === "image/webp" ? "webp" : "jpg";
  return `${baseName || "photo"}.${extension}`;
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("failed to decode image"));
    };
    image.src = objectUrl;
  });
}

export async function rotateImageFileByQuarterTurns(file: File, quarterTurns: number): Promise<File> {
  const turns = normalizeQuarterTurns(quarterTurns);
  if (turns === 0) {
    return file;
  }

  const image = await loadImageFromFile(file);
  const sourceWidth = Math.max(1, image.naturalWidth || image.width || 1);
  const sourceHeight = Math.max(1, image.naturalHeight || image.height || 1);
  const swapSides = turns % 2 === 1;
  const canvas = document.createElement("canvas");
  canvas.width = swapSides ? sourceHeight : sourceWidth;
  canvas.height = swapSides ? sourceWidth : sourceHeight;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("canvas context unavailable");
  }

  context.translate(canvas.width / 2, canvas.height / 2);
  context.rotate((Math.PI / 2) * turns);
  context.drawImage(image, -sourceWidth / 2, -sourceHeight / 2);

  const outputType = resolveOutputType(file.type || "");
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (nextBlob) => {
        if (nextBlob) {
          resolve(nextBlob);
          return;
        }
        reject(new Error("failed to export rotated image"));
      },
      outputType,
      outputType === "image/jpeg" || outputType === "image/webp" ? 0.92 : undefined,
    );
  });

  return new File([blob], buildOutputFileName(file.name, outputType), {
    type: outputType,
    lastModified: Date.now(),
  });
}

