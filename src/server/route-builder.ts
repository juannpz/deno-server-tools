// src/server/route-builder.ts

import type { ContentfulStatusCode, Hono } from "../../deps.ts";
import type { Context } from "../../deps.ts";
import { isErrorWithStatus } from '../utils/http.ts';
import type { ParamConfig, RouteBuilder, MiddlewareFunction } from "./types.ts";

export class Route<
    P extends Record<string, unknown> = Record<string, string>,
    Q extends Record<string, unknown> = Record<string, unknown>,
    B extends Record<string, unknown> = Record<string, unknown>,
    H extends Record<string, unknown> = Record < string, string >
> {
            private _builder: RouteBuilder<P, Q, B, H> = {
                path: "",
                method: "GET", 
                pathParams: [],
                queryParams: [],
                headerParams: [],
                handler: () => new Response("Not implemented"),
            };
            private _middlewares: MiddlewareFunction[] = [];
            private _description = "";
            private _bodyValidator?: (body: unknown) => boolean;
            private _tags: string[] = [];

            constructor(path: string) {
                this._builder.path = path;
            }

    public method(method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH"): this {
                this._builder.method = method;
                return this;
            }

    public get(): this {
                return this.method("GET");
            }

    public post(): this {
                return this.method("POST");
            }

    public put(): this {
                return this.method("PUT");
            }

    public delete(): this {
                return this.method("DELETE");
            }

    public patch(): this {
                return this.method("PATCH");
            }

    public pathParam<K extends string, V>(
                name: K,
                options: Omit<ParamConfig<V>, "name" | "type"> = {}
            ): Route<P & Record<K, V>, Q, B, H> {
                this._builder.pathParams.push({
                    name,
                    type: "path",
                    ...options,
                });
                return this as unknown as Route<P & Record<K, V>, Q, B, H>;
            }

    public queryParam<K extends string, V>(
                name: K,
                options: Omit<ParamConfig<V>, "name" | "type"> = {}
            ): Route<P, Q & Record<K, V>, B, H> {
                this._builder.queryParams.push({
                    name,
                    type: "query",
                    ...options,
                });
                return this as unknown as Route<P, Q & Record<K, V>, B, H>;
            }

    public body<T extends Record<string, unknown>>(): Route<P, Q, T, H> {
                return this as unknown as Route<P, Q, T, H>;
            }

    public headerParam<K extends string, V>(
                name: K,
                options: Omit<ParamConfig<V>, "name" | "type"> = {}
            ): Route<P, Q, B, H & Record<K, V>> {
                this._builder.headerParams.push({
                    name,
                    type: "header",
                    ...options,
                });
                return this as unknown as Route<P, Q, B, H & Record<K, V>>;
            }

    public describe(description: string): this {
                this._description = description;
                return this;
            }

    public tag(...tags: string[]): this {
                this._tags.push(...tags);
                return this;
            }

    public useMiddleware(middlewareFn: MiddlewareFunction): this {
                this._middlewares.push(middlewareFn);
                return this;
            }

    public validateBody(validator: (body: unknown) => boolean): this {
                this._bodyValidator = validator;
                return this;
            }

    public cache(maxAge: number): this {
                return this.useMiddleware(async (c, next) => {
                    await next();
                    c.header('Cache-Control', `max-age=${maxAge}`);
                });
            }

    public rateLimit(options: { limit: number, window: number }): this {
                return this.useMiddleware(async (_c, next) => {
                    console.log(`Rate limiting: ${options.limit} requests per ${options.window}s`);
                    await next();
                });
            }

    public authenticate(strategy: string = 'default'): this {
                return this.useMiddleware(async (c, next) => {
                    const authHeader = c.req.header('Authorization');
                    if (!authHeader) {
                        return c.json({ error: 'Authentication required' }, 401 as ContentfulStatusCode);
                    }
                    console.log(`Using auth strategy: ${strategy}`);
                    await next();
                });
            }

    public handler(
        fn: (context: {
            c: Context;
            params: P;
            query: Q;
            body: B;
            headers: H;
        }) => Response | Promise<Response>
    ): this {
        this._builder.handler = fn as (context: { c: Context; params: P; query: Q; body: B; headers: H; }) => Response | Promise<Response>;
        return this;
    }

    public register(app: Hono): void {
                const routeHandler = async (c: Context) => {
                    const params = {} as P;
                    for (const param of this._builder.pathParams) {
                        const value = c.req.param(param.name);
                        if (param.validator && !param.validator(value)) {
                            return c.json({ error: `Invalid path parameter: ${param.name}` }, 400 as ContentfulStatusCode);
                        }
                        const transformedValue = param.transform ? param.transform(value) : value;
                        Object.assign(params, { [param.name]: transformedValue });
                    }

                    const query = {} as Q;
                    const url = new URL(c.req.url);
                    for (const param of this._builder.queryParams) {
                        const value = url.searchParams.get(param.name);

                        if (param.required && (value === null || value === "")) {
                            return c.json({ error: `Missing required query parameter: ${param.name}` }, 400 as ContentfulStatusCode);
                        }

                        if (value !== null && param.validator && !param.validator(value)) {
                            return c.json({ error: `Invalid query parameter: ${param.name}` }, 400 as ContentfulStatusCode);
                        }

                        const transformedValue = value !== null && param.transform
                            ? param.transform(value)
                            : (value !== null ? value : param.defaultValue);

                        Object.assign(query, { [param.name]: transformedValue });
                    }

                    let body = {} as B;
                    try {
                        const contentLength = c.req.header('content-length');
                        const contentType = c.req.header('content-type');

                        if (contentLength && contentLength !== '0' && contentType?.includes('application/json')) {
                            body = await c.req.json();
                            if (this._bodyValidator && !this._bodyValidator(body)) {
                                return c.json({ error: "Invalid request body format" }, 400 as ContentfulStatusCode);
                            }
                        }
                    } catch (_e) {
                        console.log(_e);
                        
                        return c.json({ error: "Invalid JSON body" }, 400 as ContentfulStatusCode);
                    }

                    const headers = {} as H;
                    for (const param of this._builder.headerParams) {
                        const value = c.req.header(param.name);

                        if (param.required && !value) {
                            return c.json({ error: `Missing required header: ${param.name}` }, 400 as ContentfulStatusCode);
                        }

                        if (value && param.validator && !param.validator(value)) {
                            return c.json({ error: `Invalid header: ${param.name}` }, 400 as ContentfulStatusCode);
                        }

                        const transformedValue = value && param.transform
                            ? param.transform(value)
                            : (value || param.defaultValue);

                        Object.assign(headers, { [param.name]: transformedValue });
                    }

                    try {
                        return await this._builder.handler({
                            c,
                            params,
                            query,
                            body,
                            headers,
                        });
                    } catch (error) {
                        console.error("Route handler error:", error);
                        return c.json(
                            { error: error instanceof Error ? error.message : "Internal server error" },
                            (isErrorWithStatus(error) ? error.status : 500) as ContentfulStatusCode
                        );
                    }
                };

                const registerRoute = (method: string) => {
                    const handlers = [...this._middlewares, routeHandler] as const;

                    switch (method) {
                        case "GET":
                            app.get(this._builder.path, ...handlers);
                            break;
                        case "POST":
                            app.post(this._builder.path, ...handlers);
                            break;
                        case "PUT":
                            app.put(this._builder.path, ...handlers);
                            break;
                        case "DELETE":
                            app.delete(this._builder.path, ...handlers);
                            break;
                        case "PATCH":
                            app.patch(this._builder.path, ...handlers);
                            break;
                    }
                };

                registerRoute(this._builder.method);
            }

            public get description(): string {
                return this._description;
            }
}

export function route(path: string): Route {
    return new Route(path);
}

export const Router = {
    get: (path: string): Route => new Route(path).get(),
    post: (path: string): Route => new Route(path).post(),
    put: (path: string): Route => new Route(path).put(),
    patch: (path: string): Route => new Route(path).patch(),
    delete: (path: string): Route => new Route(path).delete(),
};