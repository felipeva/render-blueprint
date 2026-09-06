import * as z from 'zod';

import type { Equal, Expect } from '../equal.js';
import type { Environment } from './environment.js';

export interface ProjectConfig {
  readonly environments: readonly Environment[];
}

export interface Project {
  readonly name: string;
  readonly environments: readonly Environment[];
}

const PROJECT_NAME_ERROR =
  'A project name is a non-empty string; Render identifies a project by its name.';

const environmentValueSchema = z.custom<Environment>();

const projectSchema = z
  .strictObject(
    {
      name: z.string({ error: PROJECT_NAME_ERROR }).min(1, { error: PROJECT_NAME_ERROR }),
      environments: z
        .array(environmentValueSchema, {
          error: 'A project holds a list of its environments; Render requires at least one.',
        })
        .readonly(),
    },
    { error: 'A project is the value project() returned; this entry in projects is not one.' },
  )
  .readonly();

type ProjectSchemaMatchesInterface = Expect<Equal<z.infer<typeof projectSchema>, Project>>;

export const PROJECT_SCHEMA_MATCHES_INTERFACE: true = true satisfies ProjectSchemaMatchesInterface;

export const parseProject = (value: Project): z.ZodSafeParseResult<Project> =>
  projectSchema.safeParse(value);

export const project = (name: string, config: ProjectConfig): Project => ({ ...config, name });
