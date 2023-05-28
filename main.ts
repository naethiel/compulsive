import * as flags from "https://deno.land/std@0.189.0/flags/mod.ts";
import { SMTPClient } from "https://deno.land/x/denomailer/mod.ts";

let snapshot = "";

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

  const client = new SMTPClient({ connection: config.email.server });

  snapshot = await fetchUrl(config.url);
  let isRunning = false;

  setInterval(async () => {
    console.log("checking url...");
    if (isRunning) {
      console.log("already running, skipping");
      return;
    }

    isRunning = true;

    try {
      const check = await fetchUrl(config.url);
      if (check === snapshot) {
        console.log("no change detected.");
        isRunning = false;
        return;
      }

      console.log("change detected. Sending email notification");

      client.send({
        to: config.email.to.map((to) => ({
          mail: to.address,
          name: to.name,
        })),
        from: `${config.email.from.name} <${config.email.from.address}>`,
        subject: config.email.subject,
        content: `${config.email.body} - site: ${config.url}`,
      });

      console.log("updating snapshot");
      snapshot = check;
    } catch (err) {
      console.log("failed to check url", "error", err);
    }

    isRunning = false;
  }, config.frequency * 1000);
}

async function fetchUrl(url: string): Promise<string> {
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error("failed to fetch url", { cause: res.status });
  }

  return res.text();
}
