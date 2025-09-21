"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResponseBuilder = void 0;
exports.generateRequestId = generateRequestId;
exports.getHttpStatusFromErrorCode = getHttpStatusFromErrorCode;
const api_types_1 = require("../types/api.types");
class ResponseBuilder {
    static success(data, meta) {
        return {
            success: true,
            data,
            meta: meta ? {
                requestId: generateRequestId(),
                timestamp: new Date().toISOString(),
                ...meta
            } : undefined
        };
    }
    static error(code, message, details, requestId) {
        const errorResponse = {
            code,
            message,
            details,
            timestamp: new Date().toISOString(),
            requestId: requestId || generateRequestId()
        };
        return {
            success: false,
            error: errorResponse
        };
    }
    static paginated(data, page, limit, total, requestId) {
        const hasNext = page * limit < total;
        const hasPrevious = page > 1;
        return {
            success: true,
            data,
            meta: {
                page,
                limit,
                total,
                hasNext,
                hasPrevious,
                requestId: requestId || generateRequestId(),
                timestamp: new Date().toISOString()
            }
        };
    }
}
exports.ResponseBuilder = ResponseBuilder;
function generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}
function getHttpStatusFromErrorCode(errorCode) {
    const errorCodeMap = {
        [api_types_1.ErrorCode.INVALID_CREDENTIALS]: api_types_1.HttpStatusCode.UNAUTHORIZED,
        [api_types_1.ErrorCode.TOKEN_EXPIRED]: api_types_1.HttpStatusCode.UNAUTHORIZED,
        [api_types_1.ErrorCode.INSUFFICIENT_PERMISSIONS]: api_types_1.HttpStatusCode.FORBIDDEN,
        [api_types_1.ErrorCode.VALIDATION_ERROR]: api_types_1.HttpStatusCode.BAD_REQUEST,
        [api_types_1.ErrorCode.MISSING_REQUIRED_FIELD]: api_types_1.HttpStatusCode.BAD_REQUEST,
        [api_types_1.ErrorCode.INVALID_FORMAT]: api_types_1.HttpStatusCode.BAD_REQUEST,
        [api_types_1.ErrorCode.USER_NOT_FOUND]: api_types_1.HttpStatusCode.NOT_FOUND,
        [api_types_1.ErrorCode.RESTAURANT_NOT_FOUND]: api_types_1.HttpStatusCode.NOT_FOUND,
        [api_types_1.ErrorCode.REVIEW_NOT_FOUND]: api_types_1.HttpStatusCode.NOT_FOUND,
        [api_types_1.ErrorCode.RECOMMENDATION_NOT_FOUND]: api_types_1.HttpStatusCode.NOT_FOUND,
        [api_types_1.ErrorCode.INSUFFICIENT_USER_DATA]: api_types_1.HttpStatusCode.UNPROCESSABLE_ENTITY,
        [api_types_1.ErrorCode.RESTAURANT_NOT_AVAILABLE]: api_types_1.HttpStatusCode.UNPROCESSABLE_ENTITY,
        [api_types_1.ErrorCode.CONFLICTING_PREFERENCES]: api_types_1.HttpStatusCode.UNPROCESSABLE_ENTITY,
        [api_types_1.ErrorCode.RATE_LIMIT_EXCEEDED]: api_types_1.HttpStatusCode.UNPROCESSABLE_ENTITY,
        [api_types_1.ErrorCode.DATABASE_ERROR]: api_types_1.HttpStatusCode.INTERNAL_SERVER_ERROR,
        [api_types_1.ErrorCode.EXTERNAL_SERVICE_ERROR]: api_types_1.HttpStatusCode.SERVICE_UNAVAILABLE,
        [api_types_1.ErrorCode.ML_MODEL_UNAVAILABLE]: api_types_1.HttpStatusCode.SERVICE_UNAVAILABLE,
        [api_types_1.ErrorCode.CACHE_ERROR]: api_types_1.HttpStatusCode.INTERNAL_SERVER_ERROR,
        [api_types_1.ErrorCode.DATA_SYNC_ERROR]: api_types_1.HttpStatusCode.INTERNAL_SERVER_ERROR,
        [api_types_1.ErrorCode.DATA_QUALITY_ERROR]: api_types_1.HttpStatusCode.INTERNAL_SERVER_ERROR,
        [api_types_1.ErrorCode.PLATFORM_UNAVAILABLE]: api_types_1.HttpStatusCode.SERVICE_UNAVAILABLE
    };
    return errorCodeMap[errorCode] || api_types_1.HttpStatusCode.INTERNAL_SERVER_ERROR;
}
//# sourceMappingURL=response.utils.js.map