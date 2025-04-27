import { create, verify, type Payload } from "https://deno.land/x/djwt@v3.0.2/mod.ts";
import { buildResponse, type GenericResponse } from '../utils/http.ts';

interface IDecodedToken extends Payload {
    userId: number;
}

export class JWTManager {
    private static signature: string | null = null;
    private static textEncoder = new TextEncoder();

    // No permitir instanciación
    private constructor() { }

    public static init(signature: string): void {
        JWTManager.signature = signature;
    }

    public static async verify(token: string): Promise<GenericResponse<IDecodedToken>> {
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

            const decodedToken = await verify<IDecodedToken>(token.replaceAll('Bearer ', ''), generateKeyResult.data);

            return buildResponse({ success: true, data: decodedToken });
        } catch (error) {
            return buildResponse({ success: false, error });
        }
    }

    public static async generate(userId: number, customClaims: Record<string, unknown> = {}): Promise<GenericResponse<string>> {
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

            const jwt = await create({
                alg: "HS256"
            }, {
                iss: 'testProject',
                sub: String(userId),
                exp: JWTManager.getExpirationTime(),
                ...customClaims
            }, generateKeyResult.data)

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

    private static getExpirationTime() {
        const expiresInSeconds = 3600;

        return Math.floor(Date.now() / 1000) + expiresInSeconds;
    }
}