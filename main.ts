import * as flags from "https://deno.land/std@0.189.0/flags/mod.ts";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

type App = {
  version: string;
  snapshot: string;
  config: Config;
};

type Config = {
  url: string;
  frequency: number;
  email: {
    server: {
      hostname: string;
      port: number;
      auth?: {
        username: string;
        password: string;
      };
      tls: boolean;
    };
    from: {
      name: string;
      address: string;
    };
    to: Array<{
      name: string;
      address: string;
    }>;
    subject: string;
    body: string;
  };
};

if (import.meta.main) {
  console.log("initializing Compulsive");

  const app = bootstrap();

  const client = new SMTPClient({ connection: app.config.email.server });

  app.snapshot = await fetchUrl(app.config.url);
  let isRunning = false;

  setInterval(async () => {
    console.log("checking url...");
    if (isRunning) {
      console.log("already running, skipping");
      return;
    }

    isRunning = true;

    try {
      const check = await fetchUrl(app.config.url);
      if (check === app.snapshot) {
        console.log("no change detected.");
        isRunning = false;
        return;
      }

      console.log("change detected. Sending email notification");

      client.send({
        to: app.config.email.to.map((to) => ({
          mail: to.address,
          name: to.name,
        })),
        from: `${app.config.email.from.name} <${app.config.email.from.address}>`,
        subject: app.config.email.subject,
        content: `${app.config.email.body} - site: ${app.config.url}`,
      });

      console.log("updating snapshot");
      app.snapshot = check;
    } catch (err) {
      console.log("failed to check url", "error", err);
    }

    isRunning = false;
  }, app.config.frequency * 1000);
}

async function fetchUrl(url: string): Promise<string> {
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error("failed to fetch url", { cause: res.status });
  }

  return res.text();
}

function bootstrap(): App {
  const args = flags.parse(Deno.args, {
    string: ["configuration"],
  });
  if (!args.configuration) {
    args.configuration = "compulsive.json";
  }

  let config: Config;
  try {
    const file = Deno.readTextFileSync(args.configuration);
    console.log("loaded config", file);
    config = JSON.parse(file);
  } catch (err) {
    console.error("Couldn't load config file", "error", err);
    Deno.exit(1);
  }

  const app: App = {
    config: config,
    snapshot: "",
    version: "v1.0.0",
  };

  return app;
}
