/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

import type { Equal, Expect } from "../../path/__tests__/type-assertions";
import { StateGraph } from "../state/StateGraph";
import type { StateFieldEntry, StateNodeEntry } from "../state/types";
import { ValueStore } from "../value/ValueStore";
import { InvoiceStructure, sampleInvoice } from "./__fixtures__/invoice";
import type { ObservationChain } from "./ObservationChain";

const form = new InvoiceStructure();

/**
 * The root keeps its own type instead of coming back as the wide union, which is
 * what let `StateGraph` drop the copy of it that it used to hold on the side.
 */
const state = new StateGraph(form.index);

type StateRootExpectation = Expect<Equal<ReturnType<typeof state.root>, StateNodeEntry>>;

const values = new ValueStore(form.index, sampleInvoice());

type ValueRootExpectation = Expect<Equal<ReturnType<typeof values.root>, ReturnType<typeof values.entry>>>;

/**
 * Only a node can sit above anybody. Handing a field over as one has to be
 * refused by the compiler rather than caught at runtime, which is exactly what
 * a single `TNode` parameter could not express: `StateEntry` was widened to
 * accept a field there and only property covariance let it through.
 */
declare const chain: ObservationChain<StateFieldEntry | StateNodeEntry, StateNodeEntry>;
declare const field: StateFieldEntry;

// @ts-expect-error a field cannot take children on
chain.insert(field);

type ParentExpectation = Expect<Equal<ReturnType<typeof chain.parentOf>, StateNodeEntry>>;

type RemovedParentExpectation = Expect<Equal<NonNullable<ReturnType<typeof chain.remove>>["parent"], StateNodeEntry>>;

/** A walk may start at anything on the chain, a field included. */
type OriginExpectation = Expect<Equal<ReturnType<typeof chain.originOf>, StateFieldEntry | StateNodeEntry>>;

export type {
  OriginExpectation,
  ParentExpectation,
  RemovedParentExpectation,
  StateRootExpectation,
  ValueRootExpectation,
};
