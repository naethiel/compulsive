# Compulsive

A compulsive url checker.

## Installation

If you have `deno` installed you can just run it through that
`$ deno install --allow-net --allow-read https://github.com/naethiel/compulsive/main.ts`

Other users can just go to the release page and grab a compiled binary.

## Usage

`compulsive --configuration ./path-to-config-file.json`

That's it. Configuration path falls back to `compulsive.json`

The configuration file must respect the format given in the `compulsive.example.json` file:

```json
{
  "url": "https://www.example.com",
  "frequency": 300,
  "email": {
    "server": {
      "hostname": "smtp.example.com",
      "port": 465,
      "auth": {
        "username": "example-user@example.com",
        "password": "foobar"
      },
      "tls": true
    },
    "from": {
      "name": "Compulsive",
      "address": "compulsive-bot@compulsive"
    },
    "to": [
      {
        "name": "Some User",
        "address": "some-user@example.com"
      }
    ],
    "subject": "Compulsive watcher",
    "body": "A change was detected"
  }
}

```

Frequency is expressed in seconds. Compulsive will check the given `url` at launch and snapshot the results.
After that, every `frequency` seconds, it will call `url` again and compare the output to the previous snapshot. If any difference is found, it will send an alert by email following  the `email` configuration, and update it's snapshot.