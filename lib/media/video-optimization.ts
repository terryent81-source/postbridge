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

export const VIDEO_OPTIMIZER_UNAVAILABLE_ERROR =
  "Video exceeds 300MB and optimizer is not available"

export const VIDEO_OPTIMIZER_UNAVAILABLE_MESSAGE =
  "300MB를 초과한 영상은 업로드 전에 자동 최적화가 필요합니다. 현재 최적화 엔진이 연결되지 않았습니다."

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

export const VIDEO_OPTIMIZATION_TARGET_BYTES = 300 * 1024 * 1024
const MIN_VIDEO_BITRATE_KBPS = 900
const OPTIMIZATION_ATTEMPTS = 3

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

  if (!file.type.startsWith("video/") || file.size <= VIDEO_OPTIMIZATION_TARGET_BYTES) {
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
    status: "optimizing",
    message: "자동 최적화 중",
    attempt: 1,
  })

  const optimizer = getVideoOptimizerAdapter()

  if (!optimizer) {
    onProgress?.({
      status: "failed",
      message: "최적화 실패",
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
      optimizationSettings: buildFfmpegOptimizationSettings(file, 1),
    }
  }

  let lastError: unknown = null

  for (let attempt = 1; attempt <= OPTIMIZATION_ATTEMPTS; attempt += 1) {
    const settings = buildFfmpegOptimizationSettings(file, attempt)

    try {
      const optimizedFile = await optimizer({
        file,
        targetBytes: VIDEO_OPTIMIZATION_TARGET_BYTES,
        attempt,
        settings,
        onProgress,
      })

      if (optimizedFile.size <= VIDEO_OPTIMIZATION_TARGET_BYTES) {
        onProgress?.({
          status: "completed",
          message: "최적화 완료",
          attempt,
        })

        return {
          file: optimizedFile,
          originalFile: file,
          originalSize: file.size,
          optimizedSize: optimizedFile.size,
          optimizationStatus: "completed",
          optimizationAttempts: attempt,
          optimizationSettings: settings,
        }
      }

      lastError = new Error("Optimized video still exceeds 300MB")
    } catch (error) {
      lastError = error
    }

    onProgress?.({
      status: "optimizing",
      message: "자동 최적화 중",
      attempt: attempt + 1,
    })
  }

  onProgress?.({
    status: "failed",
    message: "최적화 실패",
    attempt: OPTIMIZATION_ATTEMPTS,
  })

  return {
    file,
    originalFile: file,
    originalSize: file.size,
    optimizedSize: null,
    optimizationStatus: "failed",
    optimizationError:
      lastError instanceof Error
        ? lastError.message
        : "영상 자동 최적화에 실패했습니다.",
    optimizationAttempts: OPTIMIZATION_ATTEMPTS,
    optimizationSettings: buildFfmpegOptimizationSettings(file, OPTIMIZATION_ATTEMPTS),
  }
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

function getVideoOptimizerAdapter(): VideoOptimizerAdapter | null {
  if (typeof window !== "undefined" && window.PostBridgeVideoOptimizer?.optimize) {
    return window.PostBridgeVideoOptimizer.optimize
  }

  return null
}

function buildFfmpegOptimizationSettings(
  file: File,
  attempt: number,
): NonNullable<PreparedMediaUpload["optimizationSettings"]> {
  const estimatedDurationSeconds = estimateDurationSeconds(file)
  const targetVideoKbps = Math.max(
    MIN_VIDEO_BITRATE_KBPS,
    Math.floor(
      ((VIDEO_OPTIMIZATION_TARGET_BYTES * 8) / estimatedDurationSeconds / 1000) *
        (0.86 - (attempt - 1) * 0.14),
    ),
  )

  return {
    codec: "h264",
    audioCodec: "aac",
    container: "mp4",
    maxHeight: 1080,
    maxFps: 30,
    targetBytes: VIDEO_OPTIMIZATION_TARGET_BYTES,
    bitrateKbps: targetVideoKbps,
  }
}

function estimateDurationSeconds(file: File) {
  // Without probing metadata in the main thread, use a conservative estimate
  // that gives FFmpeg workers a deterministic first-pass bitrate target.
  const assumedInputBitrateKbps = 12_000
  return Math.max(15, (file.size * 8) / (assumedInputBitrateKbps * 1000))
}
