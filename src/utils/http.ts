export type GenericResponse<T> = SuccessResponse<T> | FailureResponse;

export function buildResponse<T>(response: GenericResponse<T>): GenericResponse<T> {
    if (!response.success) {
        const { error, message, code } = response;
        const defaultErrorCode = 500;

        if (message)
            return {
                ...response,
                message,
                code: code ?? defaultErrorCode
            };

        if (isFetchError(error)) {
            const fetchMessage = extractFetchErrorMessage(error);
            const fetchCode = extractHttpErrorCode(error) ?? defaultErrorCode;
            return {
                ...response,
                message: fetchMessage ?? "An unknown network error occurred",
                code: fetchCode,
            };
        }

        if (error instanceof Error) {
            const httpCode = extractHttpErrorCode(error);
            return {
                ...response,
                message: error.message ?? "An unknown error occurred",
                code: httpCode ?? defaultErrorCode,
            };
        }

        return {
            ...response,
            message: "An error occurred, but no additional details are available",
            code: defaultErrorCode,
        };
    }

    return response;
}

export async function safeParseJson<T>(response: Response): Promise<T | null> {
    try {
        return await response.json() as T;
    } catch (_e) {
        return null;
    }
}

export async function createResponseFromFetch<T>(fetchPromise: Promise<Response>): Promise<GenericResponse<T>> {
    try {
        const response = await fetchPromise;

        if (!response.ok) {
            const errorData = await safeParseJson<ErrorResponseData>(response);
            return {
                success: false,
                error: response,
                message: errorData?.message || response.statusText,
                code: response.status
            };
        }

        const data = await safeParseJson<T>(response);
        if (data === null) {
            return {
                success: false,
                error: new Error("Failed to parse response body"),
                message: "Could not parse response as JSON",
                code: 500
            };
        }
        return {
            success: true,
            data
        };
    } catch (error) {
        return {
            success: false,
            error,
            message: error instanceof Error ? error.message : String(error)
        };
    }
}

interface ErrorWithStatus extends Error {
    status: number;
}

export function isErrorWithStatus(error: unknown): error is ErrorWithStatus {
    return error instanceof Error && 'status' in error;
}

type SuccessResponse<T> = {
    success: true;
    data: T;
};

type FailureResponse = {
    success: false;
    error?: unknown;
    message?: string;
    code?: number;
};

function isFetchError(error: unknown): error is TypeError {
    return error instanceof TypeError ||
        (error instanceof Error && error.name === 'AbortError') ||
        (error instanceof DOMException && error.name === 'AbortError');
}

function isResponseError(error: unknown): error is { response: Response } {
    return hasResponseProperty(error) &&
        error.response instanceof Response;
}

function extractFetchErrorMessage(error: unknown): string | undefined {
    if (error instanceof TypeError) {
        return error.message; // Network errors like CORS, connection refused
    }

    if (error instanceof Error && error.name === 'AbortError') {
        return "Request was aborted";
    }

    if (isResponseError(error)) {
        const response = error.response;
        try {
            // Verificar la estructura usando guardas de tipo
            if (hasMessageInBodyInit(response) &&
                response._bodyInit &&
                'message' in response._bodyInit) {
                return response._bodyInit.message;
            }
        } catch {
            // Si no puede analizar el cuerpo de la respuesta, use el texto de estado
            return `${response.status} ${response.statusText}`;
        }
    }

    return undefined;
}

function extractHttpErrorCode(error: unknown): number | undefined {
    if (isResponseError(error)) {
        return error.response.status;
    }

    if (error instanceof Error && hasStatusProperty(error)) {
        const { status } = error;
        if (typeof status === "number") {
            return status;
        }
    }

    return undefined;
}

function hasResponseProperty(obj: unknown): obj is ErrorWithResponse {
    return typeof obj === "object" &&
        obj !== null &&
        "response" in obj;
}

function hasMessageInBodyInit(response: Response): response is ResponseWithBodyInit {
    return '_bodyInit' in response &&
        typeof (response as ResponseWithBodyInit)._bodyInit === 'object' &&
        (response as ResponseWithBodyInit)._bodyInit !== null;
}

function hasStatusProperty(error: Error): error is ErrorWithStatusProperty {
    return "status" in error;
}

// Helper types
interface ErrorResponseData {
    message?: string;
    error?: string;
}

interface ErrorWithResponse {
    response: unknown;
}

interface ResponseWithBodyInit extends Response {
    _bodyInit?: {
        message?: string;
        [key: string]: unknown;
    };
}

interface ErrorWithStatusProperty extends Error {
    status: unknown;
}