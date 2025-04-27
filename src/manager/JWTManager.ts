import { create, type Header, verify, type Payload } from '../../vendor/deno.land/x/djwt@v3.0.2/mod.ts';
import { buildResponse, type GenericResponse } from '../utils/http.ts';

interface IGenerateKeyConfig {
    format: Exclude<KeyFormat, "jwk">;
    keyData: BufferSource;
    algorithm: AlgorithmIdentifier | HmacImportParams | RsaHashedImportParams | EcKeyImportParams;
    extractable: boolean;
    keyUsages: KeyUsage[];
}

export class JWTManager {
    private static signature: string | null = null;
    private static textEncoder = new TextEncoder();

    private constructor() { }

    public static init(signature: string): void {
        JWTManager.signature = signature;
    }

    public static async verify<T extends Payload>(token: string, keyGenerationConfig: IGenerateKeyConfig): Promise<GenericResponse<T>> {
        if (!JWTManager.signature) {
            return buildResponse({
                success: false,
                error: new Error('Missing JWT Manager signature. Call init() first')
            });
        }

        try {
            const generateKeyResult = await JWTManager.generateKey(keyGenerationConfig);

            if (!generateKeyResult.success)
                return generateKeyResult;

            const decodedToken = await verify<T>(token.replaceAll('Bearer ', ''), generateKeyResult.data);

            return buildResponse({ success: true, data: decodedToken });
        } catch (error) {
            return buildResponse({ success: false, error });
        }
    }

    public static async generate<T extends Payload>(configHeader: Header, payload: T, keyGenerationConfig: IGenerateKeyConfig): Promise<GenericResponse<string>> {
        if (!JWTManager.signature) {
            return buildResponse({
                success: false,
                error: new Error('Missing JWT Manager signature. Call init() first')
            });
        }

        try {
            const generateKeyResult = await JWTManager.generateKey(keyGenerationConfig);

            if (!generateKeyResult.success)
                return generateKeyResult;

            const jwt = await create(configHeader, payload, generateKeyResult.data)

            return buildResponse({ success: true, data: jwt });
        } catch (error) {
            return buildResponse({ success: false, error });
        }
    }

    private static async generateKey(config: IGenerateKeyConfig): Promise<GenericResponse<CryptoKey>> {
        if (!JWTManager.signature) {
            return buildResponse({
                success: false,
                error: new Error('Missing JWT Manager signature. Call init() first')
            });
        }

        try {
            const keyData = JWTManager.textEncoder.encode(JWTManager.signature);

            const key = await crypto.subtle.importKey(
                config.format ?? "raw",
                keyData,
                config.algorithm ?? { name: "HMAC", hash: "SHA-256" },
                config.extractable ?? false,
                config.keyUsages ?? ["sign", "verify"]
            );

            return buildResponse({ success: true, data: key });
        } catch (error) {
            return buildResponse({ success: false, error });
        }
    }
}