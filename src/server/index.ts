import { ServerBuilder } from './base-server.ts';
export { Route, route, Router } from "./route-builder.ts";

export * from "./middleware.ts";

export type {
    ServerConfig,
    RouteParams,
    ParamConfig,
    RouteBuilder
} from "./types.ts";

export function createServer(config?: Partial<import("./types.ts").ServerConfig>): ServerBuilder {
    return new ServerBuilder(config);
}