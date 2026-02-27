export function validateRenameOptions(oldName, newName) {
    const errors = [];
    // Validate oldName
    if (!oldName || oldName.trim().length === 0) {
        errors.push({
            field: "oldName",
            message: "Old name is required and cannot be empty",
        });
    }
    if (oldName && oldName.length > 255) {
        errors.push({
            field: "oldName",
            message: "Old name cannot exceed 255 characters",
            value: oldName,
        });
    }
    // Validate newName
    if (!newName || newName.trim().length === 0) {
        errors.push({
            field: "newName",
            message: "New name is required and cannot be empty",
        });
    }
    if (newName && newName.length > 255) {
        errors.push({
            field: "newName",
            message: "New name cannot exceed 255 characters",
            value: newName,
        });
    }
    // Check if names are the same
    if (oldName && newName && oldName.trim() === newName.trim()) {
        errors.push({
            field: "newName",
            message: "New name must be different from old name",
        });
    }
    // Validate characters (basic check)
    const invalidChars = /[<>:"/\\|?*\x00-\x1f]/;
    if (oldName && invalidChars.test(oldName)) {
        errors.push({
            field: "oldName",
            message: "Old name contains invalid characters",
            value: oldName,
        });
    }
    if (newName && invalidChars.test(newName)) {
        errors.push({
            field: "newName",
            message: "New name contains invalid characters",
            value: newName,
        });
    }
    return {
        isValid: errors.length === 0,
        errors,
    };
}
export function validateMultiMap(multiMap) {
    const errors = [];
    if (!multiMap || typeof multiMap !== "object") {
        errors.push({
            field: "multiMap",
            message: "Multi-map must be a valid object",
        });
        return { isValid: false, errors };
    }
    for (const [oldName, newName] of Object.entries(multiMap)) {
        const validation = validateRenameOptions(oldName, newName);
        if (!validation.isValid) {
            errors.push(...validation.errors.map((err) => ({
                ...err,
                field: `multiMap.${err.field}`,
                value: `${oldName} -> ${newName}`,
            })));
        }
    }
    return {
        isValid: errors.length === 0,
        errors,
    };
}
export function validateConfig(config) {
    const errors = [];
    // Validate boolean fields
    const booleanFields = [
        "updatePackage",
        "updateRemote",
        "caseSensitive",
        "dry",
    ];
    for (const field of booleanFields) {
        if (config[field] !== undefined && typeof config[field] !== "boolean") {
            errors.push({
                field,
                message: `${field} must be a boolean value`,
                value: config[field],
            });
        }
    }
    // Validate array fields
    const arrayFields = ["ignore", "include"];
    for (const field of arrayFields) {
        if (config[field] !== undefined && !Array.isArray(config[field])) {
            errors.push({
                field,
                message: `${field} must be an array`,
                value: config[field],
            });
        }
    }
    // Validate concurrency
    if (config.concurrency !== undefined) {
        if (typeof config.concurrency !== "number" ||
            config.concurrency < 1 ||
            config.concurrency > 100) {
            errors.push({
                field: "concurrency",
                message: "Concurrency must be a number between 1 and 100",
                value: config.concurrency,
            });
        }
    }
    return {
        isValid: errors.length === 0,
        errors,
    };
}
export function formatValidationErrors(errors) {
    if (errors.length === 0)
        return "";
    return errors
        .map((err) => {
        let message = `❌ ${err.field}: ${err.message}`;
        if (err.value !== undefined) {
            message += ` (value: ${JSON.stringify(err.value)})`;
        }
        return message;
    })
        .join("\n");
}
export class SafeRenameError extends Error {
    code;
    details;
    constructor(message, code = "SAFE_RENAME_ERROR", details) {
        super(message);
        this.name = "SafeRenameError";
        this.code = code;
        this.details = details;
    }
}
export class ValidationError extends SafeRenameError {
    validationErrors;
    constructor(validationErrors) {
        const message = formatValidationErrors(validationErrors) || "Validation failed";
        super(message, "VALIDATION_ERROR", validationErrors);
        this.name = "ValidationError";
        this.validationErrors = validationErrors;
    }
}
export class FileProcessingError extends SafeRenameError {
    constructor(filePath, originalError) {
        super(`Failed to process file: ${filePath}`, "FILE_PROCESSING_ERROR", {
            filePath,
            originalError: originalError.message,
        });
        this.name = "FileProcessingError";
    }
}
export class ConfigError extends SafeRenameError {
    constructor(configPath, originalError) {
        super(`Failed to load configuration from: ${configPath}`, "CONFIG_ERROR", {
            configPath,
            originalError: originalError.message,
        });
        this.name = "ConfigError";
    }
}
