import * as http from "https://deno.land/std@0.189.0/http/server.ts";

// basic test http server just to check that `compulsive` behaves correctly
function handler(_req: Request): Response {
  return new Response(
    `
    <html>
        <body>
            <h1>Hello world !</h1>
        </body>
    </html>
  `,
    {
      status: 200,
      headers: {
        "content-type": "text/html",
      },
    }
  );
}

http.serve(handler, { port: 3000 });
