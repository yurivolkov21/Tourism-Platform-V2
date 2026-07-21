export * from './contract.js';
export * from './schemas/bookings.js';
export * from './schemas/catalog.js';
export * from './schemas/common.js';
export * from './schemas/enquiries.js';
export * from './schemas/media.js';
export * from './schemas/newsletter.js';
export * from './schemas/reviews.js';
export * from './schemas/wishlist.js';

// Re-exported so consumers can write `ContractInputs['catalog']['tours']['list']`
// without depending on @orpc/contract directly.
import type { InferContractRouterInputs, InferContractRouterOutputs } from '@orpc/contract';
import type { ContractRouter } from './contract.js';

export type ContractInputs = InferContractRouterInputs<ContractRouter>;
export type ContractOutputs = InferContractRouterOutputs<ContractRouter>;
