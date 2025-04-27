import { createServer, Router } from './src/index.ts';

const server = createServer();

const routes = [
    Router.post('/test1')
        .describe('test 1')
        .queryParam("testValue")
        .handler((context) => {
            const { body, headers, params, query } = context;
            console.log({ body, headers, params, query });
            return context.c.json({ message: 'test 1 passed' }, 200);
        }),

    Router.post('/test2')
        .describe('test 2')
        .handler((context) => {
            const { body, headers, params, query } = context;
            console.log({ body, headers, params, query });
            return context.c.json({ message: 'test 2 passed' }, 200);
        }),

    Router.get('/test3/:id')
        .describe('test 3 ')
        .handler((context) => {
            const { body, headers, params, query } = context;
            console.log(body, headers, params, query);
            return context.c.json({ message: `test 3 passed with id ${context.params.id}` }, 200);
        }),
];

export function init() {
    server.group('/v1/test', (app) => {
        routes.forEach(route => {
            route.register(app);
        });
    });

    server.start();
}