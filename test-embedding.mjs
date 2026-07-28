import { pipeline } from '@xenova/transformers';

const embedder = await pipeline('feature-extraction', 'Xenova/bge-small-en-v1.5');
const output = await embedder('An actor with an intimidating, powerful presence.', {
  pooling: 'mean',
  normalize: true,
});

console.log('Vector length:', output.data.length);
console.log('First 5 values:', output.data.slice(0, 5));