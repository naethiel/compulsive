# Compulsive

A compulsive url checker.

## Installation

If you have `go` installed you can just run it through that
`$ go install https://github.com/naethiel/compulsive`

Other users can just go to the release page and grab a compiled binary.

## Usage

`compulsive`

That's it. Configuration file should be defined as `compulsive.json` in the executable's folder.

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