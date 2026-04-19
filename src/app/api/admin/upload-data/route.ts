import { NextRequest, NextResponse } from "next/server";
import { withRBAC, type RBACContext } from "@/lib/services/rbac";
import { ingestInterimUpload, validateFile, getUploadHistory, getUploadLogById } from "@/lib/services/ingestion-service";
import { generateCorrelationId } from "@/lib/utils";
import { UPLOAD } from "@/constants/constants";
import type { DataType } from "@/types";

// ============================================================
// Constants
// ============================================================

const VALID_DATA_TYPES: DataType[] = [
  "incident",
  "metric",
  "service_map",
  "deployment",
  "error_budget",
];

const MAX_FILE_SIZE_BYTES = UPLOAD.MAX_FILE_SIZE_BYTES;

// ============================================================
// POST Handler
// ============================================================

/**
 * POST /api/admin/upload-data
 *
 * Accepts multipart form data containing a CSV, Excel, or JSON file
 * for interim data ingestion. Validates the file format, schema, and
 * individual rows before inserting into the appropriate Supabase table.
 *
 * The upload is recorded in the upload_logs table and the audit trail
 * for compliance.
 *
 * Requires: upload:data permission (admin, are_lead, sre_engineer, platform_engineer)
 *
 * Form Data Fields:
 * - file (File, required): The data file to upload (CSV, Excel, or JSON)
 * - data_type (string, required): The type of data in the file
 *   Must be one of: incident, metric, service_map, deployment, error_budget
 *
 * Response (success):
 * ```json
 * {
 *   "data": {
 *     "status": "success",
 *     "records_ingested": 42,
 *     "records_failed": 0,
 *     "errors": [],
 *     "file_name": "metrics-2024-06.csv",
 *     "data_type": "metric",
 *     "upload_log_id": "upload-..."
 *   },
 *   "status": "success",
 *   "correlation_id": "req-...",
 *   "timestamp": "ISO8601"
 * }
 * ```
 *
 * Response (partial):
 * ```json
 * {
 *   "data": {
 *     "status": "partial",
 *     "records_ingested": 38,
 *     "records_failed": 4,
 *     "errors": ["Row 5, value: Must be a number.", ...],
 *     "file_name": "metrics-2024-06.csv",
 *     "data_type": "metric",
 *     "upload_log_id": "upload-..."
 *   },
 *   "status": "success",
 *   "correlation_id": "req-...",
 *   "timestamp": "ISO8601"
 * }
 * ```
 *
 * Response (error):
 * ```json
 * {
 *   "status": "error",
 *   "message": "...",
 *   "correlation_id": "req-...",
 *   "timestamp": "ISO8601"
 * }
 * ```
 */
export const POST = withRBAC(
  async (req: NextRequest, context: RBACContext): Promise<NextResponse> => {
    const correlationId = generateCorrelationId("upload");
    const timestamp = new Date().toISOString();

    try {
      // Parse multipart form data
      let formData: FormData;
      try {
        formData = await req.formData();
      } catch {
        return NextResponse.json(
          {
            status: "error",
            message:
              "Invalid request. Expected multipart form data with a file and data_type field.",
            correlation_id: correlationId,
            timestamp,
          },
          { status: 400 }
        );
      }

      // Extract the file
      const file = formData.get("file");
      if (!file || !(file instanceof File)) {
        return NextResponse.json(
          {
            status: "error",
            message:
              'Missing required field: "file". Please provide a CSV, Excel, or JSON file.',
            correlation_id: correlationId,
            timestamp,
          },
          { status: 400 }
        );
      }

      // Extract the data type
      const dataTypeParam = formData.get("data_type");
      if (!dataTypeParam || typeof dataTypeParam !== "string") {
        return NextResponse.json(
          {
            status: "error",
            message:
              'Missing required field: "data_type". Must be one of: ' +
              VALID_DATA_TYPES.join(", ") +
              ".",
            correlation_id: correlationId,
            timestamp,
          },
          { status: 400 }
        );
      }

      const dataType = dataTypeParam.trim();

      // Validate data type
      if (!VALID_DATA_TYPES.includes(dataType as DataType)) {
        return NextResponse.json(
          {
            status: "error",
            message: `Invalid data_type: "${dataType}". Must be one of: ${VALID_DATA_TYPES.join(", ")}.`,
            correlation_id: correlationId,
            timestamp,
          },
          { status: 400 }
        );
      }

      // Validate file name extension
      const fileName = file.name || "unknown";
      const lowerFileName = fileName.toLowerCase();
      const hasValidExtension = UPLOAD.ACCEPTED_FILE_TYPES.some((ext) =>
        lowerFileName.endsWith(ext)
      );

      if (!hasValidExtension) {
        return NextResponse.json(
          {
            status: "error",
            message: `Unsupported file type: "${fileName}". Accepted types: ${UPLOAD.ACCEPTED_FILE_TYPES.join(", ")}.`,
            correlation_id: correlationId,
            timestamp,
          },
          { status: 400 }
        );
      }

      // Validate file size
      const fileSizeBytes = file.size;
      if (fileSizeBytes === 0) {
        return NextResponse.json(
          {
            status: "error",
            message: "File is empty. Please provide a file with data.",
            correlation_id: correlationId,
            timestamp,
          },
          { status: 400 }
        );
      }

      if (fileSizeBytes > MAX_FILE_SIZE_BYTES) {
        const maxSizeMB = Math.round(MAX_FILE_SIZE_BYTES / (1024 * 1024));
        return NextResponse.json(
          {
            status: "error",
            message: `File size (${Math.round(fileSizeBytes / 1024)} KB) exceeds the maximum allowed size of ${maxSizeMB} MB.`,
            correlation_id: correlationId,
            timestamp,
          },
          { status: 400 }
        );
      }

      // Read the file into a buffer
      let fileBuffer: Buffer;
      try {
        const arrayBuffer = await file.arrayBuffer();
        fileBuffer = Buffer.from(arrayBuffer);
      } catch {
        return NextResponse.json(
          {
            status: "error",
            message: "Failed to read the uploaded file. Please try again.",
            correlation_id: correlationId,
            timestamp,
          },
          { status: 400 }
        );
      }

      // Ingest the file via the ingestion service
      const result = await ingestInterimUpload({
        file: fileBuffer,
        file_name: fileName,
        file_size_bytes: fileSizeBytes,
        data_type: dataType as DataType,
        uploader_id: context.userId,
        uploader_name: context.userName,
      });

      // Determine the HTTP status code based on the ingestion result
      const httpStatus =
        result.status === "failed" ? 422 : result.status === "partial" ? 207 : 201;

      return NextResponse.json(
        {
          data: {
            status: result.status,
            records_ingested: result.records_ingested,
            records_failed: result.records_failed,
            errors: result.errors,
            file_name: result.file_name,
            data_type: result.data_type,
            upload_log_id: result.upload_log_id,
          },
          status: result.status === "failed" ? "error" : "success",
          message:
            result.status === "success"
              ? `${result.records_ingested} records ingested successfully.`
              : result.status === "partial"
                ? `${result.records_ingested} records ingested, ${result.records_failed} failed.`
                : `Upload failed. ${result.errors.length > 0 ? result.errors[0] : "No records were ingested."}`,
          correlation_id: correlationId,
          timestamp,
        },
        { status: httpStatus }
      );
    } catch (error) {
      console.error("Error in POST /api/admin/upload-data:", error);

      const errorMessage =
        error instanceof Error
          ? error.message
          : "An unexpected error occurred while processing the upload.";

      return NextResponse.json(
        {
          status: "error",
          message: errorMessage,
          correlation_id: correlationId,
          timestamp,
        },
        { status: 500 }
      );
    }
  },
  { requiredPermission: "upload:data" }
);

