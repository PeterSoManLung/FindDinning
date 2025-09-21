"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorCode = exports.HttpStatusCode = void 0;
// Standard HTTP status codes used across services
var HttpStatusCode;
(function (HttpStatusCode) {
    HttpStatusCode[HttpStatusCode["OK"] = 200] = "OK";
    HttpStatusCode[HttpStatusCode["CREATED"] = 201] = "CREATED";
    HttpStatusCode[HttpStatusCode["NO_CONTENT"] = 204] = "NO_CONTENT";
    HttpStatusCode[HttpStatusCode["BAD_REQUEST"] = 400] = "BAD_REQUEST";
    HttpStatusCode[HttpStatusCode["UNAUTHORIZED"] = 401] = "UNAUTHORIZED";
    HttpStatusCode[HttpStatusCode["FORBIDDEN"] = 403] = "FORBIDDEN";
    HttpStatusCode[HttpStatusCode["NOT_FOUND"] = 404] = "NOT_FOUND";
    HttpStatusCode[HttpStatusCode["CONFLICT"] = 409] = "CONFLICT";
    HttpStatusCode[HttpStatusCode["UNPROCESSABLE_ENTITY"] = 422] = "UNPROCESSABLE_ENTITY";
    HttpStatusCode[HttpStatusCode["INTERNAL_SERVER_ERROR"] = 500] = "INTERNAL_SERVER_ERROR";
    HttpStatusCode[HttpStatusCode["SERVICE_UNAVAILABLE"] = 503] = "SERVICE_UNAVAILABLE";
})(HttpStatusCode || (exports.HttpStatusCode = HttpStatusCode = {}));
// Standard error codes used across services
var ErrorCode;
(function (ErrorCode) {
    // Authentication & Authorization
    ErrorCode["INVALID_CREDENTIALS"] = "INVALID_CREDENTIALS";
    ErrorCode["TOKEN_EXPIRED"] = "TOKEN_EXPIRED";
    ErrorCode["INSUFFICIENT_PERMISSIONS"] = "INSUFFICIENT_PERMISSIONS";
    // Validation
    ErrorCode["VALIDATION_ERROR"] = "VALIDATION_ERROR";
    ErrorCode["MISSING_REQUIRED_FIELD"] = "MISSING_REQUIRED_FIELD";
    ErrorCode["INVALID_FORMAT"] = "INVALID_FORMAT";
    // Business Logic
    ErrorCode["USER_NOT_FOUND"] = "USER_NOT_FOUND";
    ErrorCode["RESTAURANT_NOT_FOUND"] = "RESTAURANT_NOT_FOUND";
    ErrorCode["REVIEW_NOT_FOUND"] = "REVIEW_NOT_FOUND";
    ErrorCode["RECOMMENDATION_NOT_FOUND"] = "RECOMMENDATION_NOT_FOUND";
    ErrorCode["INSUFFICIENT_USER_DATA"] = "INSUFFICIENT_USER_DATA";
    ErrorCode["RESTAURANT_NOT_AVAILABLE"] = "RESTAURANT_NOT_AVAILABLE";
    ErrorCode["CONFLICTING_PREFERENCES"] = "CONFLICTING_PREFERENCES";
    // System Errors
    ErrorCode["DATABASE_ERROR"] = "DATABASE_ERROR";
    ErrorCode["EXTERNAL_SERVICE_ERROR"] = "EXTERNAL_SERVICE_ERROR";
    ErrorCode["ML_MODEL_UNAVAILABLE"] = "ML_MODEL_UNAVAILABLE";
    ErrorCode["CACHE_ERROR"] = "CACHE_ERROR";
    // Rate Limiting
    ErrorCode["RATE_LIMIT_EXCEEDED"] = "RATE_LIMIT_EXCEEDED";
    // Data Integration
    ErrorCode["DATA_SYNC_ERROR"] = "DATA_SYNC_ERROR";
    ErrorCode["DATA_QUALITY_ERROR"] = "DATA_QUALITY_ERROR";
    ErrorCode["PLATFORM_UNAVAILABLE"] = "PLATFORM_UNAVAILABLE";
})(ErrorCode || (exports.ErrorCode = ErrorCode = {}));
//# sourceMappingURL=api.types.js.map