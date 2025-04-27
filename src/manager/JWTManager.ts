import { create, type Header, verify, type Payload } from "https://deno.land/x/djwt@v3.0.2/mod.ts";
import { buildResponse, type GenericResponse } from '../utils/http.ts';

export class JWTManager {
    private static signature: string | null = null;
    private static textEncoder = new TextEncoder();

    private constructor() { }

    public static init(signature: string): void {
        JWTManager.signature = signature;
    }

    public static async verify<T extends Payload>(token: string): Promise<GenericResponse<T>> {
        if (!JWTManager.signature) {
            return buildResponse({
                success: false,
                error: new Error('Missing JWT Manager signature. Call init() first')
            });
        }

        try {
            const generateKeyResult = await JWTManager.generateKey();

            if (!generateKeyResult.success)
                return generateKeyResult;

            const decodedToken = await verify<T>(token.replaceAll('Bearer ', ''), generateKeyResult.data);

            return buildResponse({ success: true, data: decodedToken });
        } catch (error) {
            return buildResponse({ success: false, error });
        }
    }

    public static async generate<T extends Payload>(configHeader: Header, payload: T): Promise<GenericResponse<string>> {
        if (!JWTManager.signature) {
            return buildResponse({
                success: false,
                error: new Error('Missing JWT Manager signature. Call init() first')
            });
        }

        try {
            const generateKeyResult = await JWTManager.generateKey();

            if (!generateKeyResult.success)
                return generateKeyResult;

            const jwt = await create(configHeader, payload, generateKeyResult.data)

            return buildResponse({ success: true, data: jwt });
        } catch (error) {
            return buildResponse({ success: false, error });
        }
    }

    private static async generateKey(): Promise<GenericResponse<CryptoKey>> {
        try {
            const keyData = JWTManager.textEncoder.encode(JWTManager.signature!);

            const key = await crypto.subtle.importKey(
                "raw",
                keyData,
                { name: "HMAC", hash: "SHA-256" },
                false,
                ["sign", "verify"]
            );

            return buildResponse({ success: true, data: key });
        } catch (error) {
            return buildResponse({ success: false, error });
        }
    }
}