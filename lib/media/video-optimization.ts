export type VideoOptimizationStatus =
  | "uploading"
  | "file_checking"
  | "optimizing"
  | "completed"
  | "failed"

export type VideoOptimizationDbStatus =
  | "not_needed"
  | "pending"
  | "processing"
  | "completed"
  | "failed"

export type VideoOptimizationProgress = {
  status: VideoOptimizationStatus
  message: string
  attempt?: number
}

export const VIDEO_MAX_UPLOAD_SIZE_BYTES = 500 * 1024 * 1024
export const VIDEO_OPTIMIZATION_TARGET_BYTES = VIDEO_MAX_UPLOAD_SIZE_BYTES

export const VIDEO_OPTIMIZER_UNAVAILABLE_ERROR =
  "Video exceeds 500MB maximum upload size"

export const VIDEO_OPTIMIZER_UNAVAILABLE_MESSAGE =
  "영상 파일은 최대 500MB까지 업로드할 수 있습니다. 현재 선택한 파일은 500MB를 초과했습니다. 파일을 압축한 뒤 다시 업로드해 주세요."

export type PreparedMediaUpload = {
  file: File
  originalFile: File
  originalSize: number
  optimizedSize: number | null
  optimizationStatus: VideoOptimizationDbStatus
  optimizationError?: string | null
  optimizationAttempts: number
  optimizationSettings: {
    codec: "h264"
    audioCodec: "aac"
    container: "mp4"
    maxHeight: number
    maxFps: number
    targetBytes: number
    bitrateKbps: number
  } | null
}

const MIN_VIDEO_BITRATE_KBPS = 900

type VideoOptimizerAdapter = (input: {
  file: File
  targetBytes: number
  attempt: number
  settings: NonNullable<PreparedMediaUpload["optimizationSettings"]>
  onProgress?: (progress: VideoOptimizationProgress) => void
}) => Promise<File>

declare global {
  interface Window {
    PostBridgeVideoOptimizer?: {
      optimize: VideoOptimizerAdapter
    }
  }
}

export async function prepareMediaFileForUpload(
  file: File,
  onProgress?: (progress: VideoOptimizationProgress) => void,
): Promise<PreparedMediaUpload> {
  onProgress?.({
    status: "file_checking",
    message: "파일 검사 중",
  })

  if (!file.type.startsWith("video/") || file.size <= VIDEO_MAX_UPLOAD_SIZE_BYTES) {
    return {
      file,
      originalFile: file,
      originalSize: file.size,
      optimizedSize: null,
      optimizationStatus: "not_needed",
      optimizationAttempts: 0,
      optimizationSettings: null,
    }
  }

  onProgress?.({
    status: "failed",
    message: "영상 용량 초과",
    attempt: 1,
  })

  return {
    file,
    originalFile: file,
    originalSize: file.size,
    optimizedSize: null,
    optimizationStatus: "failed",
    optimizationError: VIDEO_OPTIMIZER_UNAVAILABLE_ERROR,
    optimizationAttempts: 1,
    optimizationSettings: null,
  }
}

export function isVideoOptimizationRequired(file: File) {
  return file.type.startsWith("video/") && file.size > VIDEO_MAX_UPLOAD_SIZE_BYTES
}

export function isVideoOptimizerAvailable() {
  return Boolean(
    typeof window !== "undefined" && window.PostBridgeVideoOptimizer?.optimize,
  )
}

export function buildFfmpegOptimizationArgs(
  settings: NonNullable<PreparedMediaUpload["optimizationSettings"]>,
) {
  return [
    "-i",
    "input",
    "-vf",
    `scale=-2:min(${settings.maxHeight}\\,ih),fps=min(${settings.maxFps}\\,fps)`,
    "-c:v",
    "libx264",
    "-b:v",
    `${settings.bitrateKbps}k`,
    "-preset",
    "medium",
    "-movflags",
    "+faststart",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "output.mp4",
  ]
}

export function buildFfmpegOptimizationSettings(
  file: File,
  attempt: number,
): NonNullable<PreparedMediaUpload["optimizationSettings"]> {
  const estimatedDurationSeconds = estimateDurationSeconds(file)
  const targetVideoKbps = Math.max(
    MIN_VIDEO_BITRATE_KBPS,
    Math.floor(
      ((VIDEO_MAX_UPLOAD_SIZE_BYTES * 8) / estimatedDurationSeconds / 1000) *
        (0.86 - (attempt - 1) * 0.14),
    ),
  )

  return {
    codec: "h264",
    audioCodec: "aac",
    container: "mp4",
    maxHeight: 1080,
    maxFps: 30,
    targetBytes: VIDEO_MAX_UPLOAD_SIZE_BYTES,
    bitrateKbps: targetVideoKbps,
  }
}

function estimateDurationSeconds(file: File) {
  const assumedInputBitrateKbps = 12_000
  return Math.max(15, (file.size * 8) / (assumedInputBitrateKbps * 1000))
}
