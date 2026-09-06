export interface FileProbe {
  readonly exists: (path: string) => Promise<boolean>;
}
