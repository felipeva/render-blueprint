import { boolean, command, string, type Command } from '@drizzle-team/brocli';

export const COMMAND_NAMES = ['synth', 'check'] as const;

export type CommandName = (typeof COMMAND_NAMES)[number];

export interface CommandOptions {
  readonly file: string | undefined;
  readonly out: string | undefined;
  readonly strict: boolean;
}

export type CommandRunner = (name: CommandName, options: CommandOptions) => Promise<void>;

export const CLI_NAME = 'render-blueprint';

export const CLI_DESCRIPTION = `Typed factories that describe Render resources and synthesize render.yaml.

Exit codes:
  0  synth wrote the file, or check found the committed file clean.
  1  The blueprint is invalid, a file operation failed, the command line was wrong, or
     --strict turned a warning into a failure.
  2  The committed file drifted from the blueprint.`;

const options = {
  file: string('file').desc(
    'The blueprint file, instead of the nearest render.ts, render.mts, render.js or render.mjs found by walking up from the working directory.',
  ),
  out: string('out').desc(
    'The YAML file to write or compare. Defaults to render.yaml beside the blueprint file.',
  ),
  strict: boolean('strict')
    .desc('Treat validation warnings as a failure. synth still writes the file, then fails.')
    .default(false),
};

export const commands = (runner: CommandRunner): [Command, Command] => [
  command({
    name: 'synth',
    shortDesc: 'Synthesize the blueprint and write the YAML file.',
    desc: 'Synthesize the blueprint and write the YAML file. It exits 0 once the file is written, so a run that only reports warnings still succeeds unless --strict is on.',
    options,
    handler: (parsed) => runner('synth', parsed),
  }),
  command({
    name: 'check',
    shortDesc: 'Compare the committed YAML file against the blueprint.',
    desc: 'Compare the committed YAML file against the blueprint. It exits 2 when the file has drifted and 1 when something is broken, so CI can tell a stale file from a failure.',
    options,
    handler: (parsed) => runner('check', parsed),
  }),
];
