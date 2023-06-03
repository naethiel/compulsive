import * as flags from "https://deno.land/std@0.189.0/flags/mod.ts";
import * as denomailer from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import Logger from "https://deno.land/x/logger@v1.1.2/logger.ts";

type App = {
  version: string;
  snapshot: string;
  config: Config;
  logger: Logger;
  mailer: denomailer.SMTPClient;
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
  const app = await bootstrap();
  app.logger.info("starting app");

  app.snapshot = await fetchUrl(app.config.url);

  let isRunning = false;

  setInterval(async () => {
    app.logger.info("checking url...");
    if (isRunning) {
      app.logger.warn("already running, skipping");
      return;
    }

    isRunning = true;

    try {
      const check = await fetchUrl(app.config.url);
      if (check === app.snapshot) {
        app.logger.info("no change detected, skipping");
        isRunning = false;
        return;
      }

      app.logger.warn("change detected in page");

      app.logger.warn("sending email notification", {
        recipients: app.config.email.to,
      });

      await app.mailer.send({
        to: app.config.email.to.map((to) => ({
          mail: to.address,
          name: to.name,
        })),
        from: `${app.config.email.from.name} <${app.config.email.from.address}>`,
        subject: app.config.email.subject,
        content: `${app.config.email.body} - site: ${app.config.url}`,
      });

      app.logger.info("mail sent");
      app.logger.info("updating snapshot");
      app.snapshot = check;
    } catch (err) {
      app.logger.error("failed to check url", "error", err);
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

async function bootstrap(): Promise<App> {
  const args = flags.parse(Deno.args, {
    string: ["configuration"],
  });
  if (!args.configuration) {
    args.configuration = "compulsive.json";
  }

  const logger = new Logger();
  logger.info("initiated logger");
  await logger.initFileLogger("./log", {
    rotate: true,
  });

  logger.info("initated log files");

  let config: Config;
  try {
    const file = Deno.readTextFileSync(args.configuration);
    logger.info("loading config file", { file });
    config = JSON.parse(file);
  } catch (err) {
    logger.error("Couldn't load config file", err);
    Deno.exit(1);
  }

  // frequency minimum value is 5s.
  if (config.frequency < 5) {
    config.frequency = 5;
  }

  const client = new denomailer.SMTPClient({
    connection: config.email.server,
  });

  Deno.addSignalListener("SIGINT", () => {
    logger.warn("SIGINT recieved. Exiting!");
    Deno.exit(0);
  });
  Deno.addSignalListener("SIGTERM", () => {
    logger.warn("SIGTERM recieved. Exiting!");
    Deno.exit(0);
  });

  const app: App = {
    config: config,
    snapshot: "",
    version: "v1.1.0",
    logger: logger,
    mailer: client,
  };

  return app;
}
