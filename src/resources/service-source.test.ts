import { describe, expect, it } from 'vitest';

import { nativeSource, repoSource } from './service-source.js';

describe('nativeSource', () => {
  it('answers with the source a native runtime describes', () => {
    expect(nativeSource({ runtime: 'node', buildCommand: 'pnpm build' })).toEqual({
      runtime: 'node',
      buildCommand: 'pnpm build',
    });
  });

  it('answers with nothing for a Docker source, whose Dockerfile is the build', () => {
    expect(nativeSource({ runtime: 'docker', dockerfilePath: './Dockerfile' })).toBeUndefined();
  });

  it('answers with nothing for a prebuilt image, which Render does not build', () => {
    expect(
      nativeSource({ runtime: 'image', image: { url: 'docker.io/acme/api:1' } }),
    ).toBeUndefined();
  });
});

describe('repoSource', () => {
  it('answers with the source a native runtime builds from', () => {
    expect(repoSource({ runtime: 'node', branch: 'main' })).toEqual({
      runtime: 'node',
      branch: 'main',
    });
  });

  it('answers with the source a Dockerfile is built from', () => {
    expect(repoSource({ runtime: 'docker', branch: 'main' })).toEqual({
      runtime: 'docker',
      branch: 'main',
    });
  });

  it('answers with nothing for a prebuilt image, which names no repository', () => {
    expect(
      repoSource({ runtime: 'image', image: { url: 'docker.io/acme/api:1' } }),
    ).toBeUndefined();
  });
});
