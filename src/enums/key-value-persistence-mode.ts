import * as z from 'zod';

// spec §5: journal-snapshot for a new paid instance, off for a new free one.
// Changing to or from `off` loses every key.
export const KEY_VALUE_PERSISTENCE_MODES = ['journal-snapshot', 'snapshot', 'off'] as const;

export type KeyValuePersistenceMode = (typeof KEY_VALUE_PERSISTENCE_MODES)[number];

export const keyValuePersistenceModeSchema: z.ZodEnum<z.core.util.ToEnum<KeyValuePersistenceMode>> =
  z.enum(KEY_VALUE_PERSISTENCE_MODES);
