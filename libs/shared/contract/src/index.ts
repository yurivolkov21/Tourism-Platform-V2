export * from './contract.js';
export * from './schemas/catalog.js';

// Re-exported so consumers can write `ContractInputs['catalog']['tours']['list']`
// without depending on @orpc/contract directly.
import type { InferContractRouterInputs, InferContractRouterOutputs } from '@orpc/contract';
import type { ContractRouter } from './contract.js';

export type ContractInputs = InferContractRouterInputs<ContractRouter>;
export type ContractOutputs = InferContractRouterOutputs<ContractRouter>;