// ============================================================
// GET Handler
// ============================================================

/**
 * GET /api/admin/upload-data
 *
 * Returns the upload history for the current user or all users (admin only).
 * Supports filtering by user_id and limiting the number of results.
 *
 * Query Parameters:
 * - user_id (string, optional): Filter by uploader user ID
 * - limit (number, optional): Maximum number of records to return (default: 50)
 * - upload_id (string, optional): Fetch a specific upload log by ID
 *
 * Requires: upload:data permission (admin, are_lead, sre_engineer, platform_engineer)
 *
 * Response:
 * ```json
 * {
 *   "data": [
 *     {
 *       "id": "...",
 *       "file_name": "metrics-2024-06.csv",
 *       "data_type": "metric",
 *       "uploader": "user-123",
 *       "uploader_name": "John Doe",
 *       "records_ingested": 42,
 *       "records_failed": 0,
 *       "errors": null,
 *       "status": "success",
 *       "file_size_bytes": 12345,
 *       "timestamp": "ISO8601"
 *     }
 *   ],
 *   "status": "success",
 *   "correlation_id": "req-...",
 *   "timestamp": "ISO8601"
 * }
 * ```
 */
export const GET = withRBAC(
  async (req: NextRequest, context: RBACContext): Promise<NextResponse> => {
    const correlationId = generateCorrelationId("upload");
    const timestamp = new Date().toISOString();

    try {
      const { searchParams } = new URL(req.url);

      // Check if a specific upload log is requested
      const uploadId = searchParams.get("upload_id");
      if (uploadId && uploadId.trim().length > 0) {
        try {
          const uploadLog = await getUploadLogById(uploadId.trim());

          if (!uploadLog) {
            return NextResponse.json(
              {
                status: "error",
                message: `Upload log not found: ${uploadId.trim()}.`,
                correlation_id: correlationId,
                timestamp,
              },
              { status: 404 }
            );
          }

          return NextResponse.json(
            {
              data: uploadLog,
              status: "success",
              correlation_id: correlationId,
              timestamp,
            },
            { status: 200 }
          );
        } catch (error) {
          console.error("Error fetching upload log by ID:", error);

          const errorMessage =
            error instanceof Error
              ? error.message
              : "An unexpected error occurred while fetching the upload log.";

          return NextResponse.json(
            {
              status: "error",
              message: errorMessage,
              correlation_id: correlationId,
              timestamp,
            },
            { status: 500 }
          );
        }
      }

      // Extract optional filter parameters
      const userIdParam = searchParams.get("user_id");
      const limitParam = searchParams.get("limit");

      let userId: string | undefined;
      if (userIdParam && userIdParam.trim().length > 0) {
        userId = userIdParam.trim();
      }

      let limit = 50;
      if (limitParam) {
        const parsedLimit = Number(limitParam);
        if (!isNaN(parsedLimit) && Number.isFinite(parsedLimit) && parsedLimit >= 1) {
          limit = Math.min(Math.floor(parsedLimit), 100);
        }
      }

      // Fetch upload history
      const history = await getUploadHistory(userId, limit);

      return NextResponse.json(
        {
          data: history,
          status: "success",
          correlation_id: correlationId,
          timestamp,
        },
        { status: 200 }
      );
    } catch (error) {
      console.error("Error in GET /api/admin/upload-data:", error);

      const errorMessage =
        error instanceof Error
          ? error.message
          : "An unexpected error occurred while fetching upload history.";

      return NextResponse.json(
        {
          status: "error",
          message: errorMessage,
          correlation_id: correlationId,
          timestamp,
        },
        { status: 500 }
      );
    }
  },
  { requiredPermission: "upload:data" }
);