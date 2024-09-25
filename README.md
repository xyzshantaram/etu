# etu

A CLI time-clock for freelancers.

## Usage

See `etu help [command]` for detailed help.
(`etu subcommand help sub-subcommand` also works.)

Start a new project with a given hourly rate and set it as the default:

```sh
etu project new "Project Name" <hourly-rate> [initial hours]
```

List your projects:

```sh
etu project list
```

Start a session in the default project:

```sh
etu session start
```

All project-specific commands accept a project slug via --project or -p to
change the project being operated on. For example, to stop a session in a
specific project:

```sh
etu session -p project-slug stop
```

View the log of the default project:

```sh
etu log
```

Change the default currency symbol:

```sh
etu config currency 'INR '
```

Projects and sessions can be edited as well.

## Installation

Download the latest release from the [Releases](./releases/) page. Then place it somewhere on your path.

## Building

You'll need [Deno](https://deno.land) installed. Then, clone this repo and run:

```sh
deno task build
```

You should end up with a file called `etu` in the current directory.

## LICENSE

Copyright &copy; 2024 Siddharth S Singh (<me@shantaram.xyz>) [The MIT License](./LICENSE.md).
