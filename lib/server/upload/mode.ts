import "server-only"

export type UploadMode = "mock" | "real"

export function getUploadMode(): UploadMode {
  return process.env.UPLOAD_MODE === "real" ? "real" : "mock"
}

export function getMetaGraphApiVersion() {
  return process.env.META_GRAPH_API_VERSION || "v25.0"
}
