import { Env, Metadata } from '../types';

const METADATA_KEY = 'metadata.json';

export async function getMetadata(env: Env): Promise<Metadata> {
  const object = await env.BUCKET.get(METADATA_KEY);
  if (!object) {
    return {
      version: '1.0',
      lastUpdated: new Date().toISOString(),
      photos: [],
      folders: [],
    };
  }
  return await object.json();
}

export async function saveMetadata(env: Env, metadata: Metadata): Promise<void> {
  metadata.lastUpdated = new Date().toISOString();
  await env.BUCKET.put(METADATA_KEY, JSON.stringify(metadata));
}
